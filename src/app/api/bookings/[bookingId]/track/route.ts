import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    getActiveTripBookingContext,
    isUserBookingParticipant,
} from "@/services/active-trip-visibility-service";

const trackBookingSelect = {
    id: true,
    rideId: true,
    riderUserId: true,
    driverUserId: true,
    status: true,
    seatsBooked: true,
    priceCents: true,
    currentLatitude: true,
    currentLongitude: true,
    locationUpdatedAt: true,
    tripStartedAt: true,
    isLocationSharingActive: true,
    completedAt: true,
    ride: {
        select: {
            id: true,
            driverUserId: true,
            originText: true,
            destinationText: true,
            earliestDepartAt: true,
            latestDepartAt: true,
            status: true,
            vehicleType: true,
            driver: {
                select: {
                    name: true,
                    profilePictureUrl: true,
                },
            },
        },
    },
    tripRequest: {
        select: {
            originText: true,
            destinationText: true,
        },
    },
} satisfies Prisma.BookingSelect;

/**
 * GET /api/bookings/:bookingId/track
 *
 * Returns everything the track page needs in one call:
 *   - booking status, ride origin/destination
 *   - driver name, avatar, vehicle info
 *   - current location data
 *
 * Auth-gated: only booking participants can access.
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

        // Verify participant access
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

        // Fetch full track data
        const booking = await prisma.booking.findUnique({
            where: { id: trimmedBookingId },
            select: trackBookingSelect,
        });

        if (!booking) {
            return NextResponse.json(
                {
                    error: "Not Found",
                    code: "BOOKING_NOT_FOUND",
                    message: "Booking not found.",
                },
                { status: 404 }
            );
        }

        // Resolve origin/destination from ride or trip request
        const pickup =
            booking.ride?.originText ??
            booking.tripRequest?.originText ??
            "Pickup location";
        const destination =
            booking.ride?.destinationText ??
            booking.tripRequest?.destinationText ??
            "Destination";

        // Resolve driver info
        const driverName = booking.ride?.driver?.name ?? "Driver";
        const driverAvatar = booking.ride?.driver?.profilePictureUrl ?? null;
        const vehicleType = booking.ride?.vehicleType ?? null;

        return NextResponse.json(
            {
                bookingId: booking.id,
                bookingStatus: booking.status,
                isLocationSharingActive: booking.isLocationSharingActive,
                tripStartedAt: booking.tripStartedAt?.toISOString() ?? null,
                completedAt: booking.completedAt?.toISOString() ?? null,
                driver: {
                    name: driverName,
                    avatarUrl: driverAvatar,
                    vehicle: vehicleType ?? "Vehicle",
                    plate: "—",
                },
                locations: {
                    pickup,
                    destination,
                },
                currentLatitude: booking.currentLatitude,
                currentLongitude: booking.currentLongitude,
                locationUpdatedAt: booking.locationUpdatedAt?.toISOString() ?? null,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("[GET /api/bookings/:bookingId/track] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching track data.",
            },
            { status: 500 }
        );
    }
}
