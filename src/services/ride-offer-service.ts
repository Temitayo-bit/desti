import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const rideBookabilitySelect = {
    id: true,
    driverUserId: true,
    status: true,
    latestDepartAt: true,
    seatsAvailable: true,
} satisfies Prisma.RideSelect;

const rideOfferBaseSelect = {
    id: true,
    rideId: true,
    riderUserId: true,
    driverUserId: true,
    offeredPriceCents: true,
    state: true,
    createdAt: true,
    updatedAt: true,
    acceptedAt: true,
    rejectedAt: true,
} satisfies Prisma.RideOfferSelect;

const rideOfferListSelect = {
    ...rideOfferBaseSelect,
    ride: {
        select: {
            id: true,
            originText: true,
            destinationText: true,
            earliestDepartAt: true,
            latestDepartAt: true,
            seatsAvailable: true,
            status: true,
        },
    },
} satisfies Prisma.RideOfferSelect;

const rideOfferWithRideSelect = {
    ...rideOfferBaseSelect,
    ride: {
        select: rideBookabilitySelect,
    },
} satisfies Prisma.RideOfferSelect;

const acceptedBookingSelect = {
    id: true,
    rideId: true,
    tripRequestId: true,
    driverUserId: true,
    riderUserId: true,
    seatsBooked: true,
    priceCents: true,
    status: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.BookingSelect;

export type RideOfferRecord = Prisma.RideOfferGetPayload<{
    select: typeof rideOfferBaseSelect;
}>;

export type RideOfferListRecord = Prisma.RideOfferGetPayload<{
    select: typeof rideOfferListSelect;
}>;

export type AcceptedRideOfferBooking = Prisma.BookingGetPayload<{
    select: typeof acceptedBookingSelect;
}>;

export interface AcceptedRideOfferResult {
    offer: RideOfferRecord;
    booking: AcceptedRideOfferBooking;
}

export class RideOfferError extends Error {
    statusCode: number;
    error: string;
    code: string;

    constructor(
        message: string,
        {
            statusCode,
            error,
            code,
        }: {
            statusCode: number;
            error: string;
            code: string;
        }
    ) {
        super(message);
        this.name = "RideOfferError";
        this.statusCode = statusCode;
        this.error = error;
        this.code = code;
    }
}

function toConflict(message: string, code: string) {
    return new RideOfferError(message, {
        statusCode: 409,
        error: "Conflict",
        code,
    });
}

const MAX_INT_32 = 2_147_483_647;

function isPrismaUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

function uniqueTargetIncludes(error: Prisma.PrismaClientKnownRequestError, targetName: string): boolean {
    const constraint = error.meta?.constraint;
    if (typeof constraint === "string" && constraint.includes(targetName)) {
        return true;
    }

    const target = error.meta?.target;
    if (typeof target === "string") {
        return target.includes(targetName);
    }

    if (Array.isArray(target)) {
        const parts = target.filter((item): item is string => typeof item === "string");
        if (parts.some((item) => item.includes(targetName))) {
            return true;
        }

        const joined = parts.join(",");
        return (
            joined.includes(targetName) ||
            (parts.includes("ride_id") && parts.includes("rider_user_id")) ||
            (parts.includes("rideId") && parts.includes("riderUserId"))
        );
    }

    return false;
}

function assertOfferedPriceOrThrow(offeredPriceCents: number) {
    if (
        typeof offeredPriceCents !== "number" ||
        !Number.isInteger(offeredPriceCents) ||
        offeredPriceCents <= 0 ||
        offeredPriceCents > MAX_INT_32
    ) {
        throw new RideOfferError("offeredPriceCents must be an integer between 1 and 2147483647.", {
            statusCode: 400,
            error: "Bad Request",
            code: "RIDE_OFFER_INVALID_PRICE",
        });
    }
}

function assertRideBookableOrThrow(
    ride: Prisma.RideGetPayload<{ select: typeof rideBookabilitySelect }>,
    now: Date
) {
    if (ride.status !== "ACTIVE") {
        throw toConflict("Ride is no longer active.", "RIDE_NOT_ACTIVE");
    }

    if (ride.latestDepartAt <= now) {
        throw toConflict("Ride has departed.", "RIDE_DEPARTED");
    }

    if (ride.seatsAvailable < 1) {
        throw toConflict("Not enough seats available.", "RIDE_NO_SEATS");
    }
}

/**
 * Creates a new pending ride offer from a rider to a driver-owned ride.
 */
export async function createRideOffer(
    rideId: string,
    riderUserId: string,
    offeredPriceCents: number
): Promise<RideOfferRecord> {
    assertOfferedPriceOrThrow(offeredPriceCents);

    return prisma.$transaction(async (tx) => {
        const now = new Date();
        const ride = await tx.ride.findUnique({
            where: { id: rideId },
            select: rideBookabilitySelect,
        });

        if (!ride) {
            throw new RideOfferError("Ride not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "RIDE_NOT_FOUND",
            });
        }

        if (ride.driverUserId === riderUserId) {
            throw toConflict("You cannot make an offer on your own ride.", "SELF_OFFER_NOT_ALLOWED");
        }

        assertRideBookableOrThrow(ride, now);

        const existingPendingOffer = await tx.rideOffer.findFirst({
            where: {
                rideId,
                riderUserId,
                state: "PENDING",
            },
            select: { id: true },
        });

        if (existingPendingOffer) {
            throw toConflict(
                "You already have an active offer for this ride.",
                "RIDE_OFFER_ALREADY_ACTIVE"
            );
        }

        const existingConfirmedBooking = await tx.booking.findFirst({
            where: {
                rideId,
                riderUserId,
                status: "CONFIRMED",
            },
            select: { id: true },
        });

        if (existingConfirmedBooking) {
            throw toConflict(
                "You already have a confirmed booking for this ride.",
                "RIDE_ALREADY_BOOKED"
            );
        }

        try {
            return await tx.rideOffer.create({
                data: {
                    rideId,
                    riderUserId,
                    driverUserId: ride.driverUserId,
                    offeredPriceCents,
                    state: "PENDING",
                },
                select: rideOfferBaseSelect,
            });
        } catch (error) {
            if (
                isPrismaUniqueViolation(error) &&
                uniqueTargetIncludes(error, "ride_offer_active_per_rider_ride")
            ) {
                throw toConflict(
                    "You already have an active offer for this ride.",
                    "RIDE_OFFER_ALREADY_ACTIVE"
                );
            }

            throw error;
        }
    });
}

/**
 * Lists offers for a specific ride for the driver who owns the ride.
 */
export async function listRideOffersForDriver(
    rideId: string,
    driverUserId: string
): Promise<RideOfferListRecord[]> {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: {
            id: true,
            driverUserId: true,
        },
    });

    if (!ride) {
        throw new RideOfferError("Ride not found.", {
            statusCode: 404,
            error: "Not Found",
            code: "RIDE_NOT_FOUND",
        });
    }

    if (ride.driverUserId !== driverUserId) {
        throw new RideOfferError("You can only view offers for your own rides.", {
            statusCode: 403,
            error: "Forbidden",
            code: "RIDE_OFFER_FORBIDDEN",
        });
    }

    return prisma.rideOffer.findMany({
        where: {
            rideId,
            driverUserId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: rideOfferListSelect,
    });
}

/**
 * Lists all outgoing ride offers created by a rider.
 */
export async function listRideOffersForRider(
    riderUserId: string
): Promise<RideOfferListRecord[]> {
    return prisma.rideOffer.findMany({
        where: { riderUserId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: rideOfferListSelect,
    });
}

/**
 * Driver accepts a pending ride offer and creates booking atomically.
 */
export async function acceptRideOffer(
    offerId: string,
    driverUserId: string
): Promise<AcceptedRideOfferResult> {
    return prisma.$transaction(async (tx) => {
        const offer = await tx.rideOffer.findUnique({
            where: { id: offerId },
            select: rideOfferWithRideSelect,
        });

        if (!offer) {
            throw new RideOfferError("Ride offer not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "RIDE_OFFER_NOT_FOUND",
            });
        }

        if (offer.driverUserId !== driverUserId || offer.ride.driverUserId !== driverUserId) {
            throw new RideOfferError("Only the ride owner can respond to this offer.", {
                statusCode: 403,
                error: "Forbidden",
                code: "RIDE_OFFER_FORBIDDEN",
            });
        }

        if (offer.state !== "PENDING") {
            throw toConflict("Only pending offers can be accepted.", "RIDE_OFFER_NOT_PENDING");
        }

        const now = new Date();
        const seatUpdate = await tx.ride.updateMany({
            where: {
                id: offer.rideId,
                driverUserId,
                status: "ACTIVE",
                latestDepartAt: { gt: now },
                seatsAvailable: { gte: 1 },
            },
            data: {
                seatsAvailable: { decrement: 1 },
            },
        });

        if (seatUpdate.count === 0) {
            const latestRide = await tx.ride.findUnique({
                where: { id: offer.rideId },
                select: rideBookabilitySelect,
            });

            if (!latestRide) {
                throw toConflict("Ride is no longer available.", "RIDE_NO_LONGER_AVAILABLE");
            }

            if (latestRide.driverUserId !== driverUserId) {
                throw new RideOfferError("Only the ride owner can respond to this offer.", {
                    statusCode: 403,
                    error: "Forbidden",
                    code: "RIDE_OFFER_FORBIDDEN",
                });
            }

            assertRideBookableOrThrow(latestRide, now);
            throw toConflict("Unable to accept ride offer.", "RIDE_OFFER_ACCEPT_FAILED");
        }

        let booking: AcceptedRideOfferBooking;
        try {
            booking = await tx.booking.create({
                data: {
                    rideId: offer.rideId,
                    driverUserId: offer.driverUserId,
                    riderUserId: offer.riderUserId,
                    seatsBooked: 1,
                    priceCents: offer.offeredPriceCents,
                    status: "CONFIRMED",
                },
                select: acceptedBookingSelect,
            });
        } catch (error) {
            if (isPrismaUniqueViolation(error)) {
                throw toConflict(
                    "Rider already has a confirmed booking for this ride.",
                    "RIDE_OFFER_BOOKING_CONFLICT"
                );
            }

            throw error;
        }

        const transition = await tx.rideOffer.updateMany({
            where: {
                id: offerId,
                state: "PENDING",
            },
            data: {
                state: "ACCEPTED",
                acceptedAt: now,
                rejectedAt: null,
            },
        });

        if (transition.count === 0) {
            throw toConflict("Offer is no longer pending.", "RIDE_OFFER_NOT_PENDING");
        }

        const acceptedOffer = await tx.rideOffer.findUnique({
            where: { id: offerId },
            select: rideOfferBaseSelect,
        });

        if (!acceptedOffer) {
            throw new RideOfferError("Ride offer not found after acceptance.", {
                statusCode: 500,
                error: "Internal Server Error",
                code: "RIDE_OFFER_ACCEPT_READ_FAILED",
            });
        }

        return { offer: acceptedOffer, booking };
    });
}

/**
 * Driver rejects a pending ride offer.
 */
export async function rejectRideOffer(
    offerId: string,
    driverUserId: string
): Promise<RideOfferRecord> {
    return prisma.$transaction(async (tx) => {
        const offer = await tx.rideOffer.findUnique({
            where: { id: offerId },
            select: rideOfferWithRideSelect,
        });

        if (!offer) {
            throw new RideOfferError("Ride offer not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "RIDE_OFFER_NOT_FOUND",
            });
        }

        if (offer.driverUserId !== driverUserId || offer.ride.driverUserId !== driverUserId) {
            throw new RideOfferError("Only the ride owner can respond to this offer.", {
                statusCode: 403,
                error: "Forbidden",
                code: "RIDE_OFFER_FORBIDDEN",
            });
        }

        if (offer.state !== "PENDING") {
            throw toConflict("Only pending offers can be rejected.", "RIDE_OFFER_NOT_PENDING");
        }

        const now = new Date();
        const transition = await tx.rideOffer.updateMany({
            where: {
                id: offerId,
                state: "PENDING",
            },
            data: {
                state: "REJECTED",
                rejectedAt: now,
                acceptedAt: null,
            },
        });

        if (transition.count === 0) {
            throw toConflict("Offer is no longer pending.", "RIDE_OFFER_NOT_PENDING");
        }

        const rejectedOffer = await tx.rideOffer.findUnique({
            where: { id: offerId },
            select: rideOfferBaseSelect,
        });

        if (!rejectedOffer) {
            throw new RideOfferError("Ride offer not found after rejection.", {
                statusCode: 500,
                error: "Internal Server Error",
                code: "RIDE_OFFER_REJECT_READ_FAILED",
            });
        }

        return rejectedOffer;
    });
}
