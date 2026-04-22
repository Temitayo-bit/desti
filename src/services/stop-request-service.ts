import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const rideBookabilitySelect = {
    id: true,
    driverUserId: true,
    status: true,
    latestDepartAt: true,
    seatsAvailable: true,
} satisfies Prisma.RideSelect;

const stopRequestBaseSelect = {
    id: true,
    rideId: true,
    riderUserId: true,
    driverUserId: true,
    requestedPickupText: true,
    requestedPickupLatitude: true,
    requestedPickupLongitude: true,
    requestedDropoffText: true,
    requestedDropoffLatitude: true,
    requestedDropoffLongitude: true,
    riderNote: true,
    quotedPriceCents: true,
    state: true,
    createdAt: true,
    updatedAt: true,
    quotedAt: true,
    acceptedAt: true,
    rejectedAt: true,
} satisfies Prisma.StopRequestSelect;

const stopRequestListSelect = {
    ...stopRequestBaseSelect,
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
} satisfies Prisma.StopRequestSelect;

const stopRequestWithRideSelect = {
    ...stopRequestBaseSelect,
    ride: {
        select: rideBookabilitySelect,
    },
} satisfies Prisma.StopRequestSelect;

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

export interface CreateStopRequestInput {
    requestedPickupText: string;
    requestedPickupLatitude: number;
    requestedPickupLongitude: number;
    requestedDropoffText: string;
    requestedDropoffLatitude: number;
    requestedDropoffLongitude: number;
    riderNote?: string | null;
}

interface NormalizedCreateStopRequestInput {
    requestedPickupText: string;
    requestedPickupLatitude: number;
    requestedPickupLongitude: number;
    requestedDropoffText: string;
    requestedDropoffLatitude: number;
    requestedDropoffLongitude: number;
    riderNote: string | null;
}

export type StopRequestRecord = Prisma.StopRequestGetPayload<{
    select: typeof stopRequestBaseSelect;
}>;

export type StopRequestListRecord = Prisma.StopRequestGetPayload<{
    select: typeof stopRequestListSelect;
}>;

export type AcceptedStopRequestBooking = Prisma.BookingGetPayload<{
    select: typeof acceptedBookingSelect;
}>;

export interface AcceptedStopRequestResult {
    stopRequest: StopRequestRecord;
    booking: AcceptedStopRequestBooking;
}

export class StopRequestError extends Error {
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
        this.name = "StopRequestError";
        this.statusCode = statusCode;
        this.error = error;
        this.code = code;
    }
}

function toConflict(message: string, code: string) {
    return new StopRequestError(message, {
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

function assertTrimmedTextOrThrow(field: string, value: unknown): string {
    if (typeof value !== "string") {
        throw new StopRequestError(`${field} must be a string.`, {
            statusCode: 400,
            error: "Bad Request",
            code: "STOP_REQUEST_INVALID_PAYLOAD",
        });
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 200) {
        throw new StopRequestError(`${field} must be between 1 and 200 characters after trimming.`, {
            statusCode: 400,
            error: "Bad Request",
            code: "STOP_REQUEST_INVALID_PAYLOAD",
        });
    }

    return trimmed;
}

function assertCoordinateOrThrow(
    field: string,
    value: unknown,
    min: number,
    max: number
): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
        throw new StopRequestError(`${field} must be a finite number between ${min} and ${max}.`, {
            statusCode: 400,
            error: "Bad Request",
            code: "STOP_REQUEST_INVALID_PAYLOAD",
        });
    }

    return value;
}

function normalizeCreateInput(input: CreateStopRequestInput): NormalizedCreateStopRequestInput {
    const requestedPickupText = assertTrimmedTextOrThrow("requestedPickupText", input.requestedPickupText);
    const requestedDropoffText = assertTrimmedTextOrThrow("requestedDropoffText", input.requestedDropoffText);
    const requestedPickupLatitude = assertCoordinateOrThrow(
        "requestedPickupLatitude",
        input.requestedPickupLatitude,
        -90,
        90
    );
    const requestedPickupLongitude = assertCoordinateOrThrow(
        "requestedPickupLongitude",
        input.requestedPickupLongitude,
        -180,
        180
    );
    const requestedDropoffLatitude = assertCoordinateOrThrow(
        "requestedDropoffLatitude",
        input.requestedDropoffLatitude,
        -90,
        90
    );
    const requestedDropoffLongitude = assertCoordinateOrThrow(
        "requestedDropoffLongitude",
        input.requestedDropoffLongitude,
        -180,
        180
    );

    let riderNote: string | null = null;
    if (input.riderNote !== undefined && input.riderNote !== null) {
        if (typeof input.riderNote !== "string") {
            throw new StopRequestError("riderNote must be a string when provided.", {
                statusCode: 400,
                error: "Bad Request",
                code: "STOP_REQUEST_INVALID_PAYLOAD",
            });
        }

        const trimmed = input.riderNote.trim();
        if (trimmed.length > 500) {
            throw new StopRequestError("riderNote must be 500 characters or fewer.", {
                statusCode: 400,
                error: "Bad Request",
                code: "STOP_REQUEST_INVALID_PAYLOAD",
            });
        }

        riderNote = trimmed.length > 0 ? trimmed : null;
    }

    return {
        requestedPickupText,
        requestedPickupLatitude,
        requestedPickupLongitude,
        requestedDropoffText,
        requestedDropoffLatitude,
        requestedDropoffLongitude,
        riderNote,
    };
}

function assertQuotedPriceOrThrow(quotedPriceCents: number) {
    if (
        typeof quotedPriceCents !== "number" ||
        !Number.isInteger(quotedPriceCents) ||
        quotedPriceCents <= 0 ||
        quotedPriceCents > MAX_INT_32
    ) {
        throw new StopRequestError("quotedPriceCents must be an integer between 1 and 2147483647.", {
            statusCode: 400,
            error: "Bad Request",
            code: "STOP_REQUEST_INVALID_PRICE",
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
 * Creates a new pending stop request from a rider for a posted ride.
 */
export async function createStopRequest(
    rideId: string,
    riderUserId: string,
    payload: CreateStopRequestInput
): Promise<StopRequestRecord> {
    const input = normalizeCreateInput(payload);

    return prisma.$transaction(async (tx) => {
        const now = new Date();
        const ride = await tx.ride.findUnique({
            where: { id: rideId },
            select: rideBookabilitySelect,
        });

        if (!ride) {
            throw new StopRequestError("Ride not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "RIDE_NOT_FOUND",
            });
        }

        if (ride.driverUserId === riderUserId) {
            throw toConflict("You cannot request a stop on your own ride.", "SELF_STOP_REQUEST_NOT_ALLOWED");
        }

        assertRideBookableOrThrow(ride, now);

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

        return tx.stopRequest.create({
            data: {
                rideId,
                riderUserId,
                driverUserId: ride.driverUserId,
                requestedPickupText: input.requestedPickupText,
                requestedPickupLatitude: input.requestedPickupLatitude,
                requestedPickupLongitude: input.requestedPickupLongitude,
                requestedDropoffText: input.requestedDropoffText,
                requestedDropoffLatitude: input.requestedDropoffLatitude,
                requestedDropoffLongitude: input.requestedDropoffLongitude,
                riderNote: input.riderNote,
                state: "PENDING",
            },
            select: stopRequestBaseSelect,
        });
    });
}

/**
 * Lists incoming stop requests for a ride owned by the authenticated driver.
 */
export async function listStopRequestsForDriver(
    rideId: string,
    driverUserId: string
): Promise<StopRequestListRecord[]> {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: {
            id: true,
            driverUserId: true,
        },
    });

    if (!ride) {
        throw new StopRequestError("Ride not found.", {
            statusCode: 404,
            error: "Not Found",
            code: "RIDE_NOT_FOUND",
        });
    }

    if (ride.driverUserId !== driverUserId) {
        throw new StopRequestError("You can only view stop requests for your own rides.", {
            statusCode: 403,
            error: "Forbidden",
            code: "STOP_REQUEST_FORBIDDEN",
        });
    }

    return prisma.stopRequest.findMany({
        where: {
            rideId,
            driverUserId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: stopRequestListSelect,
    });
}

/**
 * Lists outgoing stop requests created by a rider.
 */
export async function listStopRequestsForRider(
    riderUserId: string
): Promise<StopRequestListRecord[]> {
    return prisma.stopRequest.findMany({
        where: { riderUserId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: stopRequestListSelect,
    });
}

/**
 * Driver sets a quote on a pending stop request.
 */
export async function quoteStopRequest(
    stopRequestId: string,
    driverUserId: string,
    quotedPriceCents: number
): Promise<StopRequestRecord> {
    assertQuotedPriceOrThrow(quotedPriceCents);

    return prisma.$transaction(async (tx) => {
        const stopRequest = await tx.stopRequest.findUnique({
            where: { id: stopRequestId },
            select: stopRequestWithRideSelect,
        });

        if (!stopRequest) {
            throw new StopRequestError("Stop request not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "STOP_REQUEST_NOT_FOUND",
            });
        }

        if (
            stopRequest.driverUserId !== driverUserId ||
            stopRequest.ride.driverUserId !== driverUserId
        ) {
            throw new StopRequestError("Only the ride owner can quote this stop request.", {
                statusCode: 403,
                error: "Forbidden",
                code: "STOP_REQUEST_FORBIDDEN",
            });
        }

        if (stopRequest.state !== "PENDING") {
            throw toConflict("Only pending stop requests can be quoted.", "STOP_REQUEST_NOT_PENDING");
        }

        const now = new Date();
        const transition = await tx.stopRequest.updateMany({
            where: {
                id: stopRequestId,
                state: "PENDING",
            },
            data: {
                state: "QUOTED",
                quotedPriceCents,
                quotedAt: now,
                acceptedAt: null,
                rejectedAt: null,
            },
        });

        if (transition.count === 0) {
            throw toConflict("Stop request is no longer pending.", "STOP_REQUEST_NOT_PENDING");
        }

        const quotedStopRequest = await tx.stopRequest.findUnique({
            where: { id: stopRequestId },
            select: stopRequestBaseSelect,
        });

        if (!quotedStopRequest) {
            throw new StopRequestError("Stop request not found after quote.", {
                statusCode: 500,
                error: "Internal Server Error",
                code: "STOP_REQUEST_QUOTE_READ_FAILED",
            });
        }

        return quotedStopRequest;
    });
}

/**
 * Rider accepts a quoted stop request and creates booking atomically.
 */
export async function acceptStopRequest(
    stopRequestId: string,
    riderUserId: string
): Promise<AcceptedStopRequestResult> {
    return prisma.$transaction(async (tx) => {
        const stopRequest = await tx.stopRequest.findUnique({
            where: { id: stopRequestId },
            select: stopRequestWithRideSelect,
        });

        if (!stopRequest) {
            throw new StopRequestError("Stop request not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "STOP_REQUEST_NOT_FOUND",
            });
        }

        if (stopRequest.riderUserId !== riderUserId) {
            throw new StopRequestError("Only the requesting rider can accept this stop request.", {
                statusCode: 403,
                error: "Forbidden",
                code: "STOP_REQUEST_FORBIDDEN",
            });
        }

        if (stopRequest.state !== "QUOTED") {
            throw toConflict("Only quoted stop requests can be accepted.", "STOP_REQUEST_NOT_QUOTED");
        }

        if (stopRequest.quotedPriceCents === null) {
            throw toConflict("Stop request is missing a quoted price.", "STOP_REQUEST_MISSING_QUOTE");
        }

        const now = new Date();
        const seatUpdate = await tx.ride.updateMany({
            where: {
                id: stopRequest.rideId,
                driverUserId: stopRequest.driverUserId,
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
                where: { id: stopRequest.rideId },
                select: rideBookabilitySelect,
            });

            if (!latestRide) {
                throw toConflict("Ride is no longer available.", "RIDE_NO_LONGER_AVAILABLE");
            }

            assertRideBookableOrThrow(latestRide, now);
            throw toConflict("Unable to accept stop request.", "STOP_REQUEST_ACCEPT_FAILED");
        }

        let booking: AcceptedStopRequestBooking;
        try {
            booking = await tx.booking.create({
                data: {
                    rideId: stopRequest.rideId,
                    driverUserId: stopRequest.driverUserId,
                    riderUserId: stopRequest.riderUserId,
                    seatsBooked: 1,
                    priceCents: stopRequest.quotedPriceCents,
                    status: "CONFIRMED",
                },
                select: acceptedBookingSelect,
            });
        } catch (error) {
            if (isPrismaUniqueViolation(error)) {
                throw toConflict(
                    "Rider already has a confirmed booking for this ride.",
                    "STOP_REQUEST_BOOKING_CONFLICT"
                );
            }

            throw error;
        }

        const transition = await tx.stopRequest.updateMany({
            where: {
                id: stopRequestId,
                state: "QUOTED",
            },
            data: {
                state: "ACCEPTED",
                acceptedAt: now,
                rejectedAt: null,
            },
        });

        if (transition.count === 0) {
            throw toConflict("Stop request is no longer quoted.", "STOP_REQUEST_NOT_QUOTED");
        }

        const acceptedStopRequest = await tx.stopRequest.findUnique({
            where: { id: stopRequestId },
            select: stopRequestBaseSelect,
        });

        if (!acceptedStopRequest) {
            throw new StopRequestError("Stop request not found after acceptance.", {
                statusCode: 500,
                error: "Internal Server Error",
                code: "STOP_REQUEST_ACCEPT_READ_FAILED",
            });
        }

        return {
            stopRequest: acceptedStopRequest,
            booking,
        };
    });
}

/**
 * Driver or rider rejects an open stop request.
 */
export async function rejectStopRequest(
    stopRequestId: string,
    actorUserId: string
): Promise<StopRequestRecord> {
    return prisma.$transaction(async (tx) => {
        const stopRequest = await tx.stopRequest.findUnique({
            where: { id: stopRequestId },
            select: stopRequestWithRideSelect,
        });

        if (!stopRequest) {
            throw new StopRequestError("Stop request not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "STOP_REQUEST_NOT_FOUND",
            });
        }

        const isDriver =
            stopRequest.driverUserId === actorUserId ||
            stopRequest.ride.driverUserId === actorUserId;
        const isRider = stopRequest.riderUserId === actorUserId;

        if (!isDriver && !isRider) {
            throw new StopRequestError("You are not allowed to reject this stop request.", {
                statusCode: 403,
                error: "Forbidden",
                code: "STOP_REQUEST_FORBIDDEN",
            });
        }

        if (stopRequest.state !== "PENDING" && stopRequest.state !== "QUOTED") {
            throw toConflict(
                "Only pending or quoted stop requests can be rejected.",
                "STOP_REQUEST_NOT_REJECTABLE"
            );
        }

        const now = new Date();
        const transition = await tx.stopRequest.updateMany({
            where: {
                id: stopRequestId,
                state: { in: ["PENDING", "QUOTED"] },
            },
            data: {
                state: "REJECTED",
                rejectedAt: now,
            },
        });

        if (transition.count === 0) {
            throw toConflict(
                "Stop request is no longer pending or quoted.",
                "STOP_REQUEST_NOT_REJECTABLE"
            );
        }

        const rejectedStopRequest = await tx.stopRequest.findUnique({
            where: { id: stopRequestId },
            select: stopRequestBaseSelect,
        });

        if (!rejectedStopRequest) {
            throw new StopRequestError("Stop request not found after rejection.", {
                statusCode: 500,
                error: "Internal Server Error",
                code: "STOP_REQUEST_REJECT_READ_FAILED",
            });
        }

        return rejectedStopRequest;
    });
}
