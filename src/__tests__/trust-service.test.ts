import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        booking: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
        rating: {
            create: vi.fn(),
            aggregate: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(async (callback: (tx: typeof prismaClient) => Promise<unknown>) =>
            callback(prismaClient)
        ),
    };

    return {
        mockPrisma: prismaClient,
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import {
    completeBookingManually,
    createBookingRating,
    getDriverRatingSummary,
} from "@/services/trust-service";

function fakeBooking(overrides: Record<string, unknown> = {}) {
    return {
        id: "booking-1",
        rideId: "ride-1",
        tripRequestId: null,
        riderUserId: "rider-1",
        driverUserId: null,
        seatsBooked: 1,
        priceCents: 1200,
        status: "CONFIRMED",
        completedAt: null,
        createdAt: new Date("2030-01-01T10:00:00.000Z"),
        updatedAt: new Date("2030-01-01T10:00:00.000Z"),
        ride: {
            id: "ride-1",
            driverUserId: "driver-1",
            status: "ACTIVE",
        },
        ...overrides,
    };
}

describe("trust-service completion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows the driver to manually complete an eligible booking", async () => {
        mockPrisma.booking.findUnique
            .mockResolvedValueOnce(fakeBooking())
            .mockResolvedValueOnce(
                fakeBooking({
                    status: "COMPLETED",
                    completedAt: new Date("2030-01-01T12:00:00.000Z"),
                })
            );
        mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });

        const result = await completeBookingManually("booking-1", "driver-1");

        expect(result.status).toBe("COMPLETED");
        expect(result.completedAt).toBeInstanceOf(Date);
        expect(mockPrisma.booking.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "booking-1", status: "CONFIRMED" },
                data: expect.objectContaining({
                    status: "COMPLETED",
                }),
            })
        );
    });

    it("rejects completion when booking is already completed", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBooking({ status: "COMPLETED", completedAt: new Date("2030-01-01T12:00:00.000Z") })
        );

        await expect(completeBookingManually("booking-1", "driver-1")).rejects.toMatchObject({
            statusCode: 409,
            code: "BOOKING_ALREADY_COMPLETED",
        });
        expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it("rejects completion when booking is cancelled", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBooking({ status: "CANCELLED" })
        );

        await expect(completeBookingManually("booking-1", "driver-1")).rejects.toMatchObject({
            statusCode: 409,
            code: "BOOKING_CANCELLED",
        });
    });

    it("rejects completion for unauthorized actors", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(fakeBooking());

        await expect(completeBookingManually("booking-1", "intruder-1")).rejects.toMatchObject({
            statusCode: 403,
            code: "BOOKING_COMPLETE_FORBIDDEN",
        });
    });
});

describe("trust-service rating", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("allows rider to rate a completed booking exactly once", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBooking({
                status: "COMPLETED",
                completedAt: new Date("2030-01-01T12:00:00.000Z"),
            })
        );
        mockPrisma.rating.create.mockResolvedValue({
            id: "rating-1",
            bookingId: "booking-1",
            raterUserId: "rider-1",
            rateeUserId: "driver-1",
            score: 5,
            comment: "Great ride",
            createdAt: new Date("2030-01-01T13:00:00.000Z"),
        });

        const rating = await createBookingRating("booking-1", "rider-1", {
            score: 5,
            comment: "  Great ride  ",
        });

        expect(rating.id).toBe("rating-1");
        expect(mockPrisma.rating.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    bookingId: "booking-1",
                    raterUserId: "rider-1",
                    rateeUserId: "driver-1",
                    score: 5,
                    comment: "Great ride",
                }),
            })
        );
    });

    it("blocks rating for incomplete bookings", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(fakeBooking({ status: "CONFIRMED" }));

        await expect(
            createBookingRating("booking-1", "rider-1", { score: 4 })
        ).rejects.toMatchObject({
            statusCode: 409,
            code: "BOOKING_NOT_COMPLETED",
        });
    });

    it("blocks a second rating for the same booking", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBooking({
                status: "COMPLETED",
                completedAt: new Date("2030-01-01T12:00:00.000Z"),
            })
        );

        const duplicateError = Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
            meta: { target: ["booking_id"] },
        });
        mockPrisma.rating.create.mockRejectedValue(duplicateError);

        await expect(
            createBookingRating("booking-1", "rider-1", { score: 4 })
        ).rejects.toMatchObject({
            statusCode: 409,
            code: "BOOKING_ALREADY_RATED",
        });
    });

    it("blocks non-participants from rating", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(
            fakeBooking({
                status: "COMPLETED",
                completedAt: new Date("2030-01-01T12:00:00.000Z"),
            })
        );

        await expect(
            createBookingRating("booking-1", "stranger-1", { score: 3 })
        ).rejects.toMatchObject({
            statusCode: 403,
            code: "RATING_CREATE_FORBIDDEN",
        });
    });

    it("rejects invalid score values", async () => {
        await expect(
            createBookingRating("booking-1", "rider-1", { score: 0 })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "RATING_INVALID_SCORE",
        });
        expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled();
    });
});

describe("trust-service rating summary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("computes average and count for a driver", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ clerkUserId: "driver-1" });
        mockPrisma.rating.aggregate.mockResolvedValue({
            _avg: { score: 4.333333333333333 },
            _count: { _all: 3 },
        });

        const summary = await getDriverRatingSummary("driver-1");

        expect(summary).toEqual({
            userId: "driver-1",
            averageRating: 4.33,
            ratingCount: 3,
        });
    });
});
