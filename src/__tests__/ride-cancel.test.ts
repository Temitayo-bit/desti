import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        ride: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
        booking: {
            updateMany: vi.fn(),
        },
        $transaction: vi.fn(async (cb: (tx: typeof prismaClient) => Promise<unknown>) =>
            cb(prismaClient)
        ),
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

vi.mock("@prisma/client", () => ({
    DistanceCategory: {
        SHORT: "SHORT",
        MEDIUM: "MEDIUM",
        LONG: "LONG",
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

import { DELETE } from "@/app/api/rides/[rideId]/route";

function makeRequest(rideId: string): Request {
    return new Request(`http://localhost:3000/api/rides/${rideId}`, {
        method: "DELETE",
    });
}

function successAuth(userId = "driver_test_1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: "driver@stetson.edu",
        },
    };
}

function fakeRide(overrides: Record<string, unknown> = {}) {
    const latestDepartAt = new Date(Date.now() + 60 * 60 * 1000);

    return {
        id: "ride-123",
        driverUserId: "driver_test_1",
        latestDepartAt,
        status: "ACTIVE",
        ...overrides,
    };
}

describe("DELETE /api/rides/:rideId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.booking.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
    });

    it("cancels an active future ride with no confirmed bookings", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(fakeRide());

        const res = await DELETE(makeRequest("ride-123") as never, {
            params: Promise.resolve({ rideId: "ride-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ message: "Ride cancelled successfully." });
        expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith({
            where: {
                id: "ride-123",
                driverUserId: "driver_test_1",
                status: "ACTIVE",
                latestDepartAt: { gt: expect.any(Date) },
            },
            data: { status: "CANCELLED" },
        });
        expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith({
            where: {
                rideId: "ride-123",
                status: "CONFIRMED",
            },
            data: {
                status: "CANCELLED",
            },
        });
    });

    it("cancels confirmed bookings when the ride is cancelled", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(fakeRide());
        mockPrisma.booking.updateMany.mockResolvedValue({ count: 2 });

        const res = await DELETE(makeRequest("ride-123") as never, {
            params: Promise.resolve({ rideId: "ride-123" }),
        });

        expect(res.status).toBe(200);
        expect(mockPrisma.booking.updateMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith({
            where: {
                rideId: "ride-123",
                status: "CONFIRMED",
            },
            data: {
                status: "CANCELLED",
            },
        });
    });

    it("returns 403 when a non-owner attempts cancellation", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(
            fakeRide({ driverUserId: "someone-else" })
        );

        const res = await DELETE(makeRequest("ride-123") as never, {
            params: Promise.resolve({ rideId: "ride-123" }),
        });

        expect(res.status).toBe(403);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns 404 when the ride does not exist", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(null);

        const res = await DELETE(makeRequest("ride-123") as never, {
            params: Promise.resolve({ rideId: "ride-123" }),
        });

        expect(res.status).toBe(404);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns 200 idempotently when the ride is already cancelled", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(
            fakeRide({ status: "CANCELLED" })
        );

        const res = await DELETE(makeRequest("ride-123") as never, {
            params: Promise.resolve({ rideId: "ride-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ message: "Ride already cancelled." });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns 409 when the ride has already departed", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(
            fakeRide({ latestDepartAt: new Date(Date.now() - 60 * 1000) })
        );

        const res = await DELETE(makeRequest("ride-123") as never, {
            params: Promise.resolve({ rideId: "ride-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.message).toContain("already departed");
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("only changes ride and booking statuses during cancellation", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(fakeRide());

        const res = await DELETE(makeRequest("ride-123") as never, {
            params: Promise.resolve({ rideId: "ride-123" }),
        });

        expect(res.status).toBe(200);
        const rideUpdateArgs = mockPrisma.ride.updateMany.mock.calls[0][0];
        expect(rideUpdateArgs.data).toEqual({ status: "CANCELLED" });
        const bookingUpdateArgs = mockPrisma.booking.updateMany.mock.calls[0][0];
        expect(bookingUpdateArgs.data).toEqual({ status: "CANCELLED" });
    });
});
