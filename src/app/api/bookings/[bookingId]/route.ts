import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rideForBookingDetail = {
    id: true,
    driverUserId: true,
    originText: true,
    originLatitude: true,
    originLongitude: true,
    destinationText: true,
    destinationLatitude: true,
    destinationLongitude: true,
    earliestDepartAt: true,
    latestDepartAt: true,
    preferredDepartAt: true,
    distanceCategory: true,
    priceCents: true,
    seatsTotal: true,
    seatsAvailable: true,
    status: true,
    pickupInstructions: true,
    dropoffInstructions: true,
    hasAc: true,
    hasTrunkSpace: true,
    musicPreference: true,
    vehicleType: true,
    driver: {
        select: {
            clerkUserId: true,
            name: true,
        },
    },
} satisfies Prisma.RideSelect;

const tripRequestForBookingDetail = {
    id: true,
    originText: true,
    originLatitude: true,
    originLongitude: true,
    destinationText: true,
    destinationLatitude: true,
    destinationLongitude: true,
    earliestDesiredAt: true,
    latestDesiredAt: true,
    preferredDepartAt: true,
    distanceCategory: true,
    seatsNeeded: true,
    status: true,
    pickupInstructions: true,
    dropoffInstructions: true,
} satisfies Prisma.TripRequestSelect;

const bookingDetailSelect = {
    id: true,
    rideId: true,
    tripRequestId: true,
    riderUserId: true,
    driverUserId: true,
    seatsBooked: true,
    priceCents: true,
    status: true,
    completedAt: true,
    createdAt: true,
    tripStartedAt: true,
    isLocationSharingActive: true,
    currentLatitude: true,
    currentLongitude: true,
    locationUpdatedAt: true,
    ride: { select: rideForBookingDetail },
    tripRequest: { select: tripRequestForBookingDetail },
    rider: {
        select: {
            clerkUserId: true,
            name: true,
        },
    },
    rating: {
        select: {
            id: true,
            score: true,
        },
    },
} satisfies Prisma.BookingSelect;

type BookingDetailRow = Prisma.BookingGetPayload<{
    select: typeof bookingDetailSelect;
}>;

function notFound() {
    return NextResponse.json(
        {
            error: "Not Found",
            code: "BOOKING_NOT_FOUND",
            message: "Booking not found.",
        },
        { status: 404 }
    );
}

function isParticipant(userId: string, booking: BookingDetailRow): boolean {
    if (booking.riderUserId === userId) {
        return true;
    }
    if (booking.driverUserId === userId) {
        return true;
    }
    if (booking.ride && booking.ride.driverUserId === userId) {
        return true;
    }
    return false;
}

/**
 * GET /api/bookings/:bookingId
 *
 * Full booking detail for confirmed participants (rider, driver, or ride owner).
 * Used by the confirmed trip page; non-participants receive 404.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { bookingId } = await params;
        const id = bookingId.trim();
        if (!id) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    code: "BOOKING_ID_REQUIRED",
                    message: "bookingId must be provided.",
                },
                { status: 400 }
            );
        }

        const booking = await prisma.booking.findUnique({
            where: { id },
            select: bookingDetailSelect,
        });

        if (!booking) {
            return notFound();
        }

        if (!isParticipant(auth.user.clerkUserId, booking)) {
            return notFound();
        }

        if (booking.rideId && !booking.ride) {
            return notFound();
        }
        if (booking.tripRequestId && !booking.tripRequest) {
            return notFound();
        }
        if (!booking.ride && !booking.tripRequest) {
            return notFound();
        }

        let tripRequestDriver: { clerkUserId: string; name: string | null } | null = null;
        if (booking.tripRequestId && booking.driverUserId) {
            const u = await prisma.user.findUnique({
                where: { clerkUserId: booking.driverUserId },
                select: { clerkUserId: true, name: true },
            });
            tripRequestDriver = u;
        }

        const userId = auth.user.clerkUserId;
        const driverId =
            booking.ride?.driverUserId ?? booking.driverUserId ?? null;
        const participantRole: "driver" | "rider" =
            driverId === userId ? "driver" : "rider";

        const isRide = Boolean(booking.ride);
        const originText = isRide
            ? booking.ride!.originText
            : booking.tripRequest!.originText;
        const originLatitude = isRide
            ? booking.ride!.originLatitude
            : booking.tripRequest!.originLatitude;
        const originLongitude = isRide
            ? booking.ride!.originLongitude
            : booking.tripRequest!.originLongitude;
        const destinationText = isRide
            ? booking.ride!.destinationText
            : booking.tripRequest!.destinationText;
        const destinationLatitude = isRide
            ? booking.ride!.destinationLatitude
            : booking.tripRequest!.destinationLatitude;
        const destinationLongitude = isRide
            ? booking.ride!.destinationLongitude
            : booking.tripRequest!.destinationLongitude;
        const startsAt = isRide
            ? booking.ride!.earliestDepartAt.toISOString()
            : booking.tripRequest!.earliestDesiredAt.toISOString();
        const endsAt = isRide
            ? booking.ride!.latestDepartAt.toISOString()
            : booking.tripRequest!.latestDesiredAt.toISOString();
        const preferredDepartAt = isRide
            ? booking.ride!.preferredDepartAt?.toISOString() ?? null
            : booking.tripRequest!.preferredDepartAt?.toISOString() ?? null;
        const distanceCategory = isRide
            ? booking.ride!.distanceCategory
            : booking.tripRequest!.distanceCategory;
        const pickupInstructions = isRide
            ? booking.ride!.pickupInstructions
            : booking.tripRequest!.pickupInstructions;
        const dropoffInstructions = isRide
            ? booking.ride!.dropoffInstructions
            : booking.tripRequest!.dropoffInstructions;
        const parentRideOrTripStatus = isRide
            ? booking.ride!.status
            : booking.tripRequest!.status;

        const driverName = isRide
            ? booking.ride!.driver.name
            : tripRequestDriver?.name ?? null;
        const driverClerkId = isRide
            ? booking.ride!.driverUserId
            : booking.driverUserId;

        const totalSeatsBooked = isRide
            ? Math.max(0, booking.ride!.seatsTotal - booking.ride!.seatsAvailable)
            : booking.seatsBooked;

        const canRate =
            booking.status === "COMPLETED" &&
            userId === booking.riderUserId &&
            !booking.rating;

        return NextResponse.json({
            booking: {
                id: booking.id,
                status: booking.status,
                seatsBooked: booking.seatsBooked,
                totalSeatsBooked,
                priceCents: booking.priceCents,
                completedAt: booking.completedAt?.toISOString() ?? null,
                tripStartedAt: booking.tripStartedAt?.toISOString() ?? null,
                isLocationSharingActive: booking.isLocationSharingActive,
                currentLatitude: booking.currentLatitude,
                currentLongitude: booking.currentLongitude,
                locationUpdatedAt: booking.locationUpdatedAt?.toISOString() ?? null,
                createdAt: booking.createdAt.toISOString(),
            },
            participantRole,
            source: isRide ? "ride" : "trip_request",
            parentStatus: parentRideOrTripStatus,
            rider: {
                clerkUserId: booking.rider.clerkUserId,
                name: booking.rider.name,
            },
            driver: driverClerkId
                ? {
                      clerkUserId: driverClerkId,
                      name: driverName,
                  }
                : null,
            route: {
                originText,
                originLatitude,
                originLongitude,
                destinationText,
                destinationLatitude,
                destinationLongitude,
                startsAt,
                endsAt,
                preferredDepartAt,
                distanceCategory,
                pickupInstructions,
                dropoffInstructions,
            },
            preferences: isRide
                ? {
                      hasAc: booking.ride!.hasAc,
                      hasTrunkSpace: booking.ride!.hasTrunkSpace,
                      musicPreference: booking.ride!.musicPreference,
                      vehicleType: booking.ride!.vehicleType,
                  }
                : {
                      hasAc: null,
                      hasTrunkSpace: null,
                      musicPreference: null,
                      vehicleType: null,
                  },
            hasRating: Boolean(booking.rating),
            canRate,
        });
    } catch (error) {
        console.error("[GET /api/bookings/:bookingId] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while loading the booking.",
            },
            { status: 500 }
        );
    }
}
