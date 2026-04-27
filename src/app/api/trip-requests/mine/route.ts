import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ConfirmedBookingSummary } from "@/types/booking";

const tripRequestSummarySelect = {
    id: true,
    riderUserId: true,
    originText: true,
    destinationText: true,
    originLatitude: true,
    originLongitude: true,
    destinationLatitude: true,
    destinationLongitude: true,
    earliestDesiredAt: true,
    latestDesiredAt: true,
    distanceCategory: true,
    seatsNeeded: true,
    pickupInstructions: true,
    dropoffInstructions: true,
    preferredDepartAt: true,
    status: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.TripRequestSelect;

const confirmedTripRequestBookingSelect = {
    id: true,
    tripRequestId: true,
    riderUserId: true,
    driverUserId: true,
    seatsBooked: true,
    tripRequest: {
        select: {
            earliestDesiredAt: true,
            latestDesiredAt: true,
        },
    },
} satisfies Prisma.BookingSelect;

type TripRequestSummaryItem = Prisma.TripRequestGetPayload<{
    select: typeof tripRequestSummarySelect;
}>;

type ConfirmedTripRequestBookingItem = Prisma.BookingGetPayload<{
    select: typeof confirmedTripRequestBookingSelect;
}>;

/**
 * GET /api/trip-requests/mine
 *
 * Returns non-cancelled trip requests owned by the authenticated rider.
 * Includes both upcoming and past trip requests.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const riderUserId = auth.user.clerkUserId;

        const items: TripRequestSummaryItem[] = await prisma.tripRequest.findMany({
            where: {
                riderUserId,
                status: {
                    not: "CANCELLED",
                },
            },
            orderBy: [{ earliestDesiredAt: "desc" }, { id: "desc" }],
            select: tripRequestSummarySelect,
        });

        const now = new Date();
        const tripRequestIds = items.map((tripRequest) => tripRequest.id);
        const confirmedBookings: ConfirmedTripRequestBookingItem[] =
            tripRequestIds.length === 0
                ? []
                : await prisma.booking.findMany({
                      where: {
                          status: "CONFIRMED",
                          tripRequestId: {
                              in: tripRequestIds,
                          },
                          tripRequest: {
                              latestDesiredAt: {
                                  gt: now,
                              },
                          },
                      },
                      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                      select: confirmedTripRequestBookingSelect,
                  });

        const confirmedByTripRequestId = new Map<string, ConfirmedBookingSummary[]>();
        for (const booking of confirmedBookings) {
            if (!booking.tripRequestId || !booking.tripRequest) continue;

            const existing = confirmedByTripRequestId.get(booking.tripRequestId) ?? [];
            existing.push({
                id: booking.id,
                riderUserId: booking.riderUserId,
                driverUserId: booking.driverUserId,
                seatsBooked: booking.seatsBooked,
                startsAt: booking.tripRequest.earliestDesiredAt.toISOString(),
                endsAt: booking.tripRequest.latestDesiredAt.toISOString(),
            });
            confirmedByTripRequestId.set(booking.tripRequestId, existing);
        }

        return NextResponse.json({
            items: items.map((tripRequest) => ({
                ...tripRequest,
                confirmedBookings: confirmedByTripRequestId.get(tripRequest.id) ?? [],
            })),
            nextCursor: null,
        });
    } catch (error) {
        console.error("[GET /api/trip-requests/mine] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message:
                    "An unexpected error occurred while fetching your trip requests.",
            },
            { status: 500 }
        );
    }
}
