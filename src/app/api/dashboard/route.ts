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

        // ── Run all queries in parallel ──────────────────────────────────

        const [
            activeRidesDrivingCount,
            ridesDriving,
            rideBookingsCount,
            rideBookings,
            tripRequestBookingsCount,
            tripRequestBookings,
            pendingOffersSentCount,
            offersSent,
            pendingOffersReceivedCount,
            offersReceived,
        ] = await Promise.all([
            // ── Active rides driving: count ──────────────────────────────
            prisma.ride.count({
                where: {
                    driverUserId: userId,
                    status: "ACTIVE",
                    latestDepartAt: { gt: now },
                },
            }),

            // ── Active rides driving: list (max 5) ──────────────────────
            prisma.ride.findMany({
                where: {
                    driverUserId: userId,
                    status: "ACTIVE",
                    latestDepartAt: { gt: now },
                },
                select: rideSummarySelect,
                orderBy: [
                    { earliestDepartAt: "asc" },
                    { id: "asc" },
                ],
                take: 5,
            }),

            // ── Confirmed ride-based bookings: count ─────────────────────
            prisma.booking.count({
                where: {
                    status: "CONFIRMED",
                    rideId: { not: null },
                    ride: { latestDepartAt: { gt: now } },
                    OR: [
                        { riderUserId: userId },
                        // Include driver-side confirmations for ride bookings.
                        { ride: { driverUserId: userId } },
                    ],
                },
            }),

            // ── Confirmed ride-based bookings: list (max 5) ──────────────
            prisma.booking.findMany({
                where: {
                    status: "CONFIRMED",
                    rideId: { not: null },
                    ride: { latestDepartAt: { gt: now } },
                    OR: [
                        { riderUserId: userId },
                        // Include driver-side confirmations for ride bookings.
                        { ride: { driverUserId: userId } },
                    ],
                },
                select: {
                    id: true,
                    riderUserId: true,
                    driverUserId: true,
                    status: true,
                    seatsBooked: true,
                    createdAt: true,
                    ride: { select: rideInBookingSelect },
                },
                orderBy: [
                    { ride: { earliestDepartAt: "asc" } },
                    { id: "asc" },
                ],
                take: 5,
            }),

            // ── Confirmed triprequest-based bookings: count ──────────────
            prisma.booking.count({
                where: {
                    status: "CONFIRMED",
                    tripRequestId: { not: null },
                    tripRequest: { latestDesiredAt: { gt: now } },
                    OR: [
                        { riderUserId: userId },
                        // Include driver-side confirmations for offer->booking flows.
                        { driverUserId: userId },
                    ],
                },
            }),

            // ── Confirmed triprequest-based bookings: list (max 5) ───────
            prisma.booking.findMany({
                where: {
                    status: "CONFIRMED",
                    tripRequestId: { not: null },
                    tripRequest: { latestDesiredAt: { gt: now } },
                    OR: [
                        { riderUserId: userId },
                        // Include driver-side confirmations for offer->booking flows.
                        { driverUserId: userId },
                    ],
                },
                select: {
                    id: true,
                    riderUserId: true,
                    driverUserId: true,
                    status: true,
                    seatsBooked: true,
                    createdAt: true,
                    tripRequest: { select: tripRequestSummarySelect },
                },
                orderBy: [
                    { tripRequest: { earliestDesiredAt: "asc" } },
                    { id: "asc" },
                ],
                take: 5,
            }),

            // ── Pending offers sent: count ───────────────────────────────
            prisma.offer.count({
                where: {
                    driverUserId: userId,
                    status: "PENDING",
                    tripRequest: { latestDesiredAt: { gt: now } },
                },
            }),

            // ── Pending offers sent: list (max 5) ────────────────────────
            prisma.offer.findMany({
                where: {
                    driverUserId: userId,
                    status: "PENDING",
                    tripRequest: { latestDesiredAt: { gt: now } },
                },
                select: offerSummarySelect,
                orderBy: [
                    { createdAt: "desc" },
                    { id: "desc" },
                ],
                take: 5,
            }),

            // ── Pending offers received: count ───────────────────────────
            prisma.offer.count({
                where: {
                    riderUserId: userId,
                    status: "PENDING",
                    tripRequest: { latestDesiredAt: { gt: now } },
                },
            }),

            // ── Pending offers received: list (max 5) ────────────────────
            prisma.offer.findMany({
                where: {
                    riderUserId: userId,
                    status: "PENDING",
                    tripRequest: { latestDesiredAt: { gt: now } },
                },
                select: offerSummarySelect,
                orderBy: [
                    { createdAt: "desc" },
                    { id: "desc" },
                ],
                take: 5,
            }),
        ]);

        // ── Merge ride-based + triprequest-based bookings ────────────────
        //
        // Both types are fetched separately (to filter on different timestamp
        // columns in the DB). Merge, sort by earliest* ASC + id ASC, take 5.

        type RideBooking = (typeof rideBookings)[number];
        type TripRequestBooking = (typeof tripRequestBookings)[number];
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

        const mergedBookings: MergedBooking[] = [...rideBookings, ...tripRequestBookings]
            .sort((a, b) => {
                const timeA = getBookingEarliest(a).getTime();
                const timeB = getBookingEarliest(b).getTime();
                if (timeA !== timeB) return timeA - timeB;
                return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
            })
            .slice(0, 5);

        const confirmedBookingsCount = rideBookingsCount + tripRequestBookingsCount;

        return NextResponse.json({
            now: now.toISOString(),
            summary: {
                activeRidesDrivingCount,
                confirmedBookingsCount,
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
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
