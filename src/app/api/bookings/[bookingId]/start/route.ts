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

/**
 * POST /api/bookings/:bookingId/start
 *
 * Driver-only start endpoint for enabling location sharing on an active booking.
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

        const context = await getActiveTripBookingContext(trimmedBookingId);

        if (!context) {
            return NextResponse.json(
                {
                    error: "Not Found",
                    code: "BOOKING_NOT_FOUND",
                    message: "Booking not found.",
                },
                { status: 404 }
            );
        }

        if (!isUserBookingParticipant(auth.user.clerkUserId, context)) {
            return NextResponse.json(
                {
                    error: "Not Found",
                    code: "BOOKING_NOT_FOUND",
                    message: "Booking not found.",
                },
                { status: 404 }
            );
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
                    code: "TRIP_START_FORBIDDEN",
                    message: "Only the booking's driver can start trip location sharing.",
                },
                { status: 403 }
            );
        }

        if (!context.isActiveWindow) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: "BOOKING_NOT_ACTIVE",
                    message: "Trip location sharing is only available for active trips.",
                },
                { status: 409 }
            );
        }

        if (
            context.booking.isLocationSharingActive &&
            context.booking.tripStartedAt !== null
        ) {
            return NextResponse.json(toBookingLocationPayload(context.booking), {
                status: 200,
            });
        }

        const startedAt = context.booking.tripStartedAt ?? new Date();

        const updateResult = await prisma.booking.updateMany({
            where: {
                id: trimmedBookingId,
                status: "CONFIRMED",
                OR: [{ rideId: null }, { ride: { status: "ACTIVE" } }],
            },
            data: {
                isLocationSharingActive: true,
                tripStartedAt: startedAt,
            },
        });

        if (updateResult.count === 0) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: "BOOKING_NOT_ACTIVE",
                    message: "Trip location sharing is only available for active trips.",
                },
                { status: 409 }
            );
        }

        const updatedBooking = await prisma.booking.findUnique({
            where: { id: trimmedBookingId },
            select: bookingLocationSelect,
        });

        if (!updatedBooking) {
            return NextResponse.json(
                {
                    error: "Not Found",
                    code: "BOOKING_NOT_FOUND",
                    message: "Booking not found.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(toBookingLocationPayload(updatedBooking), {
            status: 200,
        });
    } catch (error) {
        console.error("[POST /api/bookings/:bookingId/start] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while starting trip location sharing.",
            },
            { status: 500 }
        );
    }
}
