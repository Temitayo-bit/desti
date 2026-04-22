import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        booking: {
            findUnique: vi.fn(),
        },
        ride: {
            findUnique: vi.fn(),
        },
    };

    return {
        mockPrisma: prismaClient,
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import {
    canUserAccessActiveTripDataByBooking,
    canUserAccessActiveTripDataByRide,
} from "@/services/active-trip-visibility-service";

function fakeActiveBooking(overrides: Record<string, unknown> = {}) {
    return {
        id: "booking-1",
        rideId: "ride-1",
        riderUserId: "rider-1",
        driverUserId: null,
        status: "CONFIRMED",
        ride: {
            id: "ride-1",
            driverUserId: "driver-1",
            status: "ACTIVE",
        },
        ...overrides,
    };
}

describe("active trip visibility (booking-based)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows driver access for an active trip booking", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(fakeActiveBooking());

        const allowed = await canUserAccessActiveTripDataByBooking("driver-1", "booking-1");

        expect(allowed).toBe(true);
    });

    it("allows confirmed rider access for an active trip booking", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(fakeActiveBooking());

        const allowed = await canUserAccessActiveTripDataByBooking("rider-1", "booking-1");

        expect(allowed).toBe(true);
    });

    it("denies unrelated users", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(fakeActiveBooking());

        const allowed = await canUserAccessActiveTripDataByBooking("stranger-1", "booking-1");

        expect(allowed).toBe(false);
    });

    it("denies access for completed bookings", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeActiveBooking({
                status: "COMPLETED",
            })
        );

        const allowed = await canUserAccessActiveTripDataByBooking("driver-1", "booking-1");

        expect(allowed).toBe(false);
    });

    it("denies access for cancelled trips", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeActiveBooking({
                ride: {
                    id: "ride-1",
                    driverUserId: "driver-1",
                    status: "CANCELLED",
                },
            })
        );

        const allowed = await canUserAccessActiveTripDataByBooking("driver-1", "booking-1");

        expect(allowed).toBe(false);
    });
});

describe("active trip visibility (ride-based)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows driver and confirmed rider when ride is active", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
            id: "ride-1",
            driverUserId: "driver-1",
            status: "ACTIVE",
            bookings: [{ riderUserId: "rider-1" }],
        });

        await expect(
            canUserAccessActiveTripDataByRide("driver-1", "ride-1")
        ).resolves.toBe(true);
        await expect(
            canUserAccessActiveTripDataByRide("rider-1", "ride-1")
        ).resolves.toBe(true);
    });

    it("denies ride access when there are no confirmed participants", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
            id: "ride-1",
            driverUserId: "driver-1",
            status: "ACTIVE",
            bookings: [],
        });

        const allowed = await canUserAccessActiveTripDataByRide("driver-1", "ride-1");

        expect(allowed).toBe(false);
    });
});
