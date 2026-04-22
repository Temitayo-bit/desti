import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    quoteStopRequest,
    StopRequestError,
} from "@/services/stop-request-service";

interface ValidationError {
    field: string;
    message: string;
}

const MAX_INT_32 = 2_147_483_647;

function parseQuoteBody(body: unknown):
    | { parsed: { quotedPriceCents: number }; errors: [] }
    | { parsed: null; errors: ValidationError[] } {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return {
            parsed: null,
            errors: [
                {
                    field: "body",
                    message: "Request body must be a JSON object.",
                },
            ],
        };
    }

    const quotedPriceCents = (body as Record<string, unknown>).quotedPriceCents;
    if (
        typeof quotedPriceCents !== "number" ||
        !Number.isInteger(quotedPriceCents) ||
        quotedPriceCents < 1 ||
        quotedPriceCents > MAX_INT_32
    ) {
        return {
            parsed: null,
            errors: [
                {
                    field: "quotedPriceCents",
                    message: "quotedPriceCents must be an integer between 1 and 2147483647.",
                },
            ],
        };
    }

    return {
        parsed: { quotedPriceCents },
        errors: [],
    };
}

/**
 * POST /api/stop-requests/:stopRequestId/quote
 *
 * Driver quotes a pending stop request.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stopRequestId: string }> }
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
                    message: "Request body must be valid JSON.",
                },
                { status: 400 }
            );
        }

        const validation = parseQuoteBody(rawBody);
        if (validation.parsed === null) {
            return NextResponse.json(
                {
                    error: "Validation Error",
                    message: "One or more fields are invalid.",
                    details: validation.errors,
                },
                { status: 400 }
            );
        }

        const { stopRequestId } = await params;
        const item = await quoteStopRequest(
            stopRequestId,
            auth.user.clerkUserId,
            validation.parsed.quotedPriceCents
        );

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

        console.error("[POST /api/stop-requests/:stopRequestId/quote] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while quoting the stop request.",
            },
            { status: 500 }
        );
    }
}
