import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
    const ride = {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
    };

    const rideOffer = {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
    };

    const booking = {
        create: vi.fn(),
    };

    const txClient = { ride, rideOffer, booking };

    const prismaClient = {
        ride,
        rideOffer,
        booking,
        $transaction: vi.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient)),
    };

    return {
        mockPrisma: prismaClient,
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import {
    acceptRideOffer,
    createRideOffer,
    listRideOffersForDriver,
    listRideOffersForRider,
    rejectRideOffer,
    RideOfferError,
} from "@/services/ride-offer-service";

const ACTIVE_FUTURE_RIDE = {
    id: "ride-1",
    driverUserId: "driver-1",
    status: "ACTIVE",
    latestDepartAt: new Date("2030-01-01T12:00:00.000Z"),
    seatsAvailable: 2,
};

const PENDING_OFFER = {
    id: "offer-1",
    rideId: "ride-1",
    riderUserId: "rider-1",
    driverUserId: "driver-1",
    offeredPriceCents: 1500,
    state: "PENDING",
    createdAt: new Date("2030-01-01T08:00:00.000Z"),
    updatedAt: new Date("2030-01-01T08:00:00.000Z"),
    acceptedAt: null,
    rejectedAt: null,
    ride: ACTIVE_FUTURE_RIDE,
};

describe("ride-offer-service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createRideOffer", () => {
        it("creates one valid pending offer", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue(ACTIVE_FUTURE_RIDE);
            mockPrisma.rideOffer.findFirst.mockResolvedValue(null);
            mockPrisma.rideOffer.create.mockResolvedValue({
                ...PENDING_OFFER,
                ride: undefined,
            });

            const result = await createRideOffer("ride-1", "rider-1", 1500);

            expect(result.state).toBe("PENDING");
            expect(result.rideId).toBe("ride-1");
            expect(result.riderUserId).toBe("rider-1");
            expect(result.offeredPriceCents).toBe(1500);
        });

        it("blocks self-offers", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                driverUserId: "rider-1",
            });

            await expect(createRideOffer("ride-1", "rider-1", 1500)).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "SELF_OFFER_NOT_ALLOWED",
            });
        });

        it("blocks duplicate active offers from the same rider on one ride", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue(ACTIVE_FUTURE_RIDE);
            mockPrisma.rideOffer.findFirst.mockResolvedValue({ id: "offer-existing" });

            await expect(createRideOffer("ride-1", "rider-1", 1500)).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "RIDE_OFFER_ALREADY_ACTIVE",
            });
        });

        it("blocks offers on cancelled rides", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                status: "CANCELLED",
            });

            await expect(createRideOffer("ride-1", "rider-1", 1500)).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "RIDE_NOT_ACTIVE",
            });
        });

        it("blocks offers on departed rides", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                latestDepartAt: new Date("2000-01-01T00:00:00.000Z"),
            });

            await expect(createRideOffer("ride-1", "rider-1", 1500)).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "RIDE_DEPARTED",
            });
        });

        it("blocks offers on full rides", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                seatsAvailable: 0,
            });

            await expect(createRideOffer("ride-1", "rider-1", 1500)).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "RIDE_NO_SEATS",
            });
        });

        it("blocks invalid offered prices", async () => {
            await expect(createRideOffer("ride-1", "rider-1", 0)).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 400,
                code: "RIDE_OFFER_INVALID_PRICE",
            });
        });
    });

    describe("visibility", () => {
        it("allows driver to see incoming offers on their own ride", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                id: "ride-1",
                driverUserId: "driver-1",
            });
            mockPrisma.rideOffer.findMany.mockResolvedValue([PENDING_OFFER]);

            const items = await listRideOffersForDriver("ride-1", "driver-1");

            expect(items).toHaveLength(1);
            expect(mockPrisma.rideOffer.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        rideId: "ride-1",
                        driverUserId: "driver-1",
                    }),
                })
            );
        });

        it("blocks unrelated users from reading incoming offers", async () => {
            mockPrisma.ride.findUnique.mockResolvedValue({
                id: "ride-1",
                driverUserId: "driver-1",
            });

            await expect(listRideOffersForDriver("ride-1", "driver-2")).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 403,
                code: "RIDE_OFFER_FORBIDDEN",
            });
        });

        it("returns only outgoing offers for the rider scope", async () => {
            mockPrisma.rideOffer.findMany.mockResolvedValue([PENDING_OFFER]);

            const items = await listRideOffersForRider("rider-1");

            expect(items).toHaveLength(1);
            expect(mockPrisma.rideOffer.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { riderUserId: "rider-1" },
                })
            );
        });
    });

    describe("acceptRideOffer", () => {
        it("allows driver to accept a pending offer and creates booking atomically", async () => {
            mockPrisma.rideOffer.findUnique
                .mockResolvedValueOnce(PENDING_OFFER)
                .mockResolvedValueOnce({
                    ...PENDING_OFFER,
                    state: "ACCEPTED",
                    acceptedAt: new Date("2030-01-01T08:30:00.000Z"),
                    ride: undefined,
                });
            mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
            mockPrisma.booking.create.mockResolvedValue({
                id: "booking-1",
                rideId: "ride-1",
                tripRequestId: null,
                driverUserId: "driver-1",
                riderUserId: "rider-1",
                seatsBooked: 1,
                priceCents: 1500,
                status: "CONFIRMED",
                createdAt: new Date("2030-01-01T08:31:00.000Z"),
                updatedAt: new Date("2030-01-01T08:31:00.000Z"),
            });
            mockPrisma.rideOffer.updateMany.mockResolvedValue({ count: 1 });

            const result = await acceptRideOffer("offer-1", "driver-1");

            expect(result.offer.state).toBe("ACCEPTED");
            expect(result.booking.status).toBe("CONFIRMED");
            expect(result.booking.seatsBooked).toBe(1);
            expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: "ride-1",
                        status: "ACTIVE",
                        seatsAvailable: { gte: 1 },
                    }),
                    data: { seatsAvailable: { decrement: 1 } },
                })
            );
        });

        it("fails safely if seat is gone before acceptance (coexistence with direct booking)", async () => {
            mockPrisma.rideOffer.findUnique.mockResolvedValue(PENDING_OFFER);
            mockPrisma.ride.updateMany.mockResolvedValue({ count: 0 });
            mockPrisma.ride.findUnique.mockResolvedValue({
                ...ACTIVE_FUTURE_RIDE,
                seatsAvailable: 0,
            });

            await expect(acceptRideOffer("offer-1", "driver-1")).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "RIDE_NO_SEATS",
            });

            expect(mockPrisma.booking.create).not.toHaveBeenCalled();
        });

        it("does not transition offer to ACCEPTED if booking creation fails", async () => {
            mockPrisma.rideOffer.findUnique.mockResolvedValue(PENDING_OFFER);
            mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
            mockPrisma.booking.create.mockRejectedValue(new Error("booking write failed"));

            await expect(acceptRideOffer("offer-1", "driver-1")).rejects.toThrow("booking write failed");
            expect(mockPrisma.rideOffer.updateMany).not.toHaveBeenCalled();
        });

        it("cannot accept an already accepted offer", async () => {
            mockPrisma.rideOffer.findUnique.mockResolvedValue({
                ...PENDING_OFFER,
                state: "ACCEPTED",
            });

            await expect(acceptRideOffer("offer-1", "driver-1")).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "RIDE_OFFER_NOT_PENDING",
            });
        });

        it("blocks non-driver acceptance", async () => {
            mockPrisma.rideOffer.findUnique.mockResolvedValue(PENDING_OFFER);

            await expect(acceptRideOffer("offer-1", "driver-2")).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 403,
                code: "RIDE_OFFER_FORBIDDEN",
            });
        });
    });

    describe("rejectRideOffer", () => {
        it("allows driver to reject pending offers", async () => {
            mockPrisma.rideOffer.findUnique
                .mockResolvedValueOnce(PENDING_OFFER)
                .mockResolvedValueOnce({
                    ...PENDING_OFFER,
                    state: "REJECTED",
                    rejectedAt: new Date("2030-01-01T08:40:00.000Z"),
                    ride: undefined,
                });
            mockPrisma.rideOffer.updateMany.mockResolvedValue({ count: 1 });

            const result = await rejectRideOffer("offer-1", "driver-1");

            expect(result.state).toBe("REJECTED");
        });

        it("keeps rejected offers rejected (cannot reject again)", async () => {
            mockPrisma.rideOffer.findUnique.mockResolvedValue({
                ...PENDING_OFFER,
                state: "REJECTED",
            });

            await expect(rejectRideOffer("offer-1", "driver-1")).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 409,
                code: "RIDE_OFFER_NOT_PENDING",
            });
        });

        it("blocks non-drivers from rejecting", async () => {
            mockPrisma.rideOffer.findUnique.mockResolvedValue(PENDING_OFFER);

            await expect(rejectRideOffer("offer-1", "driver-2")).rejects.toMatchObject<Partial<RideOfferError>>({
                statusCode: 403,
                code: "RIDE_OFFER_FORBIDDEN",
            });
        });
    });
});
