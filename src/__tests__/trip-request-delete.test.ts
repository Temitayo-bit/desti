import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockPrisma: {
            tripRequest: {
                findUnique: vi.fn(),
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
}));

import { DELETE } from "@/app/api/trip-requests/[tripRequestId]/route";

function makeRequest(): Request {
    return new Request("http://localhost:3000/api/trip-requests/trip-123", {
        method: "DELETE",
    });
}

function successAuth(userId = "user_rider_1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

function fakeTripRequest(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    const earliest = new Date(now.getTime() + 60 * 60 * 1000);
    const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000);

    return {
        id: "trip-123",
        riderUserId: "user_rider_1",
        originText: "Stetson University",
        destinationText: "Orlando Airport",
        earliestDesiredAt: earliest,
        latestDesiredAt: latest,
        preferredDepartAt: null,
        distanceCategory: "MEDIUM",
        seatsNeeded: 2,
        pickupInstructions: null,
        dropoffInstructions: null,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

describe("DELETE /api/trip-requests/:tripRequestId", () => {
    beforeEach(() => {
        mockRequireStetsonAuth.mockReset();
        mockPrisma.tripRequest.findUnique.mockReset();
        mockPrisma.tripRequest.updateMany.mockReset();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.tripRequest.updateMany.mockResolvedValue({ count: 1 });
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("returns 200 with the cancelled trip request when the owner cancels an ACTIVE request", async () => {
        mockPrisma.tripRequest.findUnique
            .mockResolvedValueOnce(fakeTripRequest())
            .mockResolvedValueOnce(fakeTripRequest({ status: "CANCELLED", bookings: [] }));

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(mockPrisma.tripRequest.updateMany).toHaveBeenCalledWith({
            where: {
                id: "trip-123",
                riderUserId: "user_rider_1",
                status: "ACTIVE",
            },
            data: { status: "CANCELLED" },
        });
        expect(json).toMatchObject({
            id: "trip-123",
            riderUserId: "user_rider_1",
            status: "CANCELLED",
        });
        expect(json).not.toHaveProperty("bookings");
    });

    it("returns 401 when user is not authenticated", async () => {
        mockRequireStetsonAuth.mockResolvedValue({
            error: new Response(
                JSON.stringify({ error: "Unauthorized", message: "Not authenticated" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            ),
        });

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });

        expect(res.status).toBe(401);
        expect(mockPrisma.tripRequest.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });

    it("returns 403 when the authenticated user does not own the trip request", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValueOnce(
            fakeTripRequest({ riderUserId: "someone-else" })
        );

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json).toEqual({
            error: "Forbidden",
            message: "You don't own this trip request.",
        });
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });

    it("returns 404 when the trip request does not exist", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValueOnce(null);

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json).toEqual({
            error: "Not Found",
            message: "Trip request not found.",
        });
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });

    it("returns 409 when the trip request is already CANCELLED", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValueOnce(
            fakeTripRequest({ status: "CANCELLED" })
        );

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json).toEqual({
            error: "Conflict",
            code: "TRIP_REQUEST_CLOSED",
            message: "Trip request cannot be edited because it is no longer active.",
        });
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });

    it("returns 409 when the trip request is already CLOSED", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValueOnce(
            fakeTripRequest({ status: "CLOSED" })
        );

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json).toEqual({
            error: "Conflict",
            code: "TRIP_REQUEST_CLOSED",
            message: "Trip request cannot be edited because it is no longer active.",
        });
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });

    it("returns 409 with the latest closed state when the conditional cancel loses a race", async () => {
        mockPrisma.tripRequest.findUnique
            .mockResolvedValueOnce(fakeTripRequest())
            .mockResolvedValueOnce(fakeTripRequest({ status: "CLOSED" }));
        mockPrisma.tripRequest.updateMany.mockResolvedValue({ count: 0 });

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(mockPrisma.tripRequest.updateMany).toHaveBeenCalledWith({
            where: {
                id: "trip-123",
                riderUserId: "user_rider_1",
                status: "ACTIVE",
            },
            data: { status: "CANCELLED" },
        });
        expect(json).toEqual({
            error: "Conflict",
            code: "TRIP_REQUEST_CLOSED",
            message: "Trip request cannot be edited because it is no longer active.",
        });
    });

    it("returns 500 when an unexpected exception is thrown", async () => {
        mockPrisma.tripRequest.findUnique.mockRejectedValueOnce(new Error("db down"));

        const res = await DELETE(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-123" }),
        });
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json).toEqual({
            error: "Internal Server Error",
            message: "An unexpected error occurred while cancelling the trip request.",
        });
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });
});
