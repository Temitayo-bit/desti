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
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;
        const userId = auth.user.clerkUserId;

        // 2. All authorization, state guards, and mutations run inside a single
        //    transaction so the checks operate on the freshly-read row, closing
        //    the race window between a pre-transaction read and a concurrent accept.
        const result = await prisma.$transaction(async (tx) => {
            const currentOffer = await tx.offer.findUnique({
                where: { id: offerId },
            });

            if (!currentOffer) {
                return { _tag: "not_found" as const };
            }

            // 3. Authorization
            const isDriver = currentOffer.driverUserId === userId;
            const isRider = currentOffer.riderUserId === userId;

            if (!isDriver && !isRider) {
                return { _tag: "forbidden" as const };
            }

            // 4. Idempotency: already cancelled → no-op
            if (currentOffer.status === "CANCELLED") {
                return { _tag: "ok" as const, offer: currentOffer };
            }

            // 5. Driver can only cancel PENDING offers — re-validated against the
            //    row fetched inside this transaction, preventing a concurrent
            //    accept from being silently overwritten.
            if (isDriver && currentOffer.status !== "PENDING") {
                return { _tag: "driver_conflict" as const };
            }

            // 6. Update Offer → CANCELLED
            const updatedOffer = await tx.offer.update({
                where: { id: offerId },
                data: { status: "CANCELLED" },
            });

            // 7. If the offer WAS accepted, cascade: cancel booking + re-open trip request
            if (currentOffer.status === "ACCEPTED") {
                await tx.booking.updateMany({
                    where: {
                        tripRequestId: currentOffer.tripRequestId,
                        status: "CONFIRMED",
                    },
                    data: { status: "CANCELLED" },
                });

                await tx.tripRequest.update({
                    where: { id: currentOffer.tripRequestId },
                    data: { status: "ACTIVE" },
                });
            }

            return { _tag: "ok" as const, offer: updatedOffer };
        });

        // 3. Map transaction outcome to HTTP response
        switch (result._tag) {
            case "not_found":
                return NextResponse.json(
                    { error: "Not Found", message: "Offer not found." },
                    { status: 404 }
                );
            case "forbidden":
                return NextResponse.json(
                    { error: "Forbidden", message: "You are not authorized to cancel this offer." },
                    { status: 403 }
                );
            case "driver_conflict":
                return NextResponse.json(
                    {
                        error: "Conflict",
                        message: "Drivers cannot cancel an offer once it has been accepted. Please contact support.",
                    },
                    { status: 409 }
                );
            case "ok":
                return NextResponse.json(result.offer, { status: 200 });
        }
    } catch (error) {
        console.error("[POST /api/offers/:id/cancel] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
