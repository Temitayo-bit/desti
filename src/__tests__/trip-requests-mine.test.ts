import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
  const prismaClient = {
    tripRequest: {
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

import { GET } from "@/app/api/trip-requests/mine/route";

function successAuth() {
  return {
    user: {
      clerkUserId: "rider_owner_1",
      primaryStetsonEmail: "rider@stetson.edu",
    },
  };
}

function makeRequest() {
  return new Request("http://localhost:3000/api/trip-requests/mine", {
    method: "GET",
  });
}

function fakeTripRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    riderUserId: "rider_owner_1",
    originText: "Stetson",
    destinationText: "Airport",
    earliestDesiredAt: new Date("2030-01-01T10:00:00.000Z"),
    latestDesiredAt: new Date("2030-01-01T11:00:00.000Z"),
    distanceCategory: "MEDIUM",
    seatsNeeded: 2,
    pickupInstructions: null,
    dropoffInstructions: null,
    preferredDepartAt: null,
    status: "ACTIVE",
    createdAt: new Date("2030-01-01T09:00:00.000Z"),
    updatedAt: new Date("2030-01-01T09:00:00.000Z"),
    ...overrides,
  };
}

describe("GET /api/trip-requests/mine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireStetsonAuth.mockResolvedValue(successAuth());
    mockPrisma.tripRequest.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);
  });

  it("returns auth error and skips Prisma when auth fails", async () => {
    const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
    mockRequireStetsonAuth.mockResolvedValue({ error: errorResponse });

    const res = await GET(makeRequest() as never);

    expect(res.status).toBe(401);
    expect(mockPrisma.tripRequest.findMany).not.toHaveBeenCalled();
  });

  it("queries only non-cancelled trip requests owned by the authenticated rider", async () => {
    await GET(makeRequest() as never);

    const findManyArg = mockPrisma.tripRequest.findMany.mock.calls[0][0];
    expect(findManyArg.where).toEqual({
      riderUserId: "rider_owner_1",
      status: { not: "CANCELLED" },
    });
    expect(findManyArg.orderBy).toEqual([
      { earliestDesiredAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("includes ACTIVE and CLOSED trip requests", async () => {
    const activeTripRequest = fakeTripRequest({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "ACTIVE",
      earliestDesiredAt: new Date("2031-01-01T10:00:00.000Z"),
      latestDesiredAt: new Date("2031-01-01T11:00:00.000Z"),
    });
    const closedTripRequest = fakeTripRequest({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "CLOSED",
      earliestDesiredAt: new Date("2029-01-01T10:00:00.000Z"),
      latestDesiredAt: new Date("2029-01-01T11:00:00.000Z"),
    });

    mockPrisma.tripRequest.findMany.mockResolvedValue([
      activeTripRequest,
      closedTripRequest,
    ]);

    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.items).toHaveLength(2);
    expect(json.items[0].id).toBe(activeTripRequest.id);
    expect(json.items[1].id).toBe(closedTripRequest.id);
    expect(json.nextCursor).toBeNull();
  });

  it("returns trip request summary fields in response shape", async () => {
    const tripRequest = fakeTripRequest();
    mockPrisma.tripRequest.findMany.mockResolvedValue([tripRequest]);

    const res = await GET(makeRequest() as never);
    const json = await res.json();
    const first = json.items[0];

    expect(first).toEqual(
      expect.objectContaining({
        id: tripRequest.id,
        riderUserId: tripRequest.riderUserId,
        originText: tripRequest.originText,
        destinationText: tripRequest.destinationText,
        distanceCategory: tripRequest.distanceCategory,
        seatsNeeded: tripRequest.seatsNeeded,
        pickupInstructions: tripRequest.pickupInstructions,
        dropoffInstructions: tripRequest.dropoffInstructions,
        preferredDepartAt: tripRequest.preferredDepartAt,
        status: tripRequest.status,
        confirmedBookings: [],
      }),
    );
  });

  it("attaches upcoming confirmed bookings grouped by trip request", async () => {
    const trA = fakeTripRequest({
      id: "trip-a",
      earliestDesiredAt: new Date("2030-01-02T10:00:00.000Z"),
      latestDesiredAt: new Date("2030-01-02T11:00:00.000Z"),
    });
    const trB = fakeTripRequest({
      id: "trip-b",
      earliestDesiredAt: new Date("2030-01-03T10:00:00.000Z"),
      latestDesiredAt: new Date("2030-01-03T11:00:00.000Z"),
    });
    mockPrisma.tripRequest.findMany.mockResolvedValue([trA, trB]);
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        tripRequestId: trA.id,
        riderUserId: "rider_owner_1",
        driverUserId: "driver_1",
        seatsBooked: 2,
        tripRequest: {
          earliestDesiredAt: trA.earliestDesiredAt,
          latestDesiredAt: trA.latestDesiredAt,
        },
      },
    ]);

    const res = await GET(makeRequest() as never);
    const json = await res.json();

    expect(json.items[0].confirmedBookings).toHaveLength(1);
    expect(json.items[1].confirmedBookings).toEqual([]);

    const bookingFindManyArg = mockPrisma.booking.findMany.mock.calls[0][0];
    expect(bookingFindManyArg.where.status).toBe("CONFIRMED");
    expect(bookingFindManyArg.where.tripRequestId).toEqual({
      in: [trA.id, trB.id],
    });
    expect(bookingFindManyArg.where.tripRequest).toEqual({
      latestDesiredAt: { gt: expect.any(Date) },
    });
  });
});
