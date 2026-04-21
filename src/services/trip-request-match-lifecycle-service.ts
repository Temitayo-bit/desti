import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    DESTINATION_THRESHOLD_KM,
    findCandidateRidesForTripRequest,
    haversineDistanceKm,
    ORIGIN_THRESHOLD_KM,
    TIME_WINDOW_MINUTES,
    TripRequestRideMatchingError,
} from "@/services/trip-request-ride-matching-service";

const tripRequestLifecycleSelect = {
    id: true,
    riderUserId: true,
    status: true,
    originLatitude: true,
    originLongitude: true,
    destinationLatitude: true,
    destinationLongitude: true,
    earliestDesiredAt: true,
    preferredDepartAt: true,
} satisfies Prisma.TripRequestSelect;

const suggestedMatchSelect = {
    id: true,
    state: true,
    scoreSnapshot: true,
    originDistanceSnapshot: true,
    destinationDistanceSnapshot: true,
    timeDifferenceSnapshot: true,
    ride: {
        select: {
            id: true,
            driverUserId: true,
            status: true,
            originText: true,
            destinationText: true,
            originLatitude: true,
            originLongitude: true,
            destinationLatitude: true,
            destinationLongitude: true,
            preferredDepartAt: true,
            earliestDepartAt: true,
            seatsAvailable: true,
        },
    },
} satisfies Prisma.MatchSelect;

const managedMatchSelect = {
    id: true,
    tripRequestId: true,
    rideId: true,
    state: true,
    scoreSnapshot: true,
    originDistanceSnapshot: true,
    destinationDistanceSnapshot: true,
    timeDifferenceSnapshot: true,
    acceptedAt: true,
    rejectedAt: true,
    expiredAt: true,
    expirationReason: true,
    tripRequest: {
        select: {
            riderUserId: true,
        },
    },
    ride: {
        select: {
            id: true,
            driverUserId: true,
            status: true,
            originText: true,
            destinationText: true,
            originLatitude: true,
            originLongitude: true,
            destinationLatitude: true,
            destinationLongitude: true,
            preferredDepartAt: true,
            earliestDepartAt: true,
            seatsAvailable: true,
        },
    },
} satisfies Prisma.MatchSelect;

const MATCH_STATE = {
    SUGGESTED: "SUGGESTED",
    ACCEPTED: "ACCEPTED",
    REJECTED: "REJECTED",
    EXPIRED: "EXPIRED",
} as const;

type MatchState = (typeof MATCH_STATE)[keyof typeof MATCH_STATE];
const MS_PER_MINUTE = 60_000;

type TripRequestForLifecycle = Prisma.TripRequestGetPayload<{
    select: typeof tripRequestLifecycleSelect;
}>;

type SuggestedMatchRecord = Prisma.MatchGetPayload<{
    select: typeof suggestedMatchSelect;
}>;

type ManagedMatchRecord = Prisma.MatchGetPayload<{
    select: typeof managedMatchSelect;
}>;

export interface ActiveTripRequestMatch {
    matchId: string;
    rideId: string;
    state: MatchState;
    scoreSnapshot: number;
    originDistanceSnapshot: number;
    destinationDistanceSnapshot: number;
    timeDifferenceSnapshot: number;
    originText: string;
    destinationText: string;
    departureTime: string;
    availableSeats: number;
}

export interface ManagedTripRequestMatch extends ActiveTripRequestMatch {
    tripRequestId: string;
    acceptedAt: string | null;
    rejectedAt: string | null;
    expiredAt: string | null;
    expirationReason: string | null;
}

export class MatchLifecycleError extends Error {
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
        this.name = "MatchLifecycleError";
        this.statusCode = statusCode;
        this.error = error;
        this.code = code;
    }
}

function getTripRequestReferenceTime(tripRequest: TripRequestForLifecycle): Date {
    return tripRequest.preferredDepartAt ?? tripRequest.earliestDesiredAt;
}

function getRideReferenceTime(ride: SuggestedMatchRecord["ride"]): Date {
    return ride.preferredDepartAt ?? ride.earliestDepartAt;
}

function hasTripRequestCoordinates(tripRequest: TripRequestForLifecycle): boolean {
    return (
        typeof tripRequest.originLatitude === "number" &&
        typeof tripRequest.originLongitude === "number" &&
        typeof tripRequest.destinationLatitude === "number" &&
        typeof tripRequest.destinationLongitude === "number"
    );
}

function hasRideCoordinates(ride: SuggestedMatchRecord["ride"]): boolean {
    return (
        typeof ride.originLatitude === "number" &&
        typeof ride.originLongitude === "number" &&
        typeof ride.destinationLatitude === "number" &&
        typeof ride.destinationLongitude === "number"
    );
}

function isRideMatchEligible(
    ride: SuggestedMatchRecord["ride"],
    tripRequest: TripRequestForLifecycle,
    now: Date
): boolean {
    if (ride.status !== "ACTIVE") {
        return false;
    }

    if (ride.seatsAvailable < 1) {
        return false;
    }

    if (ride.driverUserId === tripRequest.riderUserId) {
        return false;
    }

    if (!hasTripRequestCoordinates(tripRequest) || !hasRideCoordinates(ride)) {
        return false;
    }

    const rideTime = getRideReferenceTime(ride);
    if (rideTime.getTime() <= now.getTime()) {
        return false;
    }

    const tripRequestTime = getTripRequestReferenceTime(tripRequest);
    const originDistance = haversineDistanceKm(
        tripRequest.originLatitude,
        tripRequest.originLongitude,
        ride.originLatitude,
        ride.originLongitude
    );
    if (originDistance > ORIGIN_THRESHOLD_KM) {
        return false;
    }

    const destinationDistance = haversineDistanceKm(
        tripRequest.destinationLatitude,
        tripRequest.destinationLongitude,
        ride.destinationLatitude,
        ride.destinationLongitude
    );
    if (destinationDistance > DESTINATION_THRESHOLD_KM) {
        return false;
    }

    const timeDifference =
        Math.abs(rideTime.getTime() - tripRequestTime.getTime()) / MS_PER_MINUTE;
    if (timeDifference > TIME_WINDOW_MINUTES) {
        return false;
    }

    return true;
}

function toActiveMatch(record: SuggestedMatchRecord): ActiveTripRequestMatch {
    return {
        matchId: record.id,
        rideId: record.ride.id,
        state: record.state,
        scoreSnapshot: record.scoreSnapshot,
        originDistanceSnapshot: record.originDistanceSnapshot,
        destinationDistanceSnapshot: record.destinationDistanceSnapshot,
        timeDifferenceSnapshot: record.timeDifferenceSnapshot,
        originText: record.ride.originText,
        destinationText: record.ride.destinationText,
        departureTime: (
            record.ride.preferredDepartAt ?? record.ride.earliestDepartAt
        ).toISOString(),
        availableSeats: record.ride.seatsAvailable,
    };
}

function toManagedMatch(record: ManagedMatchRecord): ManagedTripRequestMatch {
    return {
        ...toActiveMatch(record),
        tripRequestId: record.tripRequestId,
        acceptedAt: record.acceptedAt ? record.acceptedAt.toISOString() : null,
        rejectedAt: record.rejectedAt ? record.rejectedAt.toISOString() : null,
        expiredAt: record.expiredAt ? record.expiredAt.toISOString() : null,
        expirationReason: record.expirationReason,
    };
}

async function getTripRequestOrThrow(
    tripRequestId: string
): Promise<TripRequestForLifecycle> {
    const tripRequest = await prisma.tripRequest.findUnique({
        where: { id: tripRequestId },
        select: tripRequestLifecycleSelect,
    });

    if (!tripRequest) {
        throw new MatchLifecycleError("Trip request not found.", {
            statusCode: 404,
            error: "Not Found",
            code: "TRIP_REQUEST_NOT_FOUND",
        });
    }

    return tripRequest;
}

async function assertTripRequestOwnerOrThrow(
    tripRequestId: string,
    actorUserId: string
): Promise<void> {
    const tripRequest = await getTripRequestOrThrow(tripRequestId);
    if (tripRequest.riderUserId !== actorUserId) {
        throw new MatchLifecycleError(
            "You are not allowed to access matches for this trip request.",
            {
                statusCode: 403,
                error: "Forbidden",
                code: "TRIP_REQUEST_MATCH_FORBIDDEN",
            }
        );
    }
}

async function expireAllNonExpiredMatches(
    tripRequestId: string,
    reason: string,
    now: Date
): Promise<void> {
    await prisma.match.updateMany({
        where: {
            tripRequestId,
            state: { not: MATCH_STATE.EXPIRED },
        },
        data: {
            state: MATCH_STATE.EXPIRED,
            expiredAt: now,
            expirationReason: reason,
        },
    });
}

async function getAuthorizedManagedMatchOrThrow(
    matchId: string,
    actorUserId: string
): Promise<ManagedMatchRecord> {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: managedMatchSelect,
    });

    if (!match) {
        throw new MatchLifecycleError("Match not found.", {
            statusCode: 404,
            error: "Not Found",
            code: "MATCH_NOT_FOUND",
        });
    }

    if (match.tripRequest.riderUserId !== actorUserId) {
        throw new MatchLifecycleError("You are not allowed to manage this match.", {
            statusCode: 403,
            error: "Forbidden",
            code: "MATCH_FORBIDDEN",
        });
    }

    return match;
}

export async function expireInvalidMatchesForTripRequest(
    tripRequestId: string
): Promise<void> {
    const now = new Date();
    const tripRequest = await getTripRequestOrThrow(tripRequestId);

    if (tripRequest.status !== "ACTIVE") {
        await expireAllNonExpiredMatches(
            tripRequestId,
            "TRIP_REQUEST_NOT_ACTIVE",
            now
        );
        return;
    }

    const tripRequestTime = getTripRequestReferenceTime(tripRequest);
    if (tripRequestTime.getTime() <= now.getTime()) {
        await expireAllNonExpiredMatches(
            tripRequestId,
            "TRIP_REQUEST_DEPARTURE_PASSED",
            now
        );
        return;
    }

    if (!hasTripRequestCoordinates(tripRequest)) {
        await expireAllNonExpiredMatches(
            tripRequestId,
            "TRIP_REQUEST_COORDINATES_REQUIRED",
            now
        );
        throw new TripRequestRideMatchingError(
            "Trip request is missing required coordinates.",
            {
                statusCode: 400,
                error: "Bad Request",
                code: "TRIP_REQUEST_COORDINATES_REQUIRED",
            }
        );
    }

    const existingNonExpiredMatches = await prisma.match.findMany({
        where: {
            tripRequestId,
            state: { not: MATCH_STATE.EXPIRED },
        },
        select: {
            id: true,
            ride: {
                select: {
                    id: true,
                    driverUserId: true,
                    status: true,
                    originText: true,
                    destinationText: true,
                    originLatitude: true,
                    originLongitude: true,
                    destinationLatitude: true,
                    destinationLongitude: true,
                    preferredDepartAt: true,
                    earliestDepartAt: true,
                    seatsAvailable: true,
                },
            },
        },
    });

    const matchIdsToExpire = existingNonExpiredMatches
        .filter((match) => !isRideMatchEligible(match.ride, tripRequest, now))
        .map((match) => match.id);

    if (matchIdsToExpire.length === 0) {
        return;
    }

    await prisma.match.updateMany({
        where: {
            id: { in: matchIdsToExpire },
            state: { not: MATCH_STATE.EXPIRED },
        },
        data: {
            state: MATCH_STATE.EXPIRED,
            expiredAt: now,
            expirationReason: "RIDE_NO_LONGER_MATCH_ELIGIBLE",
        },
    });
}

export async function persistMatchesForTripRequest(
    tripRequestId: string
): Promise<void> {
    await expireInvalidMatchesForTripRequest(tripRequestId);
    const tripRequest = await getTripRequestOrThrow(tripRequestId);
    const now = new Date();

    if (tripRequest.status !== "ACTIVE") {
        return;
    }

    const tripRequestTime = getTripRequestReferenceTime(tripRequest);
    if (tripRequestTime.getTime() <= now.getTime()) {
        return;
    }

    const candidates = await findCandidateRidesForTripRequest(tripRequestId);
    if (candidates.length === 0) {
        return;
    }

    const candidateRideIds = candidates.map((candidate) => candidate.rideId);
    const existingMatches = await prisma.match.findMany({
        where: {
            tripRequestId,
            rideId: { in: candidateRideIds },
        },
        select: {
            rideId: true,
            state: true,
        },
    });

    const existingByRideId = new Map(
        existingMatches.map((match) => [match.rideId, match.state])
    );

    const rowsToCreate = candidates
        .filter((candidate) => {
            const existingState = existingByRideId.get(candidate.rideId);
            return !existingState;
        })
        .map((candidate) => ({
            tripRequestId,
            rideId: candidate.rideId,
            state: MATCH_STATE.SUGGESTED,
            scoreSnapshot: candidate.score,
            originDistanceSnapshot: candidate.originDistance,
            destinationDistanceSnapshot: candidate.destinationDistance,
            timeDifferenceSnapshot: candidate.timeDifference,
        }));

    if (rowsToCreate.length === 0) {
        return;
    }

    await prisma.match.createMany({
        data: rowsToCreate,
        skipDuplicates: true,
    });
}

export async function getActiveMatchesForTripRequest(
    tripRequestId: string,
    actorUserId: string
): Promise<ActiveTripRequestMatch[]> {
    await assertTripRequestOwnerOrThrow(tripRequestId, actorUserId);
    await persistMatchesForTripRequest(tripRequestId);

    const activeMatches = await prisma.match.findMany({
        where: {
            tripRequestId,
            state: MATCH_STATE.SUGGESTED,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: suggestedMatchSelect,
    });

    return activeMatches.map(toActiveMatch);
}

export async function rejectMatch(
    matchId: string,
    actorUserId: string
): Promise<ManagedTripRequestMatch> {
    const match = await getAuthorizedManagedMatchOrThrow(matchId, actorUserId);
    await expireInvalidMatchesForTripRequest(match.tripRequestId);

    const now = new Date();
    const { count } = await prisma.match.updateMany({
        where: { id: matchId, state: MATCH_STATE.SUGGESTED },
        data: {
            state: MATCH_STATE.REJECTED,
            acceptedAt: null,
            rejectedAt: now,
            expiredAt: null,
            expirationReason: null,
        },
    });

    if (count === 0) {
        const refreshed = await getAuthorizedManagedMatchOrThrow(
            matchId,
            actorUserId
        );
        if (refreshed.state !== MATCH_STATE.SUGGESTED) {
            throw new MatchLifecycleError(
                "Only suggested matches can be rejected.",
                {
                    statusCode: 409,
                    error: "Conflict",
                    code: "MATCH_NOT_SUGGESTED",
                }
            );
        }
        throw new MatchLifecycleError("Only suggested matches can be rejected.", {
            statusCode: 409,
            error: "Conflict",
            code: "MATCH_NOT_SUGGESTED",
        });
    }

    const updated = await getAuthorizedManagedMatchOrThrow(matchId, actorUserId);
    return toManagedMatch(updated);
}

export async function acceptMatch(
    matchId: string,
    actorUserId: string
): Promise<ManagedTripRequestMatch> {
    const match = await getAuthorizedManagedMatchOrThrow(matchId, actorUserId);
    await expireInvalidMatchesForTripRequest(match.tripRequestId);

    const now = new Date();
    const { count } = await prisma.match.updateMany({
        where: { id: matchId, state: MATCH_STATE.SUGGESTED },
        data: {
            state: MATCH_STATE.ACCEPTED,
            acceptedAt: now,
            rejectedAt: null,
            expiredAt: null,
            expirationReason: null,
        },
    });

    if (count === 0) {
        const refreshed = await getAuthorizedManagedMatchOrThrow(
            matchId,
            actorUserId
        );
        if (refreshed.state !== MATCH_STATE.SUGGESTED) {
            throw new MatchLifecycleError(
                "Only suggested matches can be accepted.",
                {
                    statusCode: 409,
                    error: "Conflict",
                    code: "MATCH_NOT_SUGGESTED",
                }
            );
        }
        throw new MatchLifecycleError("Only suggested matches can be accepted.", {
            statusCode: 409,
            error: "Conflict",
            code: "MATCH_NOT_SUGGESTED",
        });
    }

    const updated = await getAuthorizedManagedMatchOrThrow(matchId, actorUserId);
    return toManagedMatch(updated);
}
