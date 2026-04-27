import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/* ── Select shapes ────────────────────────────────────────────────────────── */

const rideSummarySelect = {
  id: true,
  originText: true,
  destinationText: true,
  earliestDepartAt: true,
  latestDepartAt: true,
  preferredDepartAt: true,
  distanceCategory: true,
  priceCents: true,
  seatsTotal: true,
  seatsAvailable: true,
  status: true,
  hasAc: true,
  hasTrunkSpace: true,
  musicPreference: true,
  vehicleType: true,
} satisfies Prisma.RideSelect;

const rideInBookingSelect = {
  id: true,
  driverUserId: true,
  originText: true,
  destinationText: true,
  earliestDepartAt: true,
  latestDepartAt: true,
  preferredDepartAt: true,
  distanceCategory: true,
  priceCents: true,
  seatsTotal: true,
  seatsAvailable: true,
  status: true,
  vehicleType: true,
  driver: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.RideSelect;

const tripRequestSummarySelect = {
  id: true,
  originText: true,
  destinationText: true,
  earliestDesiredAt: true,
  latestDesiredAt: true,
  preferredDepartAt: true,
  distanceCategory: true,
  seatsNeeded: true,
  status: true,
} satisfies Prisma.TripRequestSelect;

const offerSummarySelect = {
  id: true,
  tripRequestId: true,
  driverUserId: true,
  riderUserId: true,
  seatsOffered: true,
  priceCents: true,
  message: true,
  status: true,
  createdAt: true,
  tripRequest: { select: tripRequestSummarySelect },
  driver: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.OfferSelect;

/* ── GET /api/dashboard ───────────────────────────────────────────────────── */

/**
 * GET /api/dashboard
 *
 * Returns a unified "what's coming up" dashboard for the authenticated user:
 * - Active rides they are driving
 * - Confirmed bookings (ride-based and triprequest-based, upcoming only)
 * - Pending offers sent
 * - Pending offers received
 *
 * Each list is capped at 5 items.
 * Counts reflect the full untruncated totals.
 */
export async function GET(request?: NextRequest) {
  try {
    const auth = await requireStetsonAuth(
      request ?? { method: "GET", pathname: "/api/dashboard" }
    );
    if (auth.error) return auth.error;

    const userId = auth.user.clerkUserId;
    const now = new Date();

    const [
      activeRidesDrivingCount,
      ridesDriving,
      rideBookingsCount,
      rideBookings,
      tripRequestBookingsCount,
      tripRequestBookings,
      passengerBookingsCount,
      pendingOffersSentCount,
      offersSent,
      pendingOffersReceivedCount,
      offersReceived,
    ] = await Promise.all([
      prisma.ride.count({
        where: {
          driverUserId: userId,
          status: "ACTIVE",
          latestDepartAt: { gt: now },
        },
      }),

      prisma.ride.findMany({
        where: {
          driverUserId: userId,
          status: "ACTIVE",
          latestDepartAt: { gt: now },
        },
        select: rideSummarySelect,
        orderBy: [{ earliestDepartAt: "asc" }, { id: "asc" }],
        take: 5,
      }),

      prisma.booking.count({
        where: {
          status: "CONFIRMED",
          rideId: { not: null },
          ride: { latestDepartAt: { gt: now } },
          OR: [{ riderUserId: userId }, { ride: { driverUserId: userId } }],
        },
      }),

      prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          rideId: { not: null },
          ride: { latestDepartAt: { gt: now } },
          OR: [{ riderUserId: userId }, { ride: { driverUserId: userId } }],
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
        orderBy: [{ ride: { earliestDepartAt: "asc" } }, { id: "asc" }],
        take: 5,
      }),

      prisma.booking.count({
        where: {
          status: "CONFIRMED",
          tripRequestId: { not: null },
          tripRequest: { latestDesiredAt: { gt: now } },
          OR: [{ riderUserId: userId }, { driverUserId: userId }],
        },
      }),

      prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          tripRequestId: { not: null },
          tripRequest: { latestDesiredAt: { gt: now } },
          OR: [{ riderUserId: userId }, { driverUserId: userId }],
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
        orderBy: [{ tripRequest: { earliestDesiredAt: "asc" } }, { id: "asc" }],
        take: 5,
      }),

      prisma.booking.count({
        where: {
          status: "CONFIRMED",
          riderUserId: userId,
          OR: [
            {
              rideId: { not: null },
              ride: { latestDepartAt: { gt: now } },
            },
            {
              tripRequestId: { not: null },
              tripRequest: { latestDesiredAt: { gt: now } },
            },
          ],
        },
      }),

      prisma.offer.count({
        where: {
          driverUserId: userId,
          status: "PENDING",
          tripRequest: { latestDesiredAt: { gt: now } },
        },
      }),

      prisma.offer.findMany({
        where: {
          driverUserId: userId,
          status: "PENDING",
          tripRequest: { latestDesiredAt: { gt: now } },
        },
        select: offerSummarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),

      prisma.offer.count({
        where: {
          riderUserId: userId,
          status: "PENDING",
          tripRequest: { latestDesiredAt: { gt: now } },
        },
      }),

      prisma.offer.findMany({
        where: {
          riderUserId: userId,
          status: "PENDING",
          tripRequest: { latestDesiredAt: { gt: now } },
        },
        select: offerSummarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
    ]);

    const tripRequestDriverUserIds = Array.from(
      new Set(
        tripRequestBookings
          .map((booking) => booking.driverUserId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const tripRequestDrivers =
      tripRequestDriverUserIds.length > 0
        ? await prisma.user.findMany({
            where: {
              clerkUserId: {
                in: tripRequestDriverUserIds,
              },
            },
            select: {
              clerkUserId: true,
              name: true,
            },
          })
        : [];

    const tripRequestDriverNameByUserId = new Map(
      tripRequestDrivers.map((user) => [user.clerkUserId, user.name ?? null])
    );

    type RideBookingWithRide = (typeof rideBookings)[number] & {
      ride: NonNullable<(typeof rideBookings)[number]["ride"]>;
    };

    const rideBookingsWithRide = rideBookings.filter(
      (booking): booking is RideBookingWithRide => booking.ride !== null
    );

    const serializedRideBookings = rideBookingsWithRide.map((booking) => ({
      ...booking,
      ride: {
        id: booking.ride.id,
        driverUserId: booking.ride.driverUserId,
        originText: booking.ride.originText,
        destinationText: booking.ride.destinationText,
        earliestDepartAt: booking.ride.earliestDepartAt,
        latestDepartAt: booking.ride.latestDepartAt,
        preferredDepartAt: booking.ride.preferredDepartAt,
        distanceCategory: booking.ride.distanceCategory,
        priceCents: booking.ride.priceCents,
        seatsTotal: booking.ride.seatsTotal,
        seatsAvailable: booking.ride.seatsAvailable,
        status: booking.ride.status,
        driverName: booking.ride.driver?.name ?? null,
        vehicleType: booking.ride.vehicleType,
      },
    }));

    type TripRequestBookingWithTripRequest = (typeof tripRequestBookings)[number] & {
      tripRequest: NonNullable<(typeof tripRequestBookings)[number]["tripRequest"]>;
    };

    const tripRequestBookingsWithTripRequest = tripRequestBookings.filter(
      (booking): booking is TripRequestBookingWithTripRequest =>
        booking.tripRequest !== null
    );

    const serializedTripRequestBookings = tripRequestBookingsWithTripRequest.map(
      (booking) => ({
        ...booking,
        tripRequest: {
          id: booking.tripRequest.id,
          originText: booking.tripRequest.originText,
          destinationText: booking.tripRequest.destinationText,
          earliestDesiredAt: booking.tripRequest.earliestDesiredAt,
          latestDesiredAt: booking.tripRequest.latestDesiredAt,
          preferredDepartAt: booking.tripRequest.preferredDepartAt,
          distanceCategory: booking.tripRequest.distanceCategory,
          seatsNeeded: booking.tripRequest.seatsNeeded,
          status: booking.tripRequest.status,
          driverName: booking.driverUserId
            ? (tripRequestDriverNameByUserId.get(booking.driverUserId) ?? null)
            : null,
        },
      })
    );

    type RideBooking = (typeof serializedRideBookings)[number];
    type TripRequestBooking = (typeof serializedTripRequestBookings)[number];
    type MergedBooking = RideBooking | TripRequestBooking;

    function getBookingEarliest(b: MergedBooking): Date {
      if ("ride" in b && b.ride) {
        return b.ride.earliestDepartAt;
      }
      if ("tripRequest" in b && b.tripRequest) {
        return b.tripRequest.earliestDesiredAt;
      }
      return new Date(0);
    }

    const mergedBookings: MergedBooking[] = [
      ...serializedRideBookings,
      ...serializedTripRequestBookings,
    ]
      .sort((a, b) => {
        const timeA = getBookingEarliest(a).getTime();
        const timeB = getBookingEarliest(b).getTime();

        if (timeA !== timeB) return timeA - timeB;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      })
      .slice(0, 5);

    const confirmedBookingsCount =
      rideBookingsCount + tripRequestBookingsCount;

    return NextResponse.json({
      now: now.toISOString(),
      summary: {
        activeRidesDrivingCount,
        confirmedBookingsCount,
        passengerBookingsCount,
        pendingOffersSentCount,
        pendingOffersReceivedCount,
      },
      upcoming: {
        ridesDriving,
        bookings: mergedBookings,
        offers: {
          sent: offersSent,
          received: offersReceived,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/dashboard] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
