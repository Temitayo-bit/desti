import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────────────
const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockPrisma: {
            ride: { count: vi.fn(), findMany: vi.fn() },
            booking: { count: vi.fn(), findMany: vi.fn() },
            offer: { count: vi.fn(), findMany: vi.fn() },
        },
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import { GET } from "@/app/api/dashboard/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = "user_driver1";

function successAuth(userId = USER_ID) {
    return {
        user: { clerkUserId: userId, primaryStetsonEmail: "test@stetson.edu" },
    };
}

const FUTURE = new Date(Date.now() + 86400000); // tomorrow

function fakeRide(overrides: Record<string, unknown> = {}) {
    return {
        id: "ride-1",
        originText: "Library",
        destinationText: "Walmart",
        earliestDepartAt: FUTURE,
        latestDepartAt: new Date(FUTURE.getTime() + 3600000),
        preferredDepartAt: FUTURE,
        distanceCategory: "MEDIUM",
        priceCents: 400,
        seatsTotal: 4,
        seatsAvailable: 3,
        status: "ACTIVE",
        ...overrides,
    };
}

function fakeRideBooking(id: string, earliestDepartAt: Date) {
    return {
        id,
        status: "CONFIRMED",
        seatsBooked: 1,
        createdAt: new Date(),
        ride: {
            id: `ride-for-${id}`,
            originText: "Campus",
            destinationText: "Mall",
            earliestDepartAt,
            latestDepartAt: new Date(earliestDepartAt.getTime() + 3600000),
            preferredDepartAt: earliestDepartAt,
            distanceCategory: "SHORT",
            priceCents: 300,
            status: "ACTIVE",
        },
    };
}

function fakeTripRequestBooking(id: string, earliestDesiredAt: Date) {
    return {
        id,
        status: "CONFIRMED",
        seatsBooked: 1,
        createdAt: new Date(),
        tripRequest: {
            id: `tr-for-${id}`,
            originText: "Dorm",
            destinationText: "Airport",
            earliestDesiredAt,
            latestDesiredAt: new Date(earliestDesiredAt.getTime() + 3600000),
            preferredDepartAt: earliestDesiredAt,
            distanceCategory: "LONG",
            seatsNeeded: 1,
            status: "ACTIVE",
        },
    };
}

function fakeOffer(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        tripRequestId: "tr-1",
        driverUserId: USER_ID,
        riderUserId: "user_rider1",
        seatsOffered: 2,
        priceCents: 500,
        message: null,
        status: "PENDING",
        createdAt: new Date(),
        tripRequest: {
            id: "tr-1",
            originText: "Campus",
            destinationText: "Beach",
            earliestDesiredAt: FUTURE,
            latestDesiredAt: new Date(FUTURE.getTime() + 3600000),
            preferredDepartAt: FUTURE,
            distanceCategory: "MEDIUM",
            seatsNeeded: 2,
            status: "ACTIVE",
        },
        ...overrides,
    };
}

/**
 * Sets up default mock return values for all Prisma calls.
 * The dashboard issues 10 parallel queries in this order:
 *   ride.count, ride.findMany,
 *   booking.count (×2), booking.findMany (×2),
 *   offer.count (×2), offer.findMany (×2)
 */
function setupDefaults({
    rideCount = 0,
    rides = [] as unknown[],
    rideBookingCount = 0,
    rideBookings = [] as unknown[],
    tripRequestBookingCount = 0,
    tripRequestBookings = [] as unknown[],
    offerSentCount = 0,
    offersSent = [] as unknown[],
    offerReceivedCount = 0,
    offersReceived = [] as unknown[],
} = {}) {
    mockPrisma.ride.count.mockResolvedValue(rideCount);
    mockPrisma.ride.findMany.mockResolvedValue(rides);
    mockPrisma.booking.count
        .mockResolvedValueOnce(rideBookingCount)
        .mockResolvedValueOnce(tripRequestBookingCount);
    mockPrisma.booking.findMany
        .mockResolvedValueOnce(rideBookings)
        .mockResolvedValueOnce(tripRequestBookings);
    mockPrisma.offer.count
        .mockResolvedValueOnce(offerSentCount)
        .mockResolvedValueOnce(offerReceivedCount);
    mockPrisma.offer.findMany
        .mockResolvedValueOnce(offersSent)
        .mockResolvedValueOnce(offersReceived);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/dashboard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
    });

    // ── 0. Auth failure paths ────────────────────────────────────────────

    it("returns auth error and skips Prisma when auth returns 401", async () => {
        const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        mockRequireStetsonAuth.mockResolvedValue({ error: errorResponse });

        const res = await GET();
        expect(res.status).toBe(401);

        expect(mockPrisma.ride.count).not.toHaveBeenCalled();
        expect(mockPrisma.ride.findMany).not.toHaveBeenCalled();
        expect(mockPrisma.booking.count).not.toHaveBeenCalled();
        expect(mockPrisma.offer.count).not.toHaveBeenCalled();
    });

    it("returns auth error and skips Prisma when auth returns 403", async () => {
        const errorResponse = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        mockRequireStetsonAuth.mockResolvedValue({ error: errorResponse });

        const res = await GET();
        expect(res.status).toBe(403);

        expect(mockPrisma.ride.count).not.toHaveBeenCalled();
        expect(mockPrisma.offer.findMany).not.toHaveBeenCalled();
    });

    // ── 1. Correct counts and lists ──────────────────────────────────────

    it("returns correct counts and lists when user has items in all categories", async () => {
        const ride = fakeRide();
        const rideBooking = fakeRideBooking("bk-1", FUTURE);
        const tripRequestBooking = fakeTripRequestBooking("bk-2", new Date(FUTURE.getTime() + 1000));
        const offerSent = fakeOffer("of-1");
        const offerReceived = fakeOffer("of-2", { riderUserId: USER_ID, driverUserId: "other" });

        setupDefaults({
            rideCount: 1,
            rides: [ride],
            rideBookingCount: 1,
            rideBookings: [rideBooking],
            tripRequestBookingCount: 1,
            tripRequestBookings: [tripRequestBooking],
            offerSentCount: 1,
            offersSent: [offerSent],
            offerReceivedCount: 1,
            offersReceived: [offerReceived],
        });

        const res = await GET();
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.summary.activeRidesDrivingCount).toBe(1);
        expect(json.summary.confirmedBookingsCount).toBe(2);
        expect(json.summary.pendingOffersSentCount).toBe(1);
        expect(json.summary.pendingOffersReceivedCount).toBe(1);

        expect(json.upcoming.ridesDriving).toHaveLength(1);
        expect(json.upcoming.ridesDriving[0].id).toBe("ride-1");

        expect(json.upcoming.bookings).toHaveLength(2);
        expect(json.upcoming.bookings[0].id).toBe("bk-1"); // earlier departure first

        expect(json.upcoming.offers.sent).toHaveLength(1);
        expect(json.upcoming.offers.received).toHaveLength(1);
    });

    // ── 2. Empty state ───────────────────────────────────────────────────

    it("returns zeros and empty arrays when user has nothing", async () => {
        setupDefaults();

        const res = await GET();
        const json = await res.json();

        expect(json.summary.activeRidesDrivingCount).toBe(0);
        expect(json.summary.confirmedBookingsCount).toBe(0);
        expect(json.summary.pendingOffersSentCount).toBe(0);
        expect(json.summary.pendingOffersReceivedCount).toBe(0);

        expect(json.upcoming.ridesDriving).toEqual([]);
        expect(json.upcoming.bookings).toEqual([]);
        expect(json.upcoming.offers.sent).toEqual([]);
        expect(json.upcoming.offers.received).toEqual([]);
    });

    // ── 3. Stale items are excluded via DB filters ───────────────────────
    //    (verified by checking filter arguments passed to Prisma)

    it("passes latestDepartAt > now filter to ride queries", async () => {
        setupDefaults();
        await GET();

        // ride.count call
        const countWhere = mockPrisma.ride.count.mock.calls[0][0].where;
        expect(countWhere.latestDepartAt.gt).toBeInstanceOf(Date);
        expect(countWhere.status).toBe("ACTIVE");
        expect(countWhere.driverUserId).toBe(USER_ID);

        // ride.findMany call
        const findWhere = mockPrisma.ride.findMany.mock.calls[0][0].where;
        expect(findWhere.latestDepartAt.gt).toBeInstanceOf(Date);
    });

    it("passes upcoming filters to booking queries", async () => {
        setupDefaults();
        await GET();

        // Ride-based booking count (first booking.count call)
        const rideBookingWhere = mockPrisma.booking.count.mock.calls[0][0].where;
        expect(rideBookingWhere.status).toBe("CONFIRMED");
        expect(rideBookingWhere.rideId).toEqual({ not: null });
        expect(rideBookingWhere.ride.latestDepartAt.gt).toBeInstanceOf(Date);

        // TripRequest-based booking count (second booking.count call)
        const trBookingWhere = mockPrisma.booking.count.mock.calls[1][0].where;
        expect(trBookingWhere.status).toBe("CONFIRMED");
        expect(trBookingWhere.tripRequestId).toEqual({ not: null });
        expect(trBookingWhere.tripRequest.latestDesiredAt.gt).toBeInstanceOf(Date);
    });

    it("passes stale-offer filter (tripRequest.latestDesiredAt > now) to offer queries", async () => {
        setupDefaults();
        await GET();

        // Offer sent count
        const offerSentCountWhere = mockPrisma.offer.count.mock.calls[0][0].where;
        expect(offerSentCountWhere.tripRequest.latestDesiredAt.gt).toBeInstanceOf(Date);

        // Offer sent findMany
        const offerSentFindWhere = mockPrisma.offer.findMany.mock.calls[0][0].where;
        expect(offerSentFindWhere.tripRequest.latestDesiredAt.gt).toBeInstanceOf(Date);

        // Offer received count
        const offerRecCountWhere = mockPrisma.offer.count.mock.calls[1][0].where;
        expect(offerRecCountWhere.tripRequest.latestDesiredAt.gt).toBeInstanceOf(Date);

        // Offer received findMany
        const offerRecFindWhere = mockPrisma.offer.findMany.mock.calls[1][0].where;
        expect(offerRecFindWhere.tripRequest.latestDesiredAt.gt).toBeInstanceOf(Date);
    });

    // ── 4. Lists capped at 5 ─────────────────────────────────────────────

    it("caps merged booking list at 5 even when more exist", async () => {
        const rideBookings = Array.from({ length: 5 }, (_, i) =>
            fakeRideBooking(`rb-${i}`, new Date(FUTURE.getTime() + i * 1000))
        );
        const tripBookings = Array.from({ length: 5 }, (_, i) =>
            fakeTripRequestBooking(`tb-${i}`, new Date(FUTURE.getTime() + i * 500))
        );

        setupDefaults({
            rideBookingCount: 5,
            rideBookings,
            tripRequestBookingCount: 5,
            tripRequestBookings: tripBookings,
        });

        const res = await GET();
        const json = await res.json();

        expect(json.upcoming.bookings.length).toBeLessThanOrEqual(5);
        expect(json.summary.confirmedBookingsCount).toBe(10);
    });

    it("passes take: 5 to all list queries", async () => {
        setupDefaults();
        await GET();

        expect(mockPrisma.ride.findMany.mock.calls[0][0].take).toBe(5);
        expect(mockPrisma.booking.findMany.mock.calls[0][0].take).toBe(5);
        expect(mockPrisma.booking.findMany.mock.calls[1][0].take).toBe(5);
        expect(mockPrisma.offer.findMany.mock.calls[0][0].take).toBe(5);
        expect(mockPrisma.offer.findMany.mock.calls[1][0].take).toBe(5);
    });

    // ── 5. Sorting matches contract ──────────────────────────────────────

    it("sorts rides by earliestDepartAt ASC, id ASC", async () => {
        setupDefaults();
        await GET();

        const orderBy = mockPrisma.ride.findMany.mock.calls[0][0].orderBy;
        expect(orderBy).toEqual([{ earliestDepartAt: "asc" }, { id: "asc" }]);
    });

    it("sorts offers sent by createdAt DESC, id DESC", async () => {
        setupDefaults();
        await GET();

        const orderBy = mockPrisma.offer.findMany.mock.calls[0][0].orderBy;
        expect(orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    });

    it("sorts merged bookings by earliest* ASC, id ASC", async () => {
        const early = new Date(FUTURE.getTime());
        const late = new Date(FUTURE.getTime() + 60000);

        const rideBooking = fakeRideBooking("bk-ride", late);
        const tripBooking = fakeTripRequestBooking("bk-trip", early);

        setupDefaults({
            rideBookingCount: 1,
            rideBookings: [rideBooking],
            tripRequestBookingCount: 1,
            tripRequestBookings: [tripBooking],
        });

        const res = await GET();
        const json = await res.json();

        // trip booking (early) should come before ride booking (late)
        expect(json.upcoming.bookings[0].id).toBe("bk-trip");
        expect(json.upcoming.bookings[1].id).toBe("bk-ride");
    });

    // ── 6. Response shape matches locked structure ────────────────────────

    it("response shape matches the locked contract", async () => {
        const ride = fakeRide();
        setupDefaults({ rideCount: 1, rides: [ride] });

        const res = await GET();
        const json = await res.json();

        // Top-level keys
        expect(json).toHaveProperty("now");
        expect(json).toHaveProperty("summary");
        expect(json).toHaveProperty("upcoming");

        // Summary shape
        expect(json.summary).toHaveProperty("activeRidesDrivingCount");
        expect(json.summary).toHaveProperty("confirmedBookingsCount");
        expect(json.summary).toHaveProperty("pendingOffersSentCount");
        expect(json.summary).toHaveProperty("pendingOffersReceivedCount");

        // Upcoming shape
        expect(json.upcoming).toHaveProperty("ridesDriving");
        expect(json.upcoming).toHaveProperty("bookings");
        expect(json.upcoming).toHaveProperty("offers");
        expect(json.upcoming.offers).toHaveProperty("sent");
        expect(json.upcoming.offers).toHaveProperty("received");

        // Ride summary fields
        const r = json.upcoming.ridesDriving[0];
        expect(r).toHaveProperty("id");
        expect(r).toHaveProperty("originText");
        expect(r).toHaveProperty("destinationText");
        expect(r).toHaveProperty("earliestDepartAt");
        expect(r).toHaveProperty("latestDepartAt");
        expect(r).toHaveProperty("preferredDepartAt");
        expect(r).toHaveProperty("distanceCategory");
        expect(r).toHaveProperty("priceCents");
        expect(r).toHaveProperty("seatsTotal");
        expect(r).toHaveProperty("seatsAvailable");
        expect(r).toHaveProperty("status");

        // now is valid ISO
        expect(new Date(json.now).toISOString()).toBe(json.now);
    });
});
