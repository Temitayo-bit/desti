import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    findCandidateRidesForTripRequest,
    TripRequestRideMatchingError,
} from "@/services/trip-request-ride-matching-service";

/**
 * GET /api/trip-requests/:tripRequestId/matches
 *
 * Returns read-only ride candidates for the given trip request.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tripRequestId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { tripRequestId } = await params;
        const items = await findCandidateRidesForTripRequest(tripRequestId);

        return NextResponse.json({ items }, { status: 200 });
    } catch (error) {
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
            "[GET /api/trip-requests/:tripRequestId/matches] Unexpected error:",
            error
        );
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message:
                    "An unexpected error occurred while fetching ride matches.",
            },
            { status: 500 }
        );
    }
}
