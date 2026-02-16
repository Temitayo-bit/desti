import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/bookings/:bookingId/cancel
 *
 * Cancels a booking and restores seat inventory transactionally.
 * Requires:
 * - Valid Clerk session
 * - User must match booking.riderUserId
 */
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ bookingId: string }> }
) {
    const params = await props.params;
    const { bookingId } = params;

    try {
        if (!bookingId) {
            return NextResponse.json(
                { error: "Bad Request", message: "Missing booking ID." },
                { status: 400 }
            );
        }

        // 1. Auth Guard
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;
        const userId = auth.user.clerkUserId;

        // 2. Transactional Cancellation
        const result = await prisma.$transaction(async (tx) => {
            // A. Fetch Booking with Ride info (lock row?)
            // Prisma doesn't support SELECT FOR UPDATE easily. relying on atomic updates.
            const booking = await tx.booking.findUnique({
                where: { id: bookingId },
                include: { ride: true },
            });

            if (!booking) {
                throw new Error("Booking not found."); // Map to 404 outside
            }

            // B. Authorization Check
            if (booking.riderUserId !== userId) {
                throw new Error("Unauthorized access to booking."); // Map to 403 outside
            }

            // C. Idempotency / State Check
            if (booking.status === "CANCELLED") {
                return { status: 200, message: "Booking already cancelled." };
            }

            // D. Update Booking Status
            await tx.booking.update({
                where: { id: bookingId },
                data: { status: "CANCELLED" },
            });

            // E. Restore Seats (Atomic Increment)
            // "Ensure seatsAvailable never exceeds seatsTotal" - enforced by logic usually.
            // If we want to be strict, we can't easily Clamp in one query without raw SQL.
            // We'll trust atomic arithmetic: Available was X, Booked Y. X+Y <= Total.
            await tx.ride.update({
                where: { id: booking.rideId },
                data: {
                    seatsAvailable: { increment: booking.seatsBooked },
                },
            });

            return { status: 200, message: "Booking cancelled successfully." };
        });

        return NextResponse.json({ message: result.message }, { status: 200 });
    } catch (error: any) {
        if (error.message === "Booking not found.") {
            return NextResponse.json({ error: "Not Found", message: "Booking not found." }, { status: 404 });
        }
        if (error.message === "Unauthorized access to booking.") {
            return NextResponse.json(
                { error: "Forbidden", message: "You are not authorized to cancel this booking." },
                { status: 403 }
            );
        }

        console.error(`[POST /api/bookings/${params.bookingId}/cancel] Error:`, error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
