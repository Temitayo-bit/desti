import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
  const prismaClient = {
    ride: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  };

  return {
    mockRequireStetsonAuth: vi.fn(),
    mockPrisma: prismaClient,
  };
});

vi.mock("@/lib/auth", () => ({
  requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/rides/mine/route";

function successAuth() {
  return {
    user: {
      clerkUserId: "driver_owner_1",
      primaryStetsonEmail: "driver@stetson.edu",
    },
  };
}

function makeRequest() {
  return new Request("http://localhost:3000/api/rides/mine", {
    method: "GET",
  });
}

function fakeRide(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    driverUserId: "driver_owner_1",
    originText: "Stetson",
    destinationText: "Airport",
    earliestDepartAt: new Date("2030-01-01T10:00:00.000Z"),
    latestDepartAt: new Date("2030-01-01T11:00:00.000Z"),
    distanceCategory: "MEDIUM",
    priceCents: 800,
    seatsTotal: 4,
    seatsAvailable: 3,
    musicPreference: null,
    hasAc: null,
    hasTrunkSpace: null,
    vehicleType: null,
    pickupInstructions: null,
    dropoffInstructions: null,
    preferredDepartAt: null,
    status: "ACTIVE",
    createdAt: new Date("2030-01-01T09:00:00.000Z"),
    updatedAt: new Date("2030-01-01T09:00:00.000Z"),
    ...overrides,
  };
}

describe("GET /api/rides/mine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireStetsonAuth.mockResolvedValue(successAuth());
    mockPrisma.ride.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);
  });

  it("returns auth error and skips Prisma when auth fails", async () => {
    const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
    mockRequireStetsonAuth.mockResolvedValue({ error: errorResponse });

    const res = await GET(makeRequest() as never);

    expect(res.status).toBe(401);
    expect(mockPrisma.ride.findMany).not.toHaveBeenCalled();
  });

  it("queries only active rides owned by the authenticated driver", async () => {
    await GET(makeRequest() as never);

    const findManyArg = mockPrisma.ride.findMany.mock.calls[0][0];
    expect(findManyArg.where).toEqual({
      driverUserId: "driver_owner_1",
      status: "ACTIVE",
    });
    expect(findManyArg.orderBy).toEqual([
      { earliestDepartAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("includes both upcoming and past owned rides", async () => {
    const pastRide = fakeRide({
      id: "22222222-2222-4222-8222-222222222222",
      earliestDepartAt: new Date("2029-01-01T10:00:00.000Z"),
      latestDepartAt: new Date("2029-01-01T11:00:00.000Z"),
    });
    const futureRide = fakeRide({
      id: "33333333-3333-4333-8333-333333333333",
      earliestDepartAt: new Date("2031-01-01T10:00:00.000Z"),
      latestDepartAt: new Date("2031-01-01T11:00:00.000Z"),
    });

    mockPrisma.ride.findMany.mockResolvedValue([futureRide, pastRide]);

    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.items).toHaveLength(2);
    expect(json.items[0].id).toBe(futureRide.id);
    expect(json.items[1].id).toBe(pastRide.id);
    expect(json.nextCursor).toBeNull();
  });

  it("returns ride summary fields in response shape", async () => {
    const ride = fakeRide();
    mockPrisma.ride.findMany.mockResolvedValue([ride]);

    const res = await GET(makeRequest() as never);
    const json = await res.json();
    const first = json.items[0];

    expect(first).toEqual(
      expect.objectContaining({
        id: ride.id,
        driverUserId: ride.driverUserId,
        originText: ride.originText,
        destinationText: ride.destinationText,
        distanceCategory: ride.distanceCategory,
        priceCents: ride.priceCents,
        seatsTotal: ride.seatsTotal,
        seatsAvailable: ride.seatsAvailable,
        musicPreference: ride.musicPreference,
        hasAc: ride.hasAc,
        hasTrunkSpace: ride.hasTrunkSpace,
        vehicleType: ride.vehicleType,
        pickupInstructions: ride.pickupInstructions,
        dropoffInstructions: ride.dropoffInstructions,
        preferredDepartAt: ride.preferredDepartAt,
        status: ride.status,
        confirmedBookings: [],
      }),
    );
  });

  it("attaches confirmed bookings grouped by ride", async () => {
    const rideA = fakeRide({
      id: "aaaa1111-1111-4111-8111-111111111111",
      earliestDepartAt: new Date("2030-01-02T10:00:00.000Z"),
      latestDepartAt: new Date("2030-01-02T11:00:00.000Z"),
    });
    const rideB = fakeRide({
      id: "bbbb2222-2222-4222-8222-222222222222",
      earliestDepartAt: new Date("2030-01-03T10:00:00.000Z"),
      latestDepartAt: new Date("2030-01-03T11:00:00.000Z"),
    });
    mockPrisma.ride.findMany.mockResolvedValue([rideA, rideB]);
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        rideId: rideA.id,
        riderUserId: "rider_1",
        driverUserId: "driver_owner_1",
        seatsBooked: 2,
        ride: {
          earliestDepartAt: rideA.earliestDepartAt,
          latestDepartAt: rideA.latestDepartAt,
        },
      },
      {
        id: "booking-2",
        rideId: rideA.id,
        riderUserId: "rider_2",
        driverUserId: "driver_owner_1",
        seatsBooked: 1,
        ride: {
          earliestDepartAt: rideA.earliestDepartAt,
          latestDepartAt: rideA.latestDepartAt,
        },
      },
    ]);

    const res = await GET(makeRequest() as never);
    const json = await res.json();

    expect(json.items[0].confirmedBookings).toHaveLength(2);
    expect(json.items[1].confirmedBookings).toEqual([]);
    expect(json.items[0].confirmedBookings[0]).toEqual(
      expect.objectContaining({
        id: "booking-1",
        riderUserId: "rider_1",
        driverUserId: "driver_owner_1",
        seatsBooked: 2,
        startsAt: expect.any(String),
        endsAt: expect.any(String),
      }),
    );
    expect(Number.isNaN(Date.parse(json.items[0].confirmedBookings[0].startsAt))).toBe(
      false,
    );
    expect(Number.isNaN(Date.parse(json.items[0].confirmedBookings[0].endsAt))).toBe(
      false,
    );

    const bookingFindManyArg = mockPrisma.booking.findMany.mock.calls[0][0];
    expect(bookingFindManyArg.where.status).toBe("CONFIRMED");
    expect(bookingFindManyArg.where.rideId).toEqual({
      in: [rideA.id, rideB.id],
    });
    expect(bookingFindManyArg.where.ride).toBeUndefined();
    expect(bookingFindManyArg.orderBy).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });
});
