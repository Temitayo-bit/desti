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
        const auth = await requireStetsonAuth(request);
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

            if (booking.status === "CANCELLED") {
                return { status: 200, message: "Booking already cancelled." };
            }

            if (booking.status === "COMPLETED") {
                throw new Error("Completed booking cannot be cancelled.");
            }

            // C. Atomic Status Update (Race Guard)
            const updateResult = await tx.booking.updateMany({
                where: {
                    id: bookingId,
                    status: "CONFIRMED",
                },
                data: { status: "CANCELLED" },
            });

            if (updateResult.count === 0) {
                const latest = await tx.booking.findUnique({
                    where: { id: bookingId },
                    select: { status: true },
                });

                if (latest?.status === "CANCELLED") {
                    return { status: 200, message: "Booking already cancelled." };
                }

                if (latest?.status === "COMPLETED") {
                    throw new Error("Completed booking cannot be cancelled.");
                }

                throw new Error("Booking can no longer be cancelled.");
            }

            // D. Restore Seats (only if status update succeeded)

            // E. Restore Seats (Atomic Increment)
            // "Ensure seatsAvailable never exceeds seatsTotal" - enforced by logic usually.
            // If we want to be strict, we can't easily Clamp in one query without raw SQL.
            // We'll trust atomic arithmetic: Available was X, Booked Y. X+Y <= Total.
            // If the booking is linked to a Ride, restore the seats
            if (booking.rideId) {
                await tx.ride.update({
                    where: { id: booking.rideId },
                    data: {
                        seatsAvailable: { increment: booking.seatsBooked },
                    },
                });
            }

            return { status: 200, message: "Booking cancelled successfully." };
        });

        return NextResponse.json({ message: result.message }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "";

        if (errorMessage === "Booking not found.") {
            return NextResponse.json({ error: "Not Found", message: "Booking not found." }, { status: 404 });
        }
        if (errorMessage === "Unauthorized access to booking.") {
            return NextResponse.json(
                { error: "Forbidden", message: "You are not authorized to cancel this booking." },
                { status: 403 }
            );
        }
        if (errorMessage === "Completed booking cannot be cancelled.") {
            return NextResponse.json(
                { error: "Conflict", message: "Completed bookings cannot be cancelled." },
                { status: 409 }
            );
        }
        if (errorMessage === "Booking can no longer be cancelled.") {
            return NextResponse.json(
                {
                    error: "Conflict",
                    message: "Booking could not be cancelled because its state changed.",
                },
                { status: 409 }
            );
        }

        console.error(`[POST /api/bookings/${params.bookingId}/cancel] Error:`, error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
