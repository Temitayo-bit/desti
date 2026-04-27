import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeocodingErrorCode } from "@/lib/geocoding";

// ── Mock setup ───────────────────────────────────────────────────────────────
const {
    mockRequireStetsonAuth,
    mockPrisma,
    mockResolveLocationOrThrow,
    mockAssertDistinctResolvedLocationsOrThrow,
    MockGeocodingError,
} = vi.hoisted(() => {
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockPrisma: {
            ride: {
                findUnique: vi.fn(),
                update: vi.fn(),
                updateMany: vi.fn(),
            },
            $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
        },
        mockResolveLocationOrThrow: vi.fn(),
        mockAssertDistinctResolvedLocationsOrThrow: vi.fn(),
        MockGeocodingError: class extends Error {
            code: GeocodingErrorCode;
            constructor(code: GeocodingErrorCode, message: string) {
                super(message);
                this.name = "GeocodingError";
                this.code = code;
            }
        },
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/geocoding", () => ({
    resolveLocationOrThrow: (...args: unknown[]) =>
        mockResolveLocationOrThrow(...args),
    assertDistinctResolvedLocationsOrThrow: (...args: unknown[]) =>
        mockAssertDistinctResolvedLocationsOrThrow(...args),
    GeocodingError: MockGeocodingError,
}));

vi.mock("@prisma/client", () => ({
    DistanceCategory: {
        SHORT: "SHORT",
        MEDIUM: "MEDIUM",
        LONG: "LONG",
    },
    MusicPreference: {
        MUSIC_ALLOWED: "MUSIC_ALLOWED",
        NO_MUSIC: "NO_MUSIC",
    },
    VehicleType: {
        SEDAN: "SEDAN",
        SUV: "SUV",
        TRUCK: "TRUCK",
        VAN: "VAN",
        COUPE: "COUPE",
        OTHER: "OTHER",
    },
    BookingStatus: {
        CONFIRMED: "CONFIRMED",
        CANCELLED: "CANCELLED",
    },
    RideStatus: {
        ACTIVE: "ACTIVE",
        CANCELLED: "CANCELLED",
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
        originResolvedAddress: "Stetson University, DeLand, Florida, United States",
        originLatitude: 29.0361,
        originLongitude: -81.302,
        destinationText: "Daytona Beach",
        destinationResolvedAddress: "Daytona Beach, Florida, United States",
        destinationLatitude: 29.2108,
        destinationLongitude: -81.0228,
        earliestDepartAt: earliest,
        latestDepartAt: latest,
        distanceCategory: "MEDIUM",
        priceCents: 500,
        seatsTotal: 4,
        seatsAvailable: 4,
        musicPreference: null,
        hasAc: null,
        hasTrunkSpace: null,
        vehicleType: null,
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
        mockResolveLocationOrThrow.mockImplementation(async (input: string) => ({
            inputText: input.trim(),
            resolvedAddress: `${input.trim()} (resolved)`,
            latitude: 29.1,
            longitude: -81.1,
        }));
        mockAssertDistinctResolvedLocationsOrThrow.mockImplementation(() => undefined);
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
        expect(mockResolveLocationOrThrow).not.toHaveBeenCalled();
    });

    it("1b) re-geocodes changed destinationText and stores resolved coordinates", async () => {
        const dbRide = fakeRide();
        const updatedRide = fakeRide({
            destinationText: "Orlando",
            destinationResolvedAddress: "Orlando, Florida, United States",
            destinationLatitude: 28.5383,
            destinationLongitude: -81.3792,
        });

        mockResolveLocationOrThrow.mockResolvedValueOnce({
            inputText: "Orlando",
            resolvedAddress: "Orlando, Florida, United States",
            latitude: 28.5383,
            longitude: -81.3792,
        });

        mockPrisma.ride.findUnique
            .mockResolvedValueOnce(dbRide)
            .mockResolvedValueOnce(updatedRide);
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });

        const req = makeRequest({ destinationText: "  Orlando " });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(200);
        expect(mockResolveLocationOrThrow).toHaveBeenCalledTimes(1);
        expect(mockResolveLocationOrThrow).toHaveBeenCalledWith("Orlando");
        expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    destinationText: "Orlando",
                    destinationResolvedAddress:
                        "Orlando, Florida, United States",
                    destinationLatitude: 28.5383,
                    destinationLongitude: -81.3792,
                }),
            })
        );
    });

    it("1c) does not geocode when submitted originText is unchanged after trimming", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique
            .mockResolvedValueOnce(dbRide)
            .mockResolvedValueOnce(dbRide);
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });

        const req = makeRequest({ originText: "  Stetson University  " });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(200);
        expect(mockResolveLocationOrThrow).not.toHaveBeenCalled();
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
        expect(
            json.details.map((d: { field: string }) => d.field)
        ).toContain("latestDepartAt");
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
        expect(
            json.details
                .map((d: { message: string }) => d.message)
                .some((m: string) => m.includes("48 hours"))
        ).toBe(true);
    });

    it("6) seatsTotal update resets seatsAvailable when no bookings", async () => {
        const dbRide = fakeRide({ seatsTotal: 4, seatsAvailable: 4 });
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

    it("7) returns 503 when geocoding lookup throws unexpectedly", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);
        mockResolveLocationOrThrow.mockRejectedValueOnce(
            new Error("network down")
        );

        const req = makeRequest({ destinationText: "Orlando" });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(503);
        expect(mockPrisma.ride.updateMany).not.toHaveBeenCalled();
    });

    it("7b) returns 503 when distinctness check throws unexpectedly", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);
        mockAssertDistinctResolvedLocationsOrThrow.mockImplementationOnce(() => {
            throw new Error("assert failed");
        });

        const req = makeRequest({ destinationText: "Orlando" });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(503);
        expect(mockPrisma.ride.updateMany).not.toHaveBeenCalled();
    });

    it("8) Unknown fields are rejected with 400", async () => {
        const dbRide = fakeRide();
        mockPrisma.ride.findUnique.mockResolvedValue(dbRide);

        const req = makeRequest({ unknownField: "bad" });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.message).toContain("Unknown fields");
    });

    it("9) Ride unexpectedly deleted during edit returns 404", async () => {
        const dbRide = fakeRide();
        // First findUnique checks existence. The transaction's findUnique returns null.
        mockPrisma.ride.findUnique
            .mockResolvedValueOnce(dbRide)
            .mockResolvedValueOnce(null);
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 0 }); // Update fails

        const req = makeRequest({ priceCents: 600 });
        const params = { rideId: "ride-123" };
        const res = await PATCH(req as never, { params: Promise.resolve(params) });

        expect(res.status).toBe(404);
        expect(mockPrisma.ride.updateMany).toHaveBeenCalled();
    });
});
