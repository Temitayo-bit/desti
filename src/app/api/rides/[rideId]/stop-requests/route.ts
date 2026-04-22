import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    createStopRequest,
    listStopRequestsForDriver,
    StopRequestError,
} from "@/services/stop-request-service";

interface ValidationError {
    field: string;
    message: string;
}

interface CreateStopRequestBody {
    requestedPickupText: string;
    requestedPickupLatitude: number;
    requestedPickupLongitude: number;
    requestedDropoffText: string;
    requestedDropoffLatitude: number;
    requestedDropoffLongitude: number;
    riderNote?: string | null;
}

function parseRequiredText(
    body: Record<string, unknown>,
    field: keyof CreateStopRequestBody,
    errors: ValidationError[]
): string | null {
    const value = body[field];
    if (typeof value !== "string") {
        errors.push({ field, message: `${field} is required and must be a string.` });
        return null;
    }

    const trimmed = value.trim();
    if (trimmed.length < 1 || trimmed.length > 200) {
        errors.push({ field, message: `${field} must be between 1 and 200 characters after trimming.` });
        return null;
    }

    return trimmed;
}

function parseCoordinate(
    body: Record<string, unknown>,
    field: keyof CreateStopRequestBody,
    min: number,
    max: number,
    errors: ValidationError[]
): number | null {
    const value = body[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
        errors.push({ field, message: `${field} must be a finite number between ${min} and ${max}.` });
        return null;
    }

    return value;
}

function parseCreateBody(
    body: unknown
): { parsed: CreateStopRequestBody; errors: [] } | { parsed: null; errors: ValidationError[] } {
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

    const typedBody = body as Record<string, unknown>;
    const errors: ValidationError[] = [];

    const requestedPickupText = parseRequiredText(typedBody, "requestedPickupText", errors);
    const requestedDropoffText = parseRequiredText(typedBody, "requestedDropoffText", errors);
    const requestedPickupLatitude = parseCoordinate(typedBody, "requestedPickupLatitude", -90, 90, errors);
    const requestedPickupLongitude = parseCoordinate(typedBody, "requestedPickupLongitude", -180, 180, errors);
    const requestedDropoffLatitude = parseCoordinate(typedBody, "requestedDropoffLatitude", -90, 90, errors);
    const requestedDropoffLongitude = parseCoordinate(typedBody, "requestedDropoffLongitude", -180, 180, errors);

    let riderNote: string | null = null;
    if (typedBody.riderNote !== undefined && typedBody.riderNote !== null) {
        if (typeof typedBody.riderNote !== "string") {
            errors.push({ field: "riderNote", message: "riderNote must be a string when provided." });
        } else {
            const trimmed = typedBody.riderNote.trim();
            if (trimmed.length > 500) {
                errors.push({ field: "riderNote", message: "riderNote must be 500 characters or fewer." });
            } else {
                riderNote = trimmed.length > 0 ? trimmed : null;
            }
        }
    }

    if (
        errors.length > 0 ||
        requestedPickupText === null ||
        requestedDropoffText === null ||
        requestedPickupLatitude === null ||
        requestedPickupLongitude === null ||
        requestedDropoffLatitude === null ||
        requestedDropoffLongitude === null
    ) {
        return { parsed: null, errors };
    }

    return {
        parsed: {
            requestedPickupText,
            requestedPickupLatitude,
            requestedPickupLongitude,
            requestedDropoffText,
            requestedDropoffLatitude,
            requestedDropoffLongitude,
            riderNote,
        },
        errors: [],
    };
}

/**
 * POST /api/rides/:rideId/stop-requests
 *
 * Rider creates a pending stop request on a ride.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ rideId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { rideId } = await params;

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

        const validation = parseCreateBody(rawBody);
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

        const item = await createStopRequest(
            rideId,
            auth.user.clerkUserId,
            validation.parsed
        );

        return NextResponse.json({ item }, { status: 201 });
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

        console.error("[POST /api/rides/:rideId/stop-requests] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while creating the stop request.",
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/rides/:rideId/stop-requests
 *
 * Driver-only listing of incoming stop requests for one ride.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ rideId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { rideId } = await params;
        const items = await listStopRequestsForDriver(rideId, auth.user.clerkUserId);

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

        console.error("[GET /api/rides/:rideId/stop-requests] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching stop requests.",
            },
            { status: 500 }
        );
    }
}
