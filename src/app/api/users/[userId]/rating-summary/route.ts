import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    getDriverRatingSummary,
    TrustServiceError,
} from "@/services/trust-service";

/**
 * GET /api/users/:userId/rating-summary
 *
 * Returns aggregate driver trust stats.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { userId } = await params;
        const summary = await getDriverRatingSummary(userId);

        return NextResponse.json(summary, { status: 200 });
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

        console.error("[GET /api/users/:userId/rating-summary] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching rating summary.",
            },
            { status: 500 }
        );
    }
}
