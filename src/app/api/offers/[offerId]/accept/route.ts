import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── POST /api/offers/:offerId/accept ─────────────────────────────────────────

// ── POST /api/offers/:offerId/accept ─────────────────────────────────────────

export async function POST(
    request: NextRequest,
    params: { params: Promise<{ offerId: string }> } // Correct Next.js 15+ signature
) {
    try {
        const { offerId } = await params.params; // Await the promise

        // 1. Auth Guard
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;
        const userId = auth.user.clerkUserId;

        // Execute as Atomic Transaction
        const result = await prisma.$transaction(async (tx) => {
            // 2. Fetch Offer + TripRequest (Inside Transaction for Consistency)
            // Note: For strict concurrency, we might want row locking, but Prisma doesn't support SELECT FOR UPDATE easily.
            // Reliance on optimistic checks + atomic write is usually sufficient for this scale.
            const offer = await tx.offer.findUnique({
                where: { id: offerId },
                include: { tripRequest: true },
            });

            if (!offer) {
                throw new Error("Offer not found");
            }

            // 3. Authorization Guard
            if (offer.tripRequest.riderUserId !== userId) {
                throw new Error("Forbidden: Only the rider can accept this offer");
            }

            // 4. State Guard: Offer must be PENDING
            if (offer.status !== "PENDING") {
                throw new Error(`Conflict: Cannot accept offer in ${offer.status} status`);
            }

            // 5. State Guard: TripRequest must be ACTIVE
            if (offer.tripRequest.status !== "ACTIVE") {
                throw new Error("Conflict: Trip request is no longer active");
            }

            // 6. Check for existing ACCEPTED offer (Double-check inside transaction)
            const acceptedOffer = await tx.offer.findFirst({
                where: {
                    tripRequestId: offer.tripRequestId,
                    status: "ACCEPTED",
                },
            });

            if (acceptedOffer) {
                throw new Error("Conflict: This trip request already has an accepted offer");
            }

            // 7. Update Offer -> ACCEPTED
            const updatedOffer = await tx.offer.update({
                where: { id: offerId },
                data: { status: "ACCEPTED" },
            });

            // 8. Create Booking (CONFIRMED)
            const booking = await tx.booking.create({
                data: {
                    tripRequestId: offer.tripRequestId,
                    driverUserId: offer.driverUserId, // Now supported on Booking
                    riderUserId: offer.riderUserId,
                    seatsBooked: offer.seatsOffered,
                    priceCents: offer.priceCents,     // Now supported on Booking
                    status: "CONFIRMED",
                    // rideId is undefined/null
                },
            });

            // 9. Update TripRequest -> CLOSED
            await tx.tripRequest.update({
                where: { id: offer.tripRequestId },
                data: { status: "CLOSED" },
            });

            // 10. Cancel other PENDING offers for same request
            await tx.offer.updateMany({
                where: {
                    tripRequestId: offer.tripRequestId,
                    status: "PENDING",
                    id: { not: offerId }, // Exclude the one we just accepted (though it's ACCEPTED now)
                },
                data: { status: "CANCELLED" },
            });

            return { offer: updatedOffer, booking };
        });

        return NextResponse.json(result, { status: 200 });

    } catch (error: unknown) {
        console.error("[POST /api/offers/:id/accept] Error:", error);

        // Handle Prisma Unique Constraint Violation
        if ((error as any).code === "P2002") {
            return NextResponse.json(
                { error: "Conflict", message: "Conflict" },
                { status: 409 }
            );
        }

        const msg = error instanceof Error ? error.message : "Internal Server Error";
        if (msg === "Offer not found") {
            return NextResponse.json({ error: "Not Found", message: msg }, { status: 404 });
        }
        if (msg.startsWith("Forbidden")) {
            return NextResponse.json({ error: "Forbidden", message: msg }, { status: 403 });
        }
        if (msg.startsWith("Conflict")) {
            return NextResponse.json({ error: "Conflict", message: msg }, { status: 409 });
        }

        return NextResponse.json(
            { error: "Internal Server Error", message: msg, details: String(error) },
            { status: 500 }
        );
    }
}
