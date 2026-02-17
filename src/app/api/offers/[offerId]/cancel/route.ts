import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── POST /api/offers/:offerId/cancel ─────────────────────────────────────────

export async function POST(
    request: NextRequest,
    params: { params: Promise<{ offerId: string }> }
) {
    try {
        const { offerId } = await params.params;

        // 1. Auth Guard
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;
        const userId = auth.user.clerkUserId;

        // Execute as Atomic Transaction (or fetch first then transaction)
        // We'll fetch first to check auth, then transaction for updates

        const offer = await prisma.offer.findUnique({
            where: { id: offerId },
        });

        if (!offer) {
            return NextResponse.json(
                { error: "Not Found", message: "Offer not found." },
                { status: 404 }
            );
        }

        // 3. Authorization & State Guard
        const isDriver = offer.driverUserId === userId;
        const isRider = offer.riderUserId === userId;

        if (!isDriver && !isRider) {
            return NextResponse.json(
                { error: "Forbidden", message: "You are not authorized to cancel this offer." },
                { status: 403 }
            );
        }

        // Idempotency: If already cancelled, return success
        if (offer.status === "CANCELLED") {
            return NextResponse.json(offer, { status: 200 });
        }

        // Driver can only cancel PENDING offers
        if (isDriver && offer.status !== "PENDING") {
            return NextResponse.json(
                {
                    error: "Conflict",
                    message: "Drivers cannot cancel an offer once it has been accepted. Please contact support."
                },
                { status: 409 }
            );
        }

        // 4. Transactional Update
        const result = await prisma.$transaction(async (tx) => {
            // Update Offer -> CANCELLED
            const updatedOffer = await tx.offer.update({
                where: { id: offerId },
                data: { status: "CANCELLED" },
            });

            // If it was ACCEPTED, we must also cancel Booking and Re-open TripRequest
            if (offer.status === "ACCEPTED") {
                // Cancel Booking
                // We find the CONFIRMED booking for this trip request
                await tx.booking.updateMany({
                    where: {
                        tripRequestId: offer.tripRequestId,
                        status: "CONFIRMED"
                    },
                    data: { status: "CANCELLED" }
                });

                // Re-Open Trip Request
                await tx.tripRequest.update({
                    where: { id: offer.tripRequestId },
                    data: { status: "ACTIVE" }
                });
            }

            return updatedOffer;
        });

        return NextResponse.json(result, { status: 200 });

    } catch (error) {
        console.error("[POST /api/offers/:id/cancel] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
