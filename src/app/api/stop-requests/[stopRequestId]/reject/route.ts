import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    rejectStopRequest,
    StopRequestError,
} from "@/services/stop-request-service";

/**
 * POST /api/stop-requests/:stopRequestId/reject
 *
 * Driver or rider rejects an open stop request.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stopRequestId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { stopRequestId } = await params;
        const item = await rejectStopRequest(stopRequestId, auth.user.clerkUserId);

        return NextResponse.json({ item }, { status: 200 });
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

        console.error("[POST /api/stop-requests/:stopRequestId/reject] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while rejecting the stop request.",
            },
            { status: 500 }
        );
    }
}
