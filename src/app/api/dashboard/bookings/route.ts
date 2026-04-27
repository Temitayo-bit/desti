import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rideInBookingSelect = {
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
} satisfies Prisma.RideSelect;

const tripRequestSummarySelect = {
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
} satisfies Prisma.TripRequestSelect;

/**
 * GET /api/dashboard/bookings
 *
 * Returns upcoming confirmed trips the caller participates in as rider or driver
 * (ride-linked rows require latestDepartAt in the future; trip-request rows use
 * latestDesiredAt). No 5-item cap.
 */
export async function GET(request?: NextRequest) {
    try {
        const auth = await requireStetsonAuth(
            request ?? { method: "GET", pathname: "/api/dashboard/bookings" }
        );
        if (auth.error) return auth.error;

        const userId = auth.user.clerkUserId;
        const now = new Date();

        const [rideBookings, tripRequestBookings] = await Promise.all([
            prisma.booking.findMany({
                where: {
                    status: "CONFIRMED",
                    rideId: { not: null },
                    ride: { latestDepartAt: { gt: now } },
                    OR: [
                        { riderUserId: userId },
                        { ride: { driverUserId: userId } },
                    ],
                },
                select: {
                    id: true,
                    riderUserId: true,
                    driverUserId: true,
                    status: true,
                    seatsBooked: true,
                    priceCents: true,
                    createdAt: true,
                    ride: { select: rideInBookingSelect },
                },
                orderBy: [
                    { ride: { earliestDepartAt: "asc" } },
                    { id: "asc" },
                ],
            }),
            prisma.booking.findMany({
                where: {
                    status: "CONFIRMED",
                    tripRequestId: { not: null },
                    tripRequest: { latestDesiredAt: { gt: now } },
                    OR: [
                        { riderUserId: userId },
                        { driverUserId: userId },
                    ],
                },
                select: {
                    id: true,
                    riderUserId: true,
                    driverUserId: true,
                    status: true,
                    seatsBooked: true,
                    priceCents: true,
                    createdAt: true,
                    tripRequest: { select: tripRequestSummarySelect },
                },
                orderBy: [
                    { tripRequest: { earliestDesiredAt: "asc" } },
                    { id: "asc" },
                ],
            }),
        ]);

        type RideBooking = (typeof rideBookings)[number];
        type TripRequestBooking = (typeof tripRequestBookings)[number];
        type MergedBooking = RideBooking | TripRequestBooking;

        function getBookingEarliest(booking: MergedBooking): Date {
            if ("ride" in booking && booking.ride) {
                return booking.ride.earliestDepartAt;
            }

            if ("tripRequest" in booking && booking.tripRequest) {
                return booking.tripRequest.earliestDesiredAt;
            }

            return new Date(0);
        }

        const items: MergedBooking[] = [...rideBookings, ...tripRequestBookings].sort(
            (a, b) => {
                const timeA = getBookingEarliest(a).getTime();
                const timeB = getBookingEarliest(b).getTime();

                if (timeA !== timeB) {
                    return timeA - timeB;
                }

                return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
            }
        );

        return NextResponse.json({
            now: now.toISOString(),
            items,
        });
    } catch (error) {
        console.error("[GET /api/dashboard/bookings] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching dashboard bookings.",
            },
            { status: 500 }
        );
    }
}
