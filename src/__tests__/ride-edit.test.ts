import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────────────
const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockPrisma: {
            ride: {
                findUnique: vi.fn(),
                update: vi.fn(),
                updateMany: vi.fn(),
            },
        },
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/generated/prisma/client", () => ({
    DistanceCategory: {
        SHORT: "SHORT",
        MEDIUM: "MEDIUM",
        LONG: "LONG",
    },
}));

import { PATCH } from "@/app/api/rides/[rideId]/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
): Request {
    const allHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers,
    };

    return new Request("http://localhost:3000/api/rides/ride-123", {
        method: "PATCH",
        headers: allHeaders,
        body: JSON.stringify(body),
    });
}

function successAuth(userId = "user_test123") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: "test@stetson.edu",
        },
    };
}

function fakeRide(overrides: Record<string, unknown> = {}, booked = false) {
    const now = new Date();
    const earliest = new Date(now.getTime() + 60 * 60 * 1000); // +1h
    const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000); // +3h

    return {
        id: "ride-123",
        driverUserId: "user_test123",
        originText: "Stetson University",
        destinationText: "Daytona Beach",
        earliestDepartAt: earliest,
        latestDepartAt: latest,
        distanceCategory: "MEDIUM",
        priceCents: 500,
        seatsTotal: 4,
        seatsAvailable: 4,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        bookings: booked ? [{ status: "CONFIRMED" }] : [],
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /api/rides/:rideId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
    });

    it("1) Owner can edit when no CONFIRMED booking exists", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique
            .mockResolvedValueOnce(dbRide)
            .mockResolvedValueOnce({ ...dbRide, priceCents: 600 });
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });

        const req = makeRequest({ priceCents: 600 });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(200);
        expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "ride-123", bookings: { none: { status: "CONFIRMED" } } },
                data: expect.objectContaining({ priceCents: 600 })
            })
        );
    });

    it("2) Owner cannot edit after CONFIRMED booking exists (409)", async () => {
        const dbRide = fakeRide({}, true); // booked = true
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);

        const req = makeRequest({ priceCents: 600 });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.code).toBe("RIDE_EDIT_LOCKED_CONFIRMED");
        expect(mockPrisma.ride.updateMany).not.toHaveBeenCalled();
    });

    it("3) Non-owner cannot edit (403)", async () => {
        const dbRide = fakeRide({ driverUserId: "someone-else" });
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);

        const req = makeRequest({ priceCents: 600 });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(403);
        expect(mockPrisma.ride.updateMany).not.toHaveBeenCalled();
    });

    it("4) Invalid window ordering rejected (400)", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);

        const now = new Date();
        const req = makeRequest({
            earliestDepartAt: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
            latestDepartAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.details.map((d: any) => d.field)).toContain("latestDepartAt");
    });

    it("5) Window > 48h rejected (400)", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);

        const now = new Date();
        const req = makeRequest({
            earliestDepartAt: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
            latestDepartAt: new Date(now.getTime() + 50 * 60 * 60 * 1000).toISOString(),
        });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.details.map((d: any) => d.message).some((m: string) => m.includes("48 hours"))).toBe(true);
    });

    it("6) seatsTotal update resets seatsAvailable when no bookings", async () => {
        const dbRide = fakeRide({ seatsTotal: 4, seatsAvailable: 2 });
        mockPrisma.ride.findUnique
            .mockResolvedValueOnce(dbRide)
            .mockResolvedValueOnce({ ...dbRide, seatsTotal: 5, seatsAvailable: 5 });
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });

        const req = makeRequest({ seatsTotal: 5 });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(200);
        expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "ride-123", bookings: { none: { status: "CONFIRMED" } } },
                data: expect.objectContaining({ seatsTotal: 5, seatsAvailable: 5 })
            })
        );
    });

    it("7) Unknown fields are rejected with 400", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);

        const req = makeRequest({ unknownField: "bad" });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.message).toContain("Unknown fields");
    });
});
