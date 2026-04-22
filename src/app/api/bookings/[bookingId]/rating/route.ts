import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    createBookingRating,
    TrustServiceError,
} from "@/services/trust-service";

/**
 * POST /api/bookings/:bookingId/rating
 *
 * Creates one immutable rider -> driver rating for a completed booking.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    code: "INVALID_JSON",
                    message: "Request body must be valid JSON.",
                },
                { status: 400 }
            );
        }

        const { bookingId } = await params;
        const rating = await createBookingRating(
            bookingId,
            auth.user.clerkUserId,
            rawBody
        );

        return NextResponse.json(rating, { status: 201 });
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

        console.error("[POST /api/bookings/:bookingId/rating] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while creating the rating.",
            },
            { status: 500 }
        );
    }
}
