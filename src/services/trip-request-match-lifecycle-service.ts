import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    DESTINATION_THRESHOLD_KM,
    findCandidateRidesForTripRequest,
    findCandidateTripRequestsForRide,
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

const rideEligibilitySelect = {
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
} satisfies Prisma.RideSelect;

const driverSuggestedMatchSelect = {
    id: true,
    state: true,
    scoreSnapshot: true,
    originDistanceSnapshot: true,
    destinationDistanceSnapshot: true,
    timeDifferenceSnapshot: true,
    tripRequest: {
        select: {
            id: true,
            originText: true,
            destinationText: true,
            earliestDesiredAt: true,
            latestDesiredAt: true,
            preferredDepartAt: true,
            seatsNeeded: true,
            riderUserId: true,
            rider: {
                select: {
                    name: true,
                    clerkUserId: true,
                    profilePictureUrl: true,
                },
            },
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
type TripRequestWithCoordinates = TripRequestForLifecycle & {
    originLatitude: number;
    originLongitude: number;
    destinationLatitude: number;
    destinationLongitude: number;
};
type RideWithCoordinates = SuggestedMatchRecord["ride"] & {
    originLatitude: number;
    originLongitude: number;
    destinationLatitude: number;
    destinationLongitude: number;
};

type TripRequestForLifecycle = Prisma.TripRequestGetPayload<{
    select: typeof tripRequestLifecycleSelect;
}>;

type SuggestedMatchRecord = Prisma.MatchGetPayload<{
    select: typeof suggestedMatchSelect;
}>;

type ManagedMatchRecord = Prisma.MatchGetPayload<{
    select: typeof managedMatchSelect;
}>;

type DriverSuggestedMatchRecord = Prisma.MatchGetPayload<{
    select: typeof driverSuggestedMatchSelect;
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

export interface SuggestedTripRequestForDriver {
    matchId: string;
    tripRequestId: string;
    state: MatchState;
    scoreSnapshot: number;
    originText: string;
    destinationText: string;
    earliestDesiredAt: string;
    latestDesiredAt: string;
    preferredDepartAt: string | null;
    seatsNeeded: number;
    originDistanceSnapshot: number;
    destinationDistanceSnapshot: number;
    timeDifferenceSnapshot: number;
    riderName: string | null;
    riderProfilePictureUrl: string | null;
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

function hasTripRequestCoordinates(
    tripRequest: TripRequestForLifecycle
): tripRequest is TripRequestWithCoordinates {
    return (
        typeof tripRequest.originLatitude === "number" &&
        typeof tripRequest.originLongitude === "number" &&
        typeof tripRequest.destinationLatitude === "number" &&
        typeof tripRequest.destinationLongitude === "number"
    );
}

function hasRideCoordinates(ride: SuggestedMatchRecord["ride"]): ride is RideWithCoordinates {
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

function toSuggestedTripRequestForDriver(
    record: DriverSuggestedMatchRecord
): SuggestedTripRequestForDriver {
    return {
        matchId: record.id,
        tripRequestId: record.tripRequest.id,
        state: record.state,
        scoreSnapshot: record.scoreSnapshot,
        originText: record.tripRequest.originText,
        destinationText: record.tripRequest.destinationText,
        earliestDesiredAt: record.tripRequest.earliestDesiredAt.toISOString(),
        latestDesiredAt: record.tripRequest.latestDesiredAt.toISOString(),
        preferredDepartAt: record.tripRequest.preferredDepartAt
            ? record.tripRequest.preferredDepartAt.toISOString()
            : null,
        seatsNeeded: record.tripRequest.seatsNeeded,
        originDistanceSnapshot: record.originDistanceSnapshot,
        destinationDistanceSnapshot: record.destinationDistanceSnapshot,
        timeDifferenceSnapshot: record.timeDifferenceSnapshot,
        riderName: record.tripRequest.rider.name,
        riderProfilePictureUrl: record.tripRequest.rider.profilePictureUrl,
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

async function expireAllNonExpiredMatchesForRide(
    rideId: string,
    reason: string,
    now: Date
): Promise<void> {
    await prisma.match.updateMany({
        where: {
            rideId,
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

async function assertDriverOwnsRide(
    rideId: string,
    driverUserId: string
): Promise<void> {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: { driverUserId: true },
    });
    if (!ride) {
        throw new MatchLifecycleError("Ride not found.", {
            statusCode: 404,
            error: "Not Found",
            code: "RIDE_NOT_FOUND",
        });
    }
    if (ride.driverUserId !== driverUserId) {
        throw new MatchLifecycleError(
            "You are not allowed to access matches for this ride.",
            {
                statusCode: 403,
                error: "Forbidden",
                code: "RIDE_MATCH_FORBIDDEN",
            }
        );
    }
}

export async function expireInvalidMatchesForRide(rideId: string): Promise<void> {
    const now = new Date();
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
        return;
    }
    if (ride.status !== "ACTIVE") {
        await expireAllNonExpiredMatchesForRide(rideId, "RIDE_NOT_ACTIVE", now);
        return;
    }
    const rideTime = ride.preferredDepartAt ?? ride.earliestDepartAt;
    if (rideTime.getTime() <= now.getTime()) {
        await expireAllNonExpiredMatchesForRide(rideId, "RIDE_DEPARTURE_PASSED", now);
        return;
    }
    if (
        ride.originLatitude === null ||
        ride.originLongitude === null ||
        ride.destinationLatitude === null ||
        ride.destinationLongitude === null
    ) {
        await expireAllNonExpiredMatchesForRide(rideId, "RIDE_COORDINATES_REQUIRED", now);
        return;
    }

    const existingNonExpired = await prisma.match.findMany({
        where: {
            rideId,
            state: { not: MATCH_STATE.EXPIRED },
        },
        select: {
            id: true,
            tripRequest: {
                select: tripRequestLifecycleSelect,
            },
            ride: {
                select: rideEligibilitySelect,
            },
        },
    });

    const ineligibleIds = existingNonExpired
        .filter(
            (m) =>
                !isRideMatchEligible(
                    m.ride as SuggestedMatchRecord["ride"],
                    m.tripRequest,
                    now
                )
        )
        .map((m) => m.id);

    if (ineligibleIds.length === 0) {
        return;
    }

    await prisma.match.updateMany({
        where: {
            id: { in: ineligibleIds },
            state: { not: MATCH_STATE.EXPIRED },
        },
        data: {
            state: MATCH_STATE.EXPIRED,
            expiredAt: now,
            expirationReason: "PAIR_NO_LONGER_MATCH_ELIGIBLE",
        },
    });
}

export async function persistMatchesForRide(rideId: string): Promise<void> {
    await expireInvalidMatchesForRide(rideId);
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
        return;
    }
    if (ride.status !== "ACTIVE") {
        return;
    }
    const rideTime = ride.preferredDepartAt ?? ride.earliestDepartAt;
    const now = new Date();
    if (rideTime.getTime() <= now.getTime()) {
        return;
    }
    if (
        ride.originLatitude === null ||
        ride.originLongitude === null ||
        ride.destinationLatitude === null ||
        ride.destinationLongitude === null
    ) {
        return;
    }

    let candidates;
    try {
        candidates = await findCandidateTripRequestsForRide(rideId);
    } catch (error) {
        if (error instanceof TripRequestRideMatchingError) {
            if (error.code === "RIDE_NOT_FOUND") {
                return;
            }
        }
        throw error;
    }

    if (candidates.length === 0) {
        return;
    }

    const tripRequestIds = candidates.map((c) => c.tripRequestId);
    const existingRows = await prisma.match.findMany({
        where: {
            rideId,
            tripRequestId: { in: tripRequestIds },
        },
        select: {
            tripRequestId: true,
            state: true,
        },
    });
    const existingByTrip = new Map(
        existingRows.map((row) => [row.tripRequestId, row.state])
    );

    const rowsToCreate = candidates
        .filter((candidate) => {
            return !existingByTrip.get(candidate.tripRequestId);
        })
        .map((candidate) => ({
            tripRequestId: candidate.tripRequestId,
            rideId,
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

export async function getActiveMatchesForDriverRide(
    rideId: string,
    driverUserId: string
): Promise<SuggestedTripRequestForDriver[]> {
    await assertDriverOwnsRide(rideId, driverUserId);
    await persistMatchesForRide(rideId);

    const activeMatches = await prisma.match.findMany({
        where: {
            rideId,
            state: MATCH_STATE.SUGGESTED,
        },
        orderBy: [{ scoreSnapshot: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: driverSuggestedMatchSelect,
    });

    return activeMatches.map(toSuggestedTripRequestForDriver);
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
