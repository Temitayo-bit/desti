import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockPrisma: {
            tripRequest: {
                findUnique: vi.fn(),
                updateMany: vi.fn(),
            },
            $transaction: vi
                .fn()
                .mockImplementation((queries: Array<Promise<unknown>>) =>
                    Promise.all(queries)
                ),
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

import { PATCH } from "@/app/api/trip-requests/[tripRequestId]/route";

function makeRequest(
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
): Request {
    return new Request("http://localhost:3000/api/trip-requests/trip-123", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
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

function fakeTripRequest(
    overrides: Record<string, unknown> = {},
    hasConfirmedBooking = false
) {
    const now = new Date();
    const earliest = new Date(now.getTime() + 60 * 60 * 1000); // +1h
    const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000); // +3h

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
        bookings: hasConfirmedBooking ? [{ status: "CONFIRMED" }] : [],
        ...overrides,
    };
}

describe("PATCH /api/trip-requests/:tripRequestId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
    });

    it("1) Owner can edit when no CONFIRMED booking exists", async () => {
        const currentTripRequest = fakeTripRequest();
        const updatedTripRequest = fakeTripRequest({
            destinationText: "Sanford Airport",
            seatsNeeded: 3,
            bookings: [],
        });

        mockPrisma.tripRequest.findUnique
            .mockResolvedValueOnce(currentTripRequest)
            .mockResolvedValueOnce(updatedTripRequest);
        mockPrisma.tripRequest.updateMany.mockResolvedValue({ count: 1 });

        const res = await PATCH(
            makeRequest({
                destinationText: "  Sanford Airport ",
                seatsNeeded: 3,
            }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).not.toHaveProperty("bookings");
        expect(mockPrisma.tripRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "trip-123",
                    riderUserId: "user_rider_1",
                    status: "ACTIVE",
                    updatedAt: currentTripRequest.updatedAt,
                    bookings: { none: { status: "CONFIRMED" } },
                }),
                data: expect.objectContaining({
                    destinationText: "Sanford Airport",
                    seatsNeeded: 3,
                }),
            })
        );
    });

    it("2) Owner cannot edit after CONFIRMED booking exists (409)", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(
            fakeTripRequest({}, true)
        );

        const res = await PATCH(
            makeRequest({ destinationText: "New place" }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.code).toBe("TRIP_REQUEST_EDIT_LOCKED_CONFIRMED");
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });

    it("3) Non-owner cannot edit (403)", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(
            fakeTripRequest({ riderUserId: "someone-else" })
        );

        const res = await PATCH(
            makeRequest({ seatsNeeded: 1 }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );

        expect(res.status).toBe(403);
        expect(mockPrisma.tripRequest.updateMany).not.toHaveBeenCalled();
    });

    it("4) Invalid window ordering rejected (400)", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(fakeTripRequest());

        const now = new Date();
        const earliest = new Date(now.getTime() + 5 * 60 * 60 * 1000);
        const latest = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const res = await PATCH(
            makeRequest({
                earliestDesiredAt: earliest.toISOString(),
                latestDesiredAt: latest.toISOString(),
            }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.details.map((d: { field: string }) => d.field)).toContain(
            "latestDesiredAt"
        );
    });

    it("5) preferredDepartAt outside window rejected (400)", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(fakeTripRequest());

        const now = new Date();
        const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const latest = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        const preferredOutside = new Date(now.getTime() + 5 * 60 * 60 * 1000);

        const res = await PATCH(
            makeRequest({
                earliestDesiredAt: earliest.toISOString(),
                latestDesiredAt: latest.toISOString(),
                preferredDepartAt: preferredOutside.toISOString(),
            }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.details.map((d: { field: string }) => d.field)).toContain(
            "preferredDepartAt"
        );
    });

    it("6) CLOSED trip requests cannot be edited (409)", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValueOnce(
            fakeTripRequest({ status: "CLOSED" })
        );

        const closedRes = await PATCH(
            makeRequest({ seatsNeeded: 3 }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const closedJson = await closedRes.json();
        expect(closedRes.status).toBe(409);
        expect(closedJson.code).toBe("TRIP_REQUEST_CLOSED");
    });

    it("7) CANCELLED trip requests cannot be edited (409)", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValueOnce(
            fakeTripRequest({ status: "CANCELLED" })
        );

        const cancelledRes = await PATCH(
            makeRequest({ seatsNeeded: 3 }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const cancelledJson = await cancelledRes.json();

        expect(cancelledRes.status).toBe(409);
        expect(cancelledJson.code).toBe("TRIP_REQUEST_CLOSED");
    });

    it("8) allows clearing instruction fields with null", async () => {
        const currentTripRequest = fakeTripRequest({
            pickupInstructions: "Gate A",
            dropoffInstructions: "Dorm lobby",
        });
        const updatedTripRequest = fakeTripRequest({
            pickupInstructions: null,
            dropoffInstructions: null,
            bookings: [],
        });

        mockPrisma.tripRequest.findUnique
            .mockResolvedValueOnce(currentTripRequest)
            .mockResolvedValueOnce(updatedTripRequest);
        mockPrisma.tripRequest.updateMany.mockResolvedValue({ count: 1 });

        const res = await PATCH(
            makeRequest({
                pickupInstructions: null,
                dropoffInstructions: null,
            }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );

        expect(res.status).toBe(200);
        expect(mockPrisma.tripRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    pickupInstructions: null,
                    dropoffInstructions: null,
                }),
            })
        );
    });

    it("9) rejects empty instruction strings after trimming", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(fakeTripRequest());

        const res = await PATCH(
            makeRequest({
                pickupInstructions: "   ",
                dropoffInstructions: "\t  ",
            }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(400);
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("pickupInstructions");
        expect(fields).toContain("dropoffInstructions");
    });

    it("10) rejects instruction strings longer than 500 characters", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(fakeTripRequest());
        const tooLong = "x".repeat(501);

        const res = await PATCH(
            makeRequest({
                pickupInstructions: tooLong,
                dropoffInstructions: tooLong,
            }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(400);
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("pickupInstructions");
        expect(fields).toContain("dropoffInstructions");
    });

    it("11) accepts valid instruction strings and trims values", async () => {
        const currentTripRequest = fakeTripRequest();
        const updatedTripRequest = fakeTripRequest({
            pickupInstructions: "Gate A",
            dropoffInstructions: "Dorm lobby",
            bookings: [],
        });

        mockPrisma.tripRequest.findUnique
            .mockResolvedValueOnce(currentTripRequest)
            .mockResolvedValueOnce(updatedTripRequest);
        mockPrisma.tripRequest.updateMany.mockResolvedValue({ count: 1 });

        const res = await PATCH(
            makeRequest({
                pickupInstructions: "  Gate A  ",
                dropoffInstructions: "  Dorm lobby  ",
            }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );

        expect(res.status).toBe(200);
        expect(mockPrisma.tripRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    pickupInstructions: "Gate A",
                    dropoffInstructions: "Dorm lobby",
                }),
            })
        );
    });

    it("12) rejects unknown fields with 400", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(fakeTripRequest());

        const res = await PATCH(
            makeRequest({ unknownField: "unexpected" }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.message).toContain("Unknown fields");
    });

    it("13) returns 409 when optimistic concurrency guard fails", async () => {
        const currentTripRequest = fakeTripRequest();
        const latestTripRequest = fakeTripRequest({ bookings: [] });

        mockPrisma.tripRequest.findUnique
            .mockResolvedValueOnce(currentTripRequest)
            .mockResolvedValueOnce(latestTripRequest);
        mockPrisma.tripRequest.updateMany.mockResolvedValue({ count: 0 });

        const res = await PATCH(
            makeRequest({ destinationText: "Updated destination" }) as never,
            { params: Promise.resolve({ tripRequestId: "trip-123" }) }
        );
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.error).toBe("Conflict");
        expect(json.message).toContain("could not be completed");
    });
});
