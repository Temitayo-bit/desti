import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RATING_COMMENT_MAX_LENGTH = 500;

const bookingCompletionSelect = {
    id: true,
    rideId: true,
    tripRequestId: true,
    riderUserId: true,
    driverUserId: true,
    seatsBooked: true,
    priceCents: true,
    status: true,
    completedAt: true,
    createdAt: true,
    updatedAt: true,
    ride: {
        select: {
            id: true,
            driverUserId: true,
            status: true,
        },
    },
} satisfies Prisma.BookingSelect;

type BookingCompletionRecord = Prisma.BookingGetPayload<{
    select: typeof bookingCompletionSelect;
}>;

const ratingSelect = {
    id: true,
    bookingId: true,
    raterUserId: true,
    rateeUserId: true,
    score: true,
    comment: true,
    createdAt: true,
} satisfies Prisma.RatingSelect;

export type BookingRatingRecord = Prisma.RatingGetPayload<{
    select: typeof ratingSelect;
}>;

export type CompletedBookingRecord = BookingCompletionRecord;

export interface DriverRatingSummary {
    userId: string;
    averageRating: number | null;
    ratingCount: number;
}

export class TrustServiceError extends Error {
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
        this.name = "TrustServiceError";
        this.statusCode = statusCode;
        this.error = error;
        this.code = code;
    }
}

function toBadRequest(message: string, code: string) {
    return new TrustServiceError(message, {
        statusCode: 400,
        error: "Bad Request",
        code,
    });
}

function toForbidden(message: string, code: string) {
    return new TrustServiceError(message, {
        statusCode: 403,
        error: "Forbidden",
        code,
    });
}

function toNotFound(message: string, code: string) {
    return new TrustServiceError(message, {
        statusCode: 404,
        error: "Not Found",
        code,
    });
}

function toConflict(message: string, code: string) {
    return new TrustServiceError(message, {
        statusCode: 409,
        error: "Conflict",
        code,
    });
}

interface PrismaLikeUniqueError {
    code?: unknown;
    meta?: {
        target?: unknown;
        constraint?: unknown;
    };
}

function isPrismaUniqueViolation(error: unknown): error is PrismaLikeUniqueError {
    if (!error || typeof error !== "object") {
        return false;
    }

    return (error as PrismaLikeUniqueError).code === "P2002";
}

function uniqueTargetIncludes(
    error: PrismaLikeUniqueError,
    targetName: string
): boolean {
    const constraint = error.meta?.constraint;
    if (typeof constraint === "string" && constraint.includes(targetName)) {
        return true;
    }

    const target = error.meta?.target;
    if (typeof target === "string") {
        return target.includes(targetName);
    }

    if (Array.isArray(target)) {
        return target.some(
            (item) => typeof item === "string" && item.includes(targetName)
        );
    }

    return false;
}

function resolveDriverUserId(booking: BookingCompletionRecord): string | null {
    if (booking.driverUserId) {
        return booking.driverUserId;
    }

    if (booking.ride?.driverUserId) {
        return booking.ride.driverUserId;
    }

    return null;
}

interface NormalizedCreateRatingInput {
    score: number;
    comment: string | null;
}

function normalizeCreateRatingInput(rawBody: unknown): NormalizedCreateRatingInput {
    if (!rawBody || typeof rawBody !== "object") {
        throw toBadRequest("Request body must be a JSON object.", "RATING_INVALID_PAYLOAD");
    }

    const body = rawBody as Record<string, unknown>;
    const score = body.score;
    if (
        typeof score !== "number" ||
        !Number.isInteger(score) ||
        score < 1 ||
        score > 5
    ) {
        throw toBadRequest("score must be an integer between 1 and 5.", "RATING_INVALID_SCORE");
    }

    const rawComment = body.comment;
    let comment: string | null = null;
    if (rawComment !== undefined && rawComment !== null) {
        if (typeof rawComment !== "string") {
            throw toBadRequest("comment must be a string when provided.", "RATING_INVALID_COMMENT");
        }

        const trimmed = rawComment.trim();
        if (trimmed.length > RATING_COMMENT_MAX_LENGTH) {
            throw toBadRequest(
                `comment must be ${RATING_COMMENT_MAX_LENGTH} characters or fewer.`,
                "RATING_INVALID_COMMENT"
            );
        }

        comment = trimmed.length > 0 ? trimmed : null;
    }

    return {
        score,
        comment,
    };
}

export async function completeBookingManually(
    bookingId: string,
    actorUserId: string
): Promise<CompletedBookingRecord> {
    const trimmedBookingId = bookingId.trim();
    if (!trimmedBookingId) {
        throw toBadRequest("bookingId must be provided.", "BOOKING_ID_REQUIRED");
    }

    return prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
            where: { id: trimmedBookingId },
            select: bookingCompletionSelect,
        });

        if (!booking) {
            throw toNotFound("Booking not found.", "BOOKING_NOT_FOUND");
        }

        const driverUserId = resolveDriverUserId(booking);
        if (!driverUserId) {
            throw toConflict(
                "Booking does not have a resolvable driver participant.",
                "BOOKING_DRIVER_NOT_FOUND"
            );
        }

        if (driverUserId !== actorUserId) {
            throw toForbidden(
                "Only the booking's driver can mark completion.",
                "BOOKING_COMPLETE_FORBIDDEN"
            );
        }

        if (booking.status === "COMPLETED") {
            throw toConflict("Booking is already completed.", "BOOKING_ALREADY_COMPLETED");
        }

        if (booking.status === "CANCELLED") {
            throw toConflict("Cancelled bookings cannot be completed.", "BOOKING_CANCELLED");
        }

        if (booking.status !== "CONFIRMED") {
            throw toConflict(
                "Booking cannot be completed from its current status.",
                "BOOKING_NOT_COMPLETABLE"
            );
        }

        const completedAt = new Date();
        const updateResult = await tx.booking.updateMany({
            where: {
                id: trimmedBookingId,
                status: "CONFIRMED",
                OR: [
                    { rideId: null },
                    { ride: { status: "ACTIVE" } },
                ],
            },
            data: {
                status: "COMPLETED",
                completedAt,
            },
        });

        if (updateResult.count === 0) {
            const latest = await tx.booking.findUnique({
                where: { id: trimmedBookingId },
                select: {
                    status: true,
                    rideId: true,
                    ride: {
                        select: {
                            status: true,
                        },
                    },
                },
            });

            if (latest?.status === "COMPLETED") {
                throw toConflict("Booking is already completed.", "BOOKING_ALREADY_COMPLETED");
            }

            if (latest?.status === "CANCELLED") {
                throw toConflict("Cancelled bookings cannot be completed.", "BOOKING_CANCELLED");
            }

            if (latest?.rideId !== null && latest?.ride?.status !== "ACTIVE") {
                throw toConflict("Ride is no longer active.", "RIDE_NOT_ACTIVE");
            }

            throw toConflict(
                "Booking could not be completed because its state changed.",
                "BOOKING_NOT_COMPLETABLE"
            );
        }

        const completedBooking = await tx.booking.findUnique({
            where: { id: trimmedBookingId },
            select: bookingCompletionSelect,
        });

        if (!completedBooking) {
            throw toNotFound("Booking not found.", "BOOKING_NOT_FOUND");
        }

        return completedBooking;
    });
}

export async function createBookingRating(
    bookingId: string,
    actorUserId: string,
    rawBody: unknown
): Promise<BookingRatingRecord> {
    const trimmedBookingId = bookingId.trim();
    if (!trimmedBookingId) {
        throw toBadRequest("bookingId must be provided.", "BOOKING_ID_REQUIRED");
    }

    const input = normalizeCreateRatingInput(rawBody);

    return prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
            where: { id: trimmedBookingId },
            select: bookingCompletionSelect,
        });

        if (!booking) {
            throw toNotFound("Booking not found.", "BOOKING_NOT_FOUND");
        }

        if (booking.status !== "COMPLETED") {
            throw toConflict(
                "Only completed bookings can be rated.",
                "BOOKING_NOT_COMPLETED"
            );
        }

        if (booking.riderUserId !== actorUserId) {
            throw toForbidden(
                "Only the booking rider can submit this rating.",
                "RATING_CREATE_FORBIDDEN"
            );
        }

        const driverUserId = resolveDriverUserId(booking);
        if (!driverUserId) {
            throw toConflict(
                "Booking does not have a resolvable driver participant.",
                "BOOKING_DRIVER_NOT_FOUND"
            );
        }

        if (driverUserId === actorUserId) {
            throw toConflict("Self-rating is not allowed.", "SELF_RATING_NOT_ALLOWED");
        }

        try {
            return await tx.rating.create({
                data: {
                    bookingId: booking.id,
                    raterUserId: actorUserId,
                    rateeUserId: driverUserId,
                    score: input.score,
                    comment: input.comment,
                },
                select: ratingSelect,
            });
        } catch (error) {
            if (
                isPrismaUniqueViolation(error) &&
                (uniqueTargetIncludes(error, "ratings_booking_id_key") ||
                    uniqueTargetIncludes(error, "booking_id") ||
                    uniqueTargetIncludes(error, "bookingId"))
            ) {
                throw toConflict(
                    "A rating already exists for this booking.",
                    "BOOKING_ALREADY_RATED"
                );
            }

            throw error;
        }
    });
}

export async function getDriverRatingSummary(
    targetUserId: string
): Promise<DriverRatingSummary> {
    const trimmedUserId = targetUserId.trim();
    if (!trimmedUserId) {
        throw toBadRequest("userId must be provided.", "USER_ID_REQUIRED");
    }

    const user = await prisma.user.findUnique({
        where: { clerkUserId: trimmedUserId },
        select: { clerkUserId: true },
    });

    if (!user) {
        throw toNotFound("User not found.", "USER_NOT_FOUND");
    }

    const aggregate = await prisma.rating.aggregate({
        where: {
            rateeUserId: trimmedUserId,
        },
        _avg: {
            score: true,
        },
        _count: {
            _all: true,
        },
    });

    return {
        userId: trimmedUserId,
        averageRating:
            aggregate._avg.score === null
                ? null
                : Number(aggregate._avg.score.toFixed(2)),
        ratingCount: aggregate._count._all,
    };
}
