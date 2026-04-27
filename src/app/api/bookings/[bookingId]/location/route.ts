import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toBookingLocationPayload } from "@/lib/booking-location";
import {
    getActiveTripBookingContext,
    isUserBookingParticipant,
} from "@/services/active-trip-visibility-service";

const bookingLocationSelect = {
    id: true,
    currentLatitude: true,
    currentLongitude: true,
    locationUpdatedAt: true,
    tripStartedAt: true,
    isLocationSharingActive: true,
} satisfies Prisma.BookingSelect;

interface ParsedCoordinates {
    latitude: number;
    longitude: number;
}

function validateCoordinates(raw: unknown):
    | { ok: true; value: ParsedCoordinates }
    | { ok: false; response: NextResponse } {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    error: "Bad Request",
                    code: "INVALID_PAYLOAD",
                    message: "Request body must be a JSON object.",
                },
                { status: 400 }
            ),
        };
    }

    const body = raw as Record<string, unknown>;
    const latitude = body.latitude;
    const longitude = body.longitude;

    if (
        typeof latitude !== "number" ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
    ) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    error: "Bad Request",
                    code: "INVALID_LATITUDE",
                    message: "latitude must be a number between -90 and 90.",
                },
                { status: 400 }
            ),
        };
    }

    if (
        typeof longitude !== "number" ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
    ) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    error: "Bad Request",
                    code: "INVALID_LONGITUDE",
                    message: "longitude must be a number between -180 and 180.",
                },
                { status: 400 }
            ),
        };
    }

    return {
        ok: true,
        value: {
            latitude,
            longitude,
        },
    };
}

function notFoundResponse() {
    return NextResponse.json(
        {
            error: "Not Found",
            code: "BOOKING_NOT_FOUND",
            message: "Booking not found.",
        },
        { status: 404 }
    );
}

function bookingNotActiveResponse() {
    return NextResponse.json(
        {
            error: "Conflict",
            code: "BOOKING_NOT_ACTIVE",
            message: "Trip location data is available only while the trip is active.",
        },
        { status: 409 }
    );
}

function tripNotStartedResponse() {
    return NextResponse.json(
        {
            error: "Conflict",
            code: "TRIP_NOT_STARTED",
            message: "Trip location sharing has not been started.",
        },
        { status: 409 }
    );
}

/**
 * GET /api/bookings/:bookingId/location
 *
 * Participant-only read of latest trip location for an active, started trip.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { bookingId } = await params;
        const trimmedBookingId = bookingId.trim();

        if (!trimmedBookingId) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    code: "BOOKING_ID_REQUIRED",
                    message: "bookingId must be provided.",
                },
                { status: 400 }
            );
        }

        const context = await getActiveTripBookingContext(trimmedBookingId);
        if (!context) {
            return notFoundResponse();
        }

        if (!isUserBookingParticipant(auth.user.clerkUserId, context)) {
            return notFoundResponse();
        }

        if (!context.isActiveWindow) {
            return bookingNotActiveResponse();
        }

        if (
            !context.booking.isLocationSharingActive ||
            context.booking.tripStartedAt === null
        ) {
            return tripNotStartedResponse();
        }

        return NextResponse.json(toBookingLocationPayload(context.booking), {
            status: 200,
        });
    } catch (error) {
        console.error("[GET /api/bookings/:bookingId/location] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching trip location.",
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/bookings/:bookingId/location
 *
 * Driver-only latest location write for an active, started trip.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { bookingId } = await params;
        const trimmedBookingId = bookingId.trim();

        if (!trimmedBookingId) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    code: "BOOKING_ID_REQUIRED",
                    message: "bookingId must be provided.",
                },
                { status: 400 }
            );
        }

        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    code: "INVALID_JSON",
                    message: "Request body must be valid JSON.",
                },
                { status: 400 }
            );
        }

        const coordinateValidation = validateCoordinates(rawBody);
        if (!coordinateValidation.ok) {
            return coordinateValidation.response;
        }

        const { latitude, longitude } = coordinateValidation.value;

        const context = await getActiveTripBookingContext(trimmedBookingId);
        if (!context) {
            return notFoundResponse();
        }

        if (!isUserBookingParticipant(auth.user.clerkUserId, context)) {
            return notFoundResponse();
        }

        if (!context.isActiveWindow) {
            return bookingNotActiveResponse();
        }

        if (!context.driverUserId) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: "BOOKING_DRIVER_NOT_FOUND",
                    message: "Booking does not have a resolvable driver participant.",
                },
                { status: 409 }
            );
        }

        if (context.driverUserId !== auth.user.clerkUserId) {
            return NextResponse.json(
                {
                    error: "Forbidden",
                    code: "LOCATION_WRITE_FORBIDDEN",
                    message: "Only the booking's driver can update trip location.",
                },
                { status: 403 }
            );
        }

        if (
            !context.booking.isLocationSharingActive ||
            context.booking.tripStartedAt === null
        ) {
            return tripNotStartedResponse();
        }

        const now = new Date();

        const updateResult = await prisma.booking.updateMany({
            where: {
                id: trimmedBookingId,
                status: "CONFIRMED",
                isLocationSharingActive: true,
                tripStartedAt: { not: null },
                OR: [{ rideId: null }, { ride: { status: "ACTIVE" } }],
            },
            data: {
                currentLatitude: latitude,
                currentLongitude: longitude,
                locationUpdatedAt: now,
            },
        });

        if (updateResult.count === 0) {
            return bookingNotActiveResponse();
        }

        const updatedBooking = await prisma.booking.findUnique({
            where: { id: trimmedBookingId },
            select: bookingLocationSelect,
        });

        if (!updatedBooking) {
            return notFoundResponse();
        }

        return NextResponse.json(toBookingLocationPayload(updatedBooking), {
            status: 200,
        });
    } catch (error) {
        console.error("[POST /api/bookings/:bookingId/location] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while updating trip location.",
            },
            { status: 500 }
        );
    }
}
