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

import {
    GET as getBookingLocation,
    POST as postBookingLocation,
} from "@/app/api/bookings/[bookingId]/location/route";

function successAuth(userId: string) {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: `${userId}@stetson.edu`,
        },
    };
}

function makeGetRequest(bookingId: string): Request {
    return new Request(`http://localhost:3000/api/bookings/${bookingId}/location`, {
        method: "GET",
    });
}

function makePostRequest(bookingId: string, body: unknown): Request {
    return new Request(`http://localhost:3000/api/bookings/${bookingId}/location`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

function fakeBookingRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "booking-1",
        rideId: "ride-1",
        riderUserId: "rider-1",
        driverUserId: "driver-1",
        currentLatitude: 29.21,
        currentLongitude: -81.03,
        locationUpdatedAt: new Date("2030-01-01T10:05:00.000Z"),
        tripStartedAt: new Date("2030-01-01T10:00:00.000Z"),
        isLocationSharingActive: true,
        status: "CONFIRMED",
        ride: {
            id: "ride-1",
            driverUserId: "driver-1",
            status: "ACTIVE",
        },
        ...overrides,
    };
}

describe("booking location routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth("driver-1"));
    });

    it("POST /location allows the driver to update latest location for an active trip", async () => {
        const updatedAt = new Date("2030-01-01T10:10:00.000Z");

        mockPrisma.booking.findUnique
            .mockResolvedValueOnce(fakeBookingRow())
            .mockResolvedValueOnce(
                fakeBookingRow({
                    currentLatitude: 29.22,
                    currentLongitude: -81.04,
                    locationUpdatedAt: updatedAt,
                })
            );
        mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const response = await postBookingLocation(
            makePostRequest("booking-1", { latitude: 29.22, longitude: -81.04 }) as never,
            { params: Promise.resolve({ bookingId: "booking-1" }) }
        );

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.bookingId).toBe("booking-1");
        expect(body.latitude).toBe(29.22);
        expect(body.longitude).toBe(-81.04);
        expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "booking-1",
                    status: "CONFIRMED",
                    isLocationSharingActive: true,
                }),
                data: expect.objectContaining({
                    currentLatitude: 29.22,
                    currentLongitude: -81.04,
                }),
            })
        );
    });

    it("POST /location blocks non-driver participants", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("rider-1"));
        mockPrisma.booking.findUnique.mockResolvedValue(fakeBookingRow());

        const response = await postBookingLocation(
            makePostRequest("booking-1", { latitude: 29.22, longitude: -81.04 }) as never,
            { params: Promise.resolve({ bookingId: "booking-1" }) }
        );

        expect(response.status).toBe(403);
        expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it("POST /location validates coordinate ranges", async () => {
        const response = await postBookingLocation(
            makePostRequest("booking-1", { latitude: 120, longitude: -81.04 }) as never,
            { params: Promise.resolve({ bookingId: "booking-1" }) }
        );

        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.code).toBe("INVALID_LATITUDE");
        expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it("POST /location rejects updates when trip is no longer active", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBookingRow({
                status: "COMPLETED",
            })
        );

        const response = await postBookingLocation(
            makePostRequest("booking-1", { latitude: 29.22, longitude: -81.04 }) as never,
            { params: Promise.resolve({ bookingId: "booking-1" }) }
        );

        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.code).toBe("BOOKING_NOT_ACTIVE");
        expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it("GET /location allows the driver to read active shared location", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(fakeBookingRow());

        const response = await getBookingLocation(makeGetRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.bookingId).toBe("booking-1");
        expect(body.latitude).toBe(29.21);
        expect(body.longitude).toBe(-81.03);
    });

    it("GET /location allows a confirmed rider participant to read location", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("rider-1"));
        mockPrisma.booking.findUnique.mockResolvedValue(fakeBookingRow());

        const response = await getBookingLocation(makeGetRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        expect(response.status).toBe(200);
    });

    it("GET /location blocks unrelated users", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("stranger-1"));
        mockPrisma.booking.findUnique.mockResolvedValue(fakeBookingRow());

        const response = await getBookingLocation(makeGetRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        expect(response.status).toBe(404);
    });

    it("GET /location blocks inactive/completed/cancelled trips", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBookingRow({
                ride: {
                    id: "ride-1",
                    driverUserId: "driver-1",
                    status: "CANCELLED",
                },
            })
        );

        const response = await getBookingLocation(makeGetRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.code).toBe("BOOKING_NOT_ACTIVE");
    });

    it("GET /location returns a clean null-location payload when no location has been sent", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("rider-1"));
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBookingRow({
                currentLatitude: null,
                currentLongitude: null,
                locationUpdatedAt: null,
            })
        );

        const response = await getBookingLocation(makeGetRequest("booking-1") as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.latitude).toBeNull();
        expect(body.longitude).toBeNull();
        expect(body.locationUpdatedAt).toBeNull();
        expect(body.isLocationSharingActive).toBe(true);
    });
});
