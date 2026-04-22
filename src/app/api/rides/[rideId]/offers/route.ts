import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    createRideOffer,
    listRideOffersForDriver,
    RideOfferError,
} from "@/services/ride-offer-service";

interface ValidationError {
    field: string;
    message: string;
}

function parseCreateBody(body: unknown): { offeredPriceCents: number } | { errors: ValidationError[] } {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return {
            errors: [
                {
                    field: "body",
                    message: "Request body must be a JSON object.",
                },
            ],
        };
    }

    const offeredPriceCents = (body as Record<string, unknown>).offeredPriceCents;
    if (
        typeof offeredPriceCents !== "number" ||
        !Number.isInteger(offeredPriceCents) ||
        offeredPriceCents <= 0
    ) {
        return {
            errors: [
                {
                    field: "offeredPriceCents",
                    message: "offeredPriceCents must be a positive integer.",
                },
            ],
        };
    }

    return { offeredPriceCents };
}

/**
 * POST /api/rides/:rideId/offers
 *
 * Creates a pending ride offer from the authenticated rider.
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

        const parsed = parseCreateBody(rawBody);
        if ("errors" in parsed) {
            return NextResponse.json(
                {
                    error: "Validation Error",
                    message: "One or more fields are invalid.",
                    details: parsed.errors,
                },
                { status: 400 }
            );
        }

        const offer = await createRideOffer(
            rideId,
            auth.user.clerkUserId,
            parsed.offeredPriceCents
        );

        return NextResponse.json(offer, { status: 201 });
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

        console.error("[POST /api/rides/:rideId/offers] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while creating the ride offer.",
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/rides/:rideId/offers
 *
 * Returns incoming offers for a ride (driver-only).
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ rideId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { rideId } = await params;
        const items = await listRideOffersForDriver(rideId, auth.user.clerkUserId);

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

        console.error("[GET /api/rides/:rideId/offers] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching ride offers.",
            },
            { status: 500 }
        );
    }
}
