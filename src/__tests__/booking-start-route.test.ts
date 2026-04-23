import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        booking: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
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

import { POST } from "@/app/api/bookings/[bookingId]/start/route";

function successAuth(userId: string) {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: `${userId}@stetson.edu`,
        },
    };
}

function makeRequest(bookingId: string): Request {
    return new Request(`http://localhost:3000/api/bookings/${bookingId}/start`, {
        method: "POST",
    });
}

function fakeBookingContextRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "booking-1",
        rideId: "ride-1",
        riderUserId: "rider-1",
        driverUserId: "driver-1",
        currentLatitude: null,
        currentLongitude: null,
        locationUpdatedAt: null,
        tripStartedAt: null,
        isLocationSharingActive: false,
        status: "CONFIRMED",
        ride: {
            id: "ride-1",
            driverUserId: "driver-1",
            status: "ACTIVE",
        },
        ...overrides,
    };
}

describe("POST /api/bookings/:bookingId/start", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth("driver-1"));
    });

    it("allows the driver to start an eligible active trip", async () => {
        const startedAt = new Date("2030-01-01T10:00:00.000Z");

        mockPrisma.booking.findUnique
            .mockResolvedValueOnce(fakeBookingContextRow())
            .mockResolvedValueOnce(
                fakeBookingContextRow({
                    isLocationSharingActive: true,
                    tripStartedAt: startedAt,
                })
            );
        mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const response = await POST(makeRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.bookingId).toBe("booking-1");
        expect(body.isLocationSharingActive).toBe(true);
        expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "booking-1",
                    status: "CONFIRMED",
                }),
                data: expect.objectContaining({
                    isLocationSharingActive: true,
                }),
            })
        );
    });

    it("returns 403 when a non-driver participant tries to start sharing", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("rider-1"));
        mockPrisma.booking.findUnique.mockResolvedValue(fakeBookingContextRow());

        const response = await POST(makeRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        expect(response.status).toBe(403);
        expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it("returns 409 when the booking is already completed", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBookingContextRow({
                status: "COMPLETED",
            })
        );

        const response = await POST(makeRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.code).toBe("BOOKING_NOT_ACTIVE");
        expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it("returns 409 when the booking's ride has been cancelled", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBookingContextRow({
                ride: {
                    id: "ride-1",
                    driverUserId: "driver-1",
                    status: "CANCELLED",
                },
            })
        );

        const response = await POST(makeRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.code).toBe("BOOKING_NOT_ACTIVE");
        expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
    });
});
