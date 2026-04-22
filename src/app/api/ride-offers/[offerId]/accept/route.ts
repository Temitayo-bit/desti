import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    acceptRideOffer,
    RideOfferError,
} from "@/services/ride-offer-service";

/**
 * POST /api/ride-offers/:offerId/accept
 *
 * Driver accepts a pending ride offer and creates a booking atomically.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ offerId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { offerId } = await params;
        const result = await acceptRideOffer(offerId, auth.user.clerkUserId);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        if (error instanceof RideOfferError) {
            return NextResponse.json(
                {
                    error: error.error,
                    code: error.code,
                    message: error.message,
                },
                { status: error.statusCode }
            );
        }

        console.error("[POST /api/ride-offers/:offerId/accept] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while accepting the ride offer.",
            },
            { status: 500 }
        );
    }
}
