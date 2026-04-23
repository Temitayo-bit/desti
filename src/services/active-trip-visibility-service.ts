import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const activeTripBookingSelect = {
    id: true,
    rideId: true,
    riderUserId: true,
    driverUserId: true,
    currentLatitude: true,
    currentLongitude: true,
    locationUpdatedAt: true,
    tripStartedAt: true,
    isLocationSharingActive: true,
    status: true,
    ride: {
        select: {
            id: true,
            driverUserId: true,
            status: true,
        },
    },
} satisfies Prisma.BookingSelect;

export type ActiveTripBookingRecord = Prisma.BookingGetPayload<{
    select: typeof activeTripBookingSelect;
}>;

export interface ActiveTripBookingContext {
    booking: ActiveTripBookingRecord;
    driverUserId: string | null;
    isActiveWindow: boolean;
}

export function getBookingDriverUserId(
    booking: ActiveTripBookingRecord
): string | null {
    if (booking.driverUserId) {
        return booking.driverUserId;
    }

    if (booking.ride?.driverUserId) {
        return booking.ride.driverUserId;
    }

    return null;
}

export function isBookingInActiveWindow(booking: ActiveTripBookingRecord): boolean {
    if (booking.status !== "CONFIRMED") {
        return false;
    }

    if (booking.ride && booking.ride.status !== "ACTIVE") {
        return false;
    }

    return true;
}

export function toActiveTripBookingContext(
    booking: ActiveTripBookingRecord
): ActiveTripBookingContext {
    return {
        booking,
        driverUserId: getBookingDriverUserId(booking),
        isActiveWindow: isBookingInActiveWindow(booking),
    };
}

export function isUserBookingParticipant(
    userId: string,
    context: ActiveTripBookingContext
): boolean {
    return userId === context.booking.riderUserId || userId === context.driverUserId;
}

export function canUserAccessActiveTripDataInBookingContext(
    userId: string,
    context: ActiveTripBookingContext
): boolean {
    if (!context.isActiveWindow) {
        return false;
    }

    if (!context.driverUserId) {
        return false;
    }

    return isUserBookingParticipant(userId, context);
}

export async function getActiveTripBookingContext(
    bookingId: string
): Promise<ActiveTripBookingContext | null> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: activeTripBookingSelect,
    });

    if (!booking) {
        return null;
    }

    return toActiveTripBookingContext(booking);
}

/**
 * True only when user is a participant (driver or rider) on an active booking.
 */
export async function canUserAccessActiveTripDataByBooking(
    userId: string,
    bookingId: string
): Promise<boolean> {
    const context = await getActiveTripBookingContext(bookingId);
    if (!context) {
        return false;
    }

    return canUserAccessActiveTripDataInBookingContext(userId, context);
}

/**
 * True only when user is a participant in an active ride with at least one
 * confirmed booking participant.
 */
export async function canUserAccessActiveTripDataByRide(
    userId: string,
    rideId: string
): Promise<boolean> {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: {
            id: true,
            driverUserId: true,
            status: true,
            bookings: {
                where: {
                    status: "CONFIRMED",
                },
                select: {
                    riderUserId: true,
                },
            },
        },
    });

    if (!ride || ride.status !== "ACTIVE") {
        return false;
    }

    if (ride.bookings.length === 0) {
        return false;
    }

    if (ride.driverUserId === userId) {
        return true;
    }

    return ride.bookings.some((booking) => booking.riderUserId === userId);
}
