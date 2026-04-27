import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    listStopRequestsForRider,
    StopRequestError,
} from "@/services/stop-request-service";

/**
 * GET /api/me/stop-requests/outgoing
 *
 * Rider-only listing of outgoing stop requests.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const items = await listStopRequestsForRider(auth.user.clerkUserId);
        return NextResponse.json({ items }, { status: 200 });
    } catch (error) {
        if (error instanceof StopRequestError) {
            return NextResponse.json(
                {
                    error: error.error,
                    code: error.code,
                    message: error.message,
                },
                { status: error.statusCode }
            );
        }

        console.error("[GET /api/me/stop-requests/outgoing] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching outgoing stop requests.",
            },
            { status: 500 }
        );
    }
}
