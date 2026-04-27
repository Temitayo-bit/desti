import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    getActiveMatchesForDriverRide,
    MatchLifecycleError,
} from "@/services/trip-request-match-lifecycle-service";
import { TripRequestRideMatchingError } from "@/services/trip-request-ride-matching-service";

/**
 * GET /api/rides/:rideId/matches
 *
 * Returns active persisted SUGGESTED trip-request matches for the driver’s ride
 * (same match engine as GET /api/trip-requests/:tripRequestId/matches, inverted).
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ rideId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { rideId } = await params;
        const items = await getActiveMatchesForDriverRide(
            rideId,
            auth.user.clerkUserId
        );

        return NextResponse.json({ items }, { status: 200 });
    } catch (error) {
        if (error instanceof MatchLifecycleError) {
            return NextResponse.json(
                {
                    error: error.error,
                    code: error.code,
                    message: error.message,
                },
                { status: error.statusCode }
            );
        }

        if (error instanceof TripRequestRideMatchingError) {
            return NextResponse.json(
                {
                    error: error.error,
                    code: error.code,
                    message: error.message,
                },
                { status: error.statusCode }
            );
        }

        console.error(
            "[GET /api/rides/:rideId/matches] Unexpected error:",
            error
        );
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message:
                    "An unexpected error occurred while fetching trip request matches for this ride.",
            },
            { status: 500 }
        );
    }
}
