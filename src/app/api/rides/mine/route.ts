import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ConfirmedBookingSummary } from "@/types/booking";

const rideSummarySelect = {
  id: true,
  driverUserId: true,
  originText: true,
  destinationText: true,
  earliestDepartAt: true,
  latestDepartAt: true,
  distanceCategory: true,
  priceCents: true,
  seatsTotal: true,
  seatsAvailable: true,
  musicPreference: true,
  hasAc: true,
  hasTrunkSpace: true,
  vehicleType: true,
  pickupInstructions: true,
  dropoffInstructions: true,
  preferredDepartAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RideSelect;

const confirmedRideBookingSelect = {
  id: true,
  rideId: true,
  riderUserId: true,
  driverUserId: true,
  seatsBooked: true,
  ride: {
    select: {
      earliestDepartAt: true,
      latestDepartAt: true,
    },
  },
} satisfies Prisma.BookingSelect;

type RideSummaryItem = Prisma.RideGetPayload<{
  select: typeof rideSummarySelect;
}>;

type ConfirmedRideBookingItem = Prisma.BookingGetPayload<{
  select: typeof confirmedRideBookingSelect;
}>;

/**
 * GET /api/rides/mine
 *
 * Returns rides owned by the authenticated driver.
 * Includes both past and upcoming rides.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStetsonAuth(request);
    if (auth.error) return auth.error;

    const driverUserId = auth.user.clerkUserId;

    const items: RideSummaryItem[] = await prisma.ride.findMany({
      where: {
        driverUserId,
        status: "ACTIVE",
      },
      orderBy: [{ earliestDepartAt: "desc" }, { id: "desc" }],
      select: rideSummarySelect,
    });

    const rideIds = items.map((ride) => ride.id);
    const confirmedBookings: ConfirmedRideBookingItem[] =
      rideIds.length === 0
        ? []
        : await prisma.booking.findMany({
            where: {
              status: "CONFIRMED",
              rideId: {
                in: rideIds,
              },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: confirmedRideBookingSelect,
          });

    const confirmedByRideId = new Map<string, ConfirmedBookingSummary[]>();
    for (const booking of confirmedBookings) {
      if (!booking.rideId || !booking.ride) continue;

      const existing = confirmedByRideId.get(booking.rideId) ?? [];
      existing.push({
        id: booking.id,
        riderUserId: booking.riderUserId,
        driverUserId: booking.driverUserId,
        seatsBooked: booking.seatsBooked,
        startsAt: booking.ride.earliestDepartAt.toISOString(),
        endsAt: booking.ride.latestDepartAt.toISOString(),
      });
      confirmedByRideId.set(booking.rideId, existing);
    }

    return NextResponse.json({
      items: items.map((ride) => ({
        ...ride,
        confirmedBookings: confirmedByRideId.get(ride.id) ?? [],
      })),
      nextCursor: null,
    });
  } catch (error) {
    console.error("[GET /api/rides/mine] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while fetching your rides.",
      },
      { status: 500 },
    );
  }
}
