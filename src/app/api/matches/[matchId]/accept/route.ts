import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    acceptMatch,
    MatchLifecycleError,
} from "@/services/trip-request-match-lifecycle-service";
import { TripRequestRideMatchingError } from "@/services/trip-request-ride-matching-service";

/**
 * POST /api/matches/:matchId/accept
 *
 * Transitions a match from SUGGESTED -> ACCEPTED for the trip request owner.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ matchId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { matchId } = await params;
        const item = await acceptMatch(matchId, auth.user.clerkUserId);

        return NextResponse.json({ item }, { status: 200 });
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

        console.error("[POST /api/matches/:matchId/accept] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while accepting the match.",
            },
            { status: 500 }
        );
    }
}
