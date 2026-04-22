import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const activeTripBookingSelect = {
    id: true,
    rideId: true,
    riderUserId: true,
    driverUserId: true,
    status: true,
    ride: {
        select: {
            id: true,
            driverUserId: true,
            status: true,
        },
    },
} satisfies Prisma.BookingSelect;

type ActiveTripBookingRecord = Prisma.BookingGetPayload<{
    select: typeof activeTripBookingSelect;
}>;

function getBookingDriverUserId(booking: ActiveTripBookingRecord): string | null {
    if (booking.driverUserId) {
        return booking.driverUserId;
    }

    if (booking.ride?.driverUserId) {
        return booking.ride.driverUserId;
    }

    return null;
}

function isBookingInActiveWindow(booking: ActiveTripBookingRecord): boolean {
    if (booking.status !== "CONFIRMED") {
        return false;
    }

    if (booking.ride && booking.ride.status !== "ACTIVE") {
        return false;
    }

    return true;
}

/**
 * True only when user is a participant (driver or rider) on an active booking.
 */
export async function canUserAccessActiveTripDataByBooking(
    userId: string,
    bookingId: string
): Promise<boolean> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: activeTripBookingSelect,
    });

    if (!booking || !isBookingInActiveWindow(booking)) {
        return false;
    }

    const driverUserId = getBookingDriverUserId(booking);
    if (!driverUserId) {
        return false;
    }

    return userId === booking.riderUserId || userId === driverUserId;
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
