import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    listRideOffersForRider,
    RideOfferError,
} from "@/services/ride-offer-service";

/**
 * GET /api/me/ride-offers/outgoing
 *
 * Returns outgoing ride offers created by the authenticated rider.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const items = await listRideOffersForRider(auth.user.clerkUserId);
        return NextResponse.json({ items }, { status: 200 });
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

        console.error("[GET /api/me/ride-offers/outgoing] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching outgoing ride offers.",
            },
            { status: 500 }
        );
    }
}
