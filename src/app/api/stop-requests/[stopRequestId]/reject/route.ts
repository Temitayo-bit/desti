import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    rejectStopRequest,
    StopRequestError,
} from "@/services/stop-request-service";

interface ValidationError {
    field: string;
    message: string;
}

const PATH_ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

function parseStopRequestId(
    value: unknown
): { parsed: string; errors: [] } | { parsed: null; errors: ValidationError[] } {
    if (typeof value !== "string") {
        return {
            parsed: null,
            errors: [{ field: "stopRequestId", message: "stopRequestId is required and must be a string." }],
        };
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return {
            parsed: null,
            errors: [{ field: "stopRequestId", message: "stopRequestId must not be empty." }],
        };
    }

    if (!PATH_ID_REGEX.test(trimmed)) {
        return {
            parsed: null,
            errors: [{ field: "stopRequestId", message: "stopRequestId contains invalid characters." }],
        };
    }

    return { parsed: trimmed, errors: [] };
}

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

        const { stopRequestId: rawStopRequestId } = await params;
        const stopRequestIdValidation = parseStopRequestId(rawStopRequestId);
        if (stopRequestIdValidation.parsed === null) {
            return NextResponse.json(
                {
                    error: "Validation Error",
                    message: "One or more fields are invalid.",
                    details: stopRequestIdValidation.errors,
                },
                { status: 400 }
            );
        }

        const stopRequestId = stopRequestIdValidation.parsed;
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
