import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => ({
    mockRequireStetsonAuth: vi.fn(),
    mockPrisma: {
        booking: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import { GET } from "@/app/api/dashboard/bookings/route";

const USER_ID = "user_driver1";
const FUTURE = new Date(Date.now() + 86400000);

function successAuth(userId = USER_ID) {
    return {
        user: { clerkUserId: userId, primaryStetsonEmail: "test@stetson.edu" },
    };
}

function fakeRideBooking(id: string, earliestDepartAt: Date) {
    return {
        id,
        riderUserId: "rider_1",
        driverUserId: null,
        status: "CONFIRMED",
        seatsBooked: 1,
        priceCents: 300,
        createdAt: new Date(),
        ride: {
            id: `ride-for-${id}`,
            driverUserId: USER_ID,
            originText: "Campus",
            destinationText: "Mall",
            earliestDepartAt,
            latestDepartAt: new Date(earliestDepartAt.getTime() + 3600000),
            preferredDepartAt: earliestDepartAt,
            distanceCategory: "SHORT",
            priceCents: 300,
            seatsTotal: 4,
            seatsAvailable: 3,
            status: "ACTIVE",
        },
    };
}

function fakeTripRequestBooking(id: string, earliestDesiredAt: Date) {
    return {
        id,
        riderUserId: "rider_1",
        driverUserId: USER_ID,
        status: "CONFIRMED",
        seatsBooked: 1,
        priceCents: 500,
        createdAt: new Date(),
        tripRequest: {
            id: `trip-for-${id}`,
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

describe("GET /api/dashboard/bookings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.booking.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
    });

    it("returns auth error and skips Prisma when auth fails", async () => {
        const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
        });
        mockRequireStetsonAuth.mockResolvedValue({ error: errorResponse });

        const res = await GET();

        expect(res.status).toBe(401);
        expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    });

    it("applies upcoming rider/driver filters to both booking queries", async () => {
        await GET();

        const rideBookingWhere = mockPrisma.booking.findMany.mock.calls[0][0].where;
        expect(rideBookingWhere.status).toBe("CONFIRMED");
        expect(rideBookingWhere.rideId).toEqual({ not: null });
        expect(rideBookingWhere.ride.latestDepartAt.gt).toBeInstanceOf(Date);
        expect(rideBookingWhere.OR).toEqual([
            { riderUserId: USER_ID },
            { ride: { driverUserId: USER_ID } },
        ]);

        const tripRequestBookingWhere = mockPrisma.booking.findMany.mock.calls[1][0].where;
        expect(tripRequestBookingWhere.status).toBe("CONFIRMED");
        expect(tripRequestBookingWhere.tripRequestId).toEqual({ not: null });
        expect(tripRequestBookingWhere.tripRequest.latestDesiredAt.gt).toBeInstanceOf(Date);
        expect(tripRequestBookingWhere.OR).toEqual([
            { riderUserId: USER_ID },
            { driverUserId: USER_ID },
        ]);
    });

    it("selects origin and destination coordinates for map pin visualization", async () => {
        await GET();

        const rideBookingSelect = mockPrisma.booking.findMany.mock.calls[0][0].select.ride.select;
        expect(rideBookingSelect.originLatitude).toBe(true);
        expect(rideBookingSelect.originLongitude).toBe(true);
        expect(rideBookingSelect.destinationLatitude).toBe(true);
        expect(rideBookingSelect.destinationLongitude).toBe(true);

        const tripRequestSelect =
            mockPrisma.booking.findMany.mock.calls[1][0].select.tripRequest.select;
        expect(tripRequestSelect.originLatitude).toBe(true);
        expect(tripRequestSelect.originLongitude).toBe(true);
        expect(tripRequestSelect.destinationLatitude).toBe(true);
        expect(tripRequestSelect.destinationLongitude).toBe(true);
    });

    it("merges and sorts ride and trip-request bookings by earliest time ascending", async () => {
        const later = new Date(FUTURE.getTime() + 60000);
        const earlier = new Date(FUTURE.getTime());

        mockPrisma.booking.findMany.mockReset();
        mockPrisma.booking.findMany
            .mockResolvedValueOnce([fakeRideBooking("ride-booking", later)])
            .mockResolvedValueOnce([fakeTripRequestBooking("trip-booking", earlier)]);

        const res = await GET();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.items).toHaveLength(2);
        expect(json.items[0].id).toBe("trip-booking");
        expect(json.items[1].id).toBe("ride-booking");
        expect(new Date(json.now).toISOString()).toBe(json.now);
    });
});
