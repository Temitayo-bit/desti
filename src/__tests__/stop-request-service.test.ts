import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
    const topLevelRide = {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
    };

    const topLevelStopRequest = {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
    };

    const topLevelBooking = {
        findFirst: vi.fn(),
        create: vi.fn(),
    };

    const txRide = {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
    };

    const txStopRequest = {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
    };

    const txBooking = {
        findFirst: vi.fn(),
        create: vi.fn(),
    };

    const txClient = { ride: txRide, stopRequest: txStopRequest, booking: txBooking };

    const prismaClient = {
        ride: topLevelRide,
        stopRequest: topLevelStopRequest,
        booking: topLevelBooking,
        $transaction: vi.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient)),
    };

    return {
        mockPrisma: prismaClient,
        mockTx: txClient,
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import {
    acceptStopRequest,
    createStopRequest,
    listStopRequestsForDriver,
    listStopRequestsForRider,
    quoteStopRequest,
    rejectStopRequest,
    StopRequestError,
} from "@/services/stop-request-service";

const ACTIVE_FUTURE_RIDE = {
    id: "ride-1",
    driverUserId: "driver-1",
    status: "ACTIVE",
    latestDepartAt: new Date("2030-01-01T12:00:00.000Z"),
    seatsAvailable: 2,
    originLatitude: 29.028,
    originLongitude: -81.303,
    destinationLatitude: 28.431,
    destinationLongitude: -81.308,
};

const PENDING_STOP_REQUEST = {
    id: "stop-1",
    rideId: "ride-1",
    riderUserId: "rider-1",
    driverUserId: "driver-1",
    requestedPickupText: "Library",
    requestedPickupLatitude: 29.028,
    requestedPickupLongitude: -81.303,
    requestedDropoffText: "Airport",
    requestedDropoffLatitude: 28.431,
    requestedDropoffLongitude: -81.308,
    riderNote: "Near south entrance",
    quotedPriceCents: null,
    state: "PENDING",
    createdAt: new Date("2030-01-01T08:00:00.000Z"),
    updatedAt: new Date("2030-01-01T08:00:00.000Z"),
    quotedAt: null,
    acceptedAt: null,
    rejectedAt: null,
    ride: ACTIVE_FUTURE_RIDE,
};

const QUOTED_STOP_REQUEST = {
    ...PENDING_STOP_REQUEST,
    state: "QUOTED",
    quotedPriceCents: 1800,
    quotedAt: new Date("2030-01-01T08:10:00.000Z"),
};

describe("stop-request-service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createStopRequest", () => {
        it("creates a valid pending stop request", async () => {
            mockTx.ride.findUnique.mockResolvedValue(ACTIVE_FUTURE_RIDE);
            mockTx.booking.findFirst.mockResolvedValue(null);
            mockTx.stopRequest.create.mockResolvedValue({
                ...PENDING_STOP_REQUEST,
                ride: undefined,
            });

            const result = await createStopRequest("ride-1", "rider-1", {
                requestedPickupText: " Library ",
                requestedPickupLatitude: 29.028,
                requestedPickupLongitude: -81.303,
                requestedDropoffText: " Airport ",
                requestedDropoffLatitude: 28.431,
                requestedDropoffLongitude: -81.308,
                riderNote: "  near entrance  ",
            });

            expect(result.state).toBe("PENDING");
            expect(result.riderUserId).toBe("rider-1");
            expect(mockTx.stopRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        requestedPickupText: "Library",
                        requestedDropoffText: "Airport",
                    }),
                })
            );
            expect(mockPrisma.stopRequest.create).not.toHaveBeenCalled();
            expect(mockPrisma.ride.findUnique).not.toHaveBeenCalled();
            expect(mockPrisma.booking.findFirst).not.toHaveBeenCalled();
        });

        it("allows multiple pending stop requests on the same ride", async () => {
            mockTx.ride.findUnique.mockResolvedValue(ACTIVE_FUTURE_RIDE);
            mockTx.booking.findFirst.mockResolvedValue(null);
            mockTx.stopRequest.create
                .mockResolvedValueOnce({ ...PENDING_STOP_REQUEST, id: "stop-1", ride: undefined })
                .mockResolvedValueOnce({ ...PENDING_STOP_REQUEST, id: "stop-2", ride: undefined });

            const one = await createStopRequest("ride-1", "rider-1", {
                requestedPickupText: "Library",
                requestedPickupLatitude: 29.028,
                requestedPickupLongitude: -81.303,
                requestedDropoffText: "Airport",
                requestedDropoffLatitude: 28.431,
                requestedDropoffLongitude: -81.308,
            });
            const two = await createStopRequest("ride-1", "rider-1", {
                requestedPickupText: "Stadium",
                requestedPickupLatitude: 29.036,
                requestedPickupLongitude: -81.304,
                requestedDropoffText: "Airport",
                requestedDropoffLatitude: 28.431,
                requestedDropoffLongitude: -81.308,
            });

            expect(one.id).toBe("stop-1");
            expect(two.id).toBe("stop-2");
        });

        it("blocks self-stop-request", async () => {
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                driverUserId: "rider-1",
            });

            await expect(
                createStopRequest("ride-1", "rider-1", {
                    requestedPickupText: "Library",
                    requestedPickupLatitude: 29.028,
                    requestedPickupLongitude: -81.303,
                    requestedDropoffText: "Airport",
                    requestedDropoffLatitude: 28.431,
                    requestedDropoffLongitude: -81.308,
                })
            ).rejects.toMatchObject<Partial<StopRequestError>>({
                statusCode: 409,
                code: "SELF_STOP_REQUEST_NOT_ALLOWED",
            });
        });

        it("blocks stop requests on cancelled rides", async () => {
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                status: "CANCELLED",
            });

            await expect(
                createStopRequest("ride-1", "rider-1", {
                    requestedPickupText: "Library",
                    requestedPickupLatitude: 29.028,
                    requestedPickupLongitude: -81.303,
                    requestedDropoffText: "Airport",
                    requestedDropoffLatitude: 28.431,
                    requestedDropoffLongitude: -81.308,
                })
            ).rejects.toMatchObject<Partial<StopRequestError>>({
                statusCode: 409,
                code: "RIDE_NOT_ACTIVE",
            });
        });

        it("blocks stop requests on departed rides", async () => {
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                latestDepartAt: new Date("2000-01-01T00:00:00.000Z"),
            });

            await expect(
                createStopRequest("ride-1", "rider-1", {
                    requestedPickupText: "Library",
                    requestedPickupLatitude: 29.028,
                    requestedPickupLongitude: -81.303,
                    requestedDropoffText: "Airport",
                    requestedDropoffLatitude: 28.431,
                    requestedDropoffLongitude: -81.308,
                })
            ).rejects.toMatchObject<Partial<StopRequestError>>({
                statusCode: 409,
                code: "RIDE_DEPARTED",
            });
        });

        it("allows pending stop requests on full rides (capacity checked at accept time)", async () => {
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                seatsAvailable: 0,
            });
            mockTx.booking.findFirst.mockResolvedValue(null);
            mockTx.stopRequest.create.mockResolvedValue({
                ...PENDING_STOP_REQUEST,
                ride: undefined,
            });

            const result = await createStopRequest("ride-1", "rider-1", {
                requestedPickupText: "Library",
                requestedPickupLatitude: 29.028,
                requestedPickupLongitude: -81.303,
                requestedDropoffText: "Airport",
                requestedDropoffLatitude: 29.179,
                requestedDropoffLongitude: -81.058,
            });

            expect(result.state).toBe("PENDING");
        });

        it("blocks invalid coordinates/text", async () => {
            await expect(
                createStopRequest("ride-1", "rider-1", {
                    requestedPickupText: "   ",
                    requestedPickupLatitude: 100,
                    requestedPickupLongitude: -81.303,
                    requestedDropoffText: "Airport",
                    requestedDropoffLatitude: 29.179,
                    requestedDropoffLongitude: -81.058,
                })
            ).rejects.toMatchObject<Partial<StopRequestError>>({
                statusCode: 400,
                code: "STOP_REQUEST_INVALID_PAYLOAD",
            });
        });

        it("blocks stop requests whose pickup is outside ride jurisdiction", async () => {
            mockTx.ride.findUnique.mockResolvedValue(ACTIVE_FUTURE_RIDE);

            await expect(
                createStopRequest("ride-1", "rider-1", {
                    requestedPickupText: "Very Far Pickup",
                    requestedPickupLatitude: 33.749,
                    requestedPickupLongitude: -84.388,
                    requestedDropoffText: "Airport",
                    requestedDropoffLatitude: 28.431,
                    requestedDropoffLongitude: -81.308,
                })
            ).rejects.toMatchObject<Partial<StopRequestError>>({
                statusCode: 409,
                code: "STOP_REQUEST_PICKUP_OUT_OF_RANGE",
            });
        });

        it("blocks stop requests whose dropoff is outside ride jurisdiction", async () => {
            mockTx.ride.findUnique.mockResolvedValue(ACTIVE_FUTURE_RIDE);

            await expect(
                createStopRequest("ride-1", "rider-1", {
                    requestedPickupText: "Library",
                    requestedPickupLatitude: 29.028,
                    requestedPickupLongitude: -81.303,
                    requestedDropoffText: "Very Far Dropoff",
                    requestedDropoffLatitude: 33.749,
                    requestedDropoffLongitude: -84.388,
                })
            ).rejects.toMatchObject<Partial<StopRequestError>>({
                statusCode: 409,
                code: "STOP_REQUEST_DROPOFF_OUT_OF_RANGE",
            });
        });

        it("blocks stop requests when ride coordinates are unavailable", async () => {
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                originLatitude: null,
                originLongitude: null,
                destinationLatitude: null,
                destinationLongitude: null,
            });

            await expect(
                createStopRequest("ride-1", "rider-1", {
                    requestedPickupText: "Library",
                    requestedPickupLatitude: 29.028,
                    requestedPickupLongitude: -81.303,
                    requestedDropoffText: "Airport",
                    requestedDropoffLatitude: 28.431,
                    requestedDropoffLongitude: -81.308,
                })
            ).rejects.toMatchObject<Partial<StopRequestError>>({
                statusCode: 409,
                code: "RIDE_COORDINATES_UNAVAILABLE",
            });
        });
    });

    describe("visibility", () => {
        it("allows driver to view incoming stop requests on own ride", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                id: "ride-1",
                driverUserId: "driver-1",
            });
            mockPrisma.stopRequest.findMany.mockResolvedValue([PENDING_STOP_REQUEST]);

            const items = await listStopRequestsForDriver("ride-1", "driver-1");

            expect(items).toHaveLength(1);
            expect(mockPrisma.stopRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        rideId: "ride-1",
                        driverUserId: "driver-1",
                    }),
                })
            );
            expect(mockTx.stopRequest.findMany).not.toHaveBeenCalled();
        });

        it("blocks unrelated users from viewing incoming stop requests", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                id: "ride-1",
                driverUserId: "driver-1",
            });

            await expect(listStopRequestsForDriver("ride-1", "driver-2")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 403,
                code: "STOP_REQUEST_FORBIDDEN",
            });
        });

        it("returns only rider-scoped outgoing stop requests", async () => {
            mockPrisma.stopRequest.findMany.mockResolvedValue([PENDING_STOP_REQUEST]);

            const items = await listStopRequestsForRider("rider-1");

            expect(items).toHaveLength(1);
            expect(mockPrisma.stopRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { riderUserId: "rider-1" },
                })
            );
            expect(mockTx.stopRequest.findMany).not.toHaveBeenCalled();
        });
    });

    describe("quoteStopRequest", () => {
        it("allows driver to quote pending stop request", async () => {
            mockTx.stopRequest.findUnique
                .mockResolvedValueOnce(PENDING_STOP_REQUEST)
                .mockResolvedValueOnce({
                    ...QUOTED_STOP_REQUEST,
                    ride: undefined,
                });
            mockTx.stopRequest.updateMany.mockResolvedValue({ count: 1 });

            const result = await quoteStopRequest("stop-1", "driver-1", 1800);

            expect(result.state).toBe("QUOTED");
            expect(result.quotedPriceCents).toBe(1800);
        });

        it("fails when quoting a non-pending stop request", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(QUOTED_STOP_REQUEST);

            await expect(quoteStopRequest("stop-1", "driver-1", 1800)).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 409,
                code: "STOP_REQUEST_NOT_PENDING",
            });
        });

        it("fails invalid quote price", async () => {
            await expect(quoteStopRequest("stop-1", "driver-1", 0)).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 400,
                code: "STOP_REQUEST_INVALID_PRICE",
            });
        });

        it("blocks non-driver quoting", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(PENDING_STOP_REQUEST);

            await expect(quoteStopRequest("stop-1", "driver-2", 1800)).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 403,
                code: "STOP_REQUEST_FORBIDDEN",
            });
        });
    });

    describe("acceptStopRequest", () => {
        it("allows rider to accept quoted request and create booking atomically", async () => {
            mockTx.stopRequest.findUnique
                .mockResolvedValueOnce(QUOTED_STOP_REQUEST)
                .mockResolvedValueOnce({
                    ...QUOTED_STOP_REQUEST,
                    state: "ACCEPTED",
                    acceptedAt: new Date("2030-01-01T08:20:00.000Z"),
                    ride: undefined,
                });
            mockTx.ride.updateMany.mockResolvedValue({ count: 1 });
            mockTx.booking.create.mockResolvedValue({
                id: "booking-1",
                rideId: "ride-1",
                tripRequestId: null,
                driverUserId: "driver-1",
                riderUserId: "rider-1",
                seatsBooked: 1,
                priceCents: 1800,
                status: "CONFIRMED",
                createdAt: new Date("2030-01-01T08:21:00.000Z"),
                updatedAt: new Date("2030-01-01T08:21:00.000Z"),
            });
            mockTx.stopRequest.updateMany.mockResolvedValue({ count: 1 });

            const result = await acceptStopRequest("stop-1", "rider-1");

            expect(result.stopRequest.state).toBe("ACCEPTED");
            expect(result.booking.status).toBe("CONFIRMED");
            expect(mockTx.ride.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: "ride-1",
                        status: "ACTIVE",
                        latestDepartAt: { gt: expect.any(Date) },
                        seatsAvailable: { gte: 1 },
                    }),
                    data: { seatsAvailable: { decrement: 1 } },
                })
            );
            expect(mockTx.booking.create).toHaveBeenCalled();
            expect(mockTx.stopRequest.updateMany).toHaveBeenCalled();
            expect(mockPrisma.ride.updateMany).not.toHaveBeenCalled();
            expect(mockPrisma.booking.create).not.toHaveBeenCalled();
            expect(mockPrisma.stopRequest.updateMany).not.toHaveBeenCalled();
        });

        it("fails safely if seat is consumed before acceptance", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(QUOTED_STOP_REQUEST);
            mockTx.ride.updateMany.mockResolvedValue({ count: 0 });
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                seatsAvailable: 0,
            });

            await expect(acceptStopRequest("stop-1", "rider-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 409,
                code: "RIDE_FULL",
            });

            expect(mockTx.booking.create).not.toHaveBeenCalled();
        });

        it("fails with forbidden when stop request ownership mismatches ride ownership", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(QUOTED_STOP_REQUEST);
            mockTx.ride.updateMany.mockResolvedValue({ count: 0 });
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                driverUserId: "driver-other",
            });

            await expect(acceptStopRequest("stop-1", "rider-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 403,
                code: "STOP_REQUEST_FORBIDDEN",
            });

            expect(mockTx.booking.create).not.toHaveBeenCalled();
        });

        it("fails safely if ride becomes cancelled before acceptance", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(QUOTED_STOP_REQUEST);
            mockTx.ride.updateMany.mockResolvedValue({ count: 0 });
            mockTx.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                status: "CANCELLED",
            });

            await expect(acceptStopRequest("stop-1", "rider-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 409,
                code: "RIDE_NOT_ACTIVE",
            });

            expect(mockTx.booking.create).not.toHaveBeenCalled();
        });

        it("does not mark accepted when booking creation fails", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(QUOTED_STOP_REQUEST);
            mockTx.ride.updateMany.mockResolvedValue({ count: 1 });
            mockTx.booking.create.mockRejectedValue(new Error("booking write failed"));

            await expect(acceptStopRequest("stop-1", "rider-1")).rejects.toThrow("booking write failed");
            expect(mockTx.stopRequest.updateMany).not.toHaveBeenCalled();
        });

        it("cannot accept an already accepted stop request", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue({
                ...QUOTED_STOP_REQUEST,
                state: "ACCEPTED",
            });

            await expect(acceptStopRequest("stop-1", "rider-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 409,
                code: "STOP_REQUEST_NOT_QUOTED",
            });
        });

        it("cannot accept a rejected stop request", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue({
                ...QUOTED_STOP_REQUEST,
                state: "REJECTED",
            });

            await expect(acceptStopRequest("stop-1", "rider-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 409,
                code: "STOP_REQUEST_NOT_QUOTED",
            });
        });

        it("blocks non-rider acceptance", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(QUOTED_STOP_REQUEST);

            await expect(acceptStopRequest("stop-1", "rider-2")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 403,
                code: "STOP_REQUEST_FORBIDDEN",
            });
        });
    });

    describe("rejectStopRequest", () => {
        it("allows driver to reject pending stop request", async () => {
            mockTx.stopRequest.findUnique
                .mockResolvedValueOnce(PENDING_STOP_REQUEST)
                .mockResolvedValueOnce({
                    ...PENDING_STOP_REQUEST,
                    state: "REJECTED",
                    rejectedAt: new Date("2030-01-01T08:40:00.000Z"),
                    ride: undefined,
                });
            mockTx.stopRequest.updateMany.mockResolvedValue({ count: 1 });

            const result = await rejectStopRequest("stop-1", "driver-1");

            expect(result.state).toBe("REJECTED");
        });

        it("allows rider to reject quoted stop request", async () => {
            mockTx.stopRequest.findUnique
                .mockResolvedValueOnce(QUOTED_STOP_REQUEST)
                .mockResolvedValueOnce({
                    ...QUOTED_STOP_REQUEST,
                    state: "REJECTED",
                    rejectedAt: new Date("2030-01-01T08:41:00.000Z"),
                    ride: undefined,
                });
            mockTx.stopRequest.updateMany.mockResolvedValue({ count: 1 });

            const result = await rejectStopRequest("stop-1", "rider-1");

            expect(result.state).toBe("REJECTED");
        });

        it("blocks unauthorized rejection", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue(QUOTED_STOP_REQUEST);

            await expect(rejectStopRequest("stop-1", "intruder-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 403,
                code: "STOP_REQUEST_FORBIDDEN",
            });
        });

        it("requires non-empty stopRequestId in rejectStopRequest", async () => {
            await expect(rejectStopRequest("   ", "driver-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 400,
                code: "STOP_REQUEST_INVALID_ID",
            });
        });

        it("keeps rejected stop requests closed", async () => {
            mockTx.stopRequest.findUnique.mockResolvedValue({
                ...QUOTED_STOP_REQUEST,
                state: "REJECTED",
            });

            await expect(rejectStopRequest("stop-1", "driver-1")).rejects.toMatchObject<
                Partial<StopRequestError>
            >({
                statusCode: 409,
                code: "STOP_REQUEST_NOT_REJECTABLE",
            });
        });
    });
});
