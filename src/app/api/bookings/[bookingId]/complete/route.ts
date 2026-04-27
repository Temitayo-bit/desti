import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    completeBookingManually,
    TrustServiceError,
} from "@/services/trust-service";

/**
 * POST /api/bookings/:bookingId/complete
 *
 * Driver-only manual booking completion for MVP demo flow.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { bookingId } = await params;
        const completedBooking = await completeBookingManually(
            bookingId,
            auth.user.clerkUserId
        );

        return NextResponse.json(completedBooking, { status: 200 });
    } catch (error) {
        if (error instanceof TrustServiceError) {
            return NextResponse.json(
                {
                    error: error.error,
                    code: error.code,
                    message: error.message,
                },
                { status: error.statusCode }
            );
        }

        console.error("[POST /api/bookings/:bookingId/complete] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while completing the booking.",
            },
            { status: 500 }
        );
    }
}
