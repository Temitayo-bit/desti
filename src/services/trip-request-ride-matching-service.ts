import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ORIGIN_THRESHOLD_KM = 8;
export const DESTINATION_THRESHOLD_KM = 8;
export const TIME_WINDOW_MINUTES = 45;
export const MAX_MATCH_RESULTS = 5;

const ORIGIN_DISTANCE_WEIGHT = 0.35;
const DESTINATION_DISTANCE_WEIGHT = 0.35;
const TIME_DIFFERENCE_WEIGHT = 0.2;
const IMBALANCE_PENALTY_WEIGHT = 0.1;
const IMBALANCE_TOLERANCE = 0.25;
const MAX_MATCH_SCORE = 0.68;
const MAX_ALLOWED_IMBALANCE = 0.75;
const MAX_RIDE_CANDIDATES = 250;
const KM_EARTH_RADIUS = 6371;
const MS_PER_MINUTE = 60_000;

const tripRequestSelect = {
    id: true,
    riderUserId: true,
    status: true,
    originText: true,
    destinationText: true,
    originLatitude: true,
    originLongitude: true,
    destinationLatitude: true,
    destinationLongitude: true,
    earliestDesiredAt: true,
    latestDesiredAt: true,
    preferredDepartAt: true,
    seatsNeeded: true,
} satisfies Prisma.TripRequestSelect;

const rideSelect = {
    id: true,
    driverUserId: true,
    originText: true,
    destinationText: true,
    originLatitude: true,
    originLongitude: true,
    destinationLatitude: true,
    destinationLongitude: true,
    earliestDepartAt: true,
    latestDepartAt: true,
    preferredDepartAt: true,
    seatsAvailable: true,
    status: true,
} satisfies Prisma.RideSelect;

type TripRequestForMatching = Prisma.TripRequestGetPayload<{
    select: typeof tripRequestSelect;
}>;

type RideForMatching = Prisma.RideGetPayload<{
    select: typeof rideSelect;
}>;

export interface RideMatchCandidate {
    rideId: string;
    originText: string;
    destinationText: string;
    departureTime: string;
    availableSeats: number;
    originDistance: number;
    destinationDistance: number;
    timeDifference: number;
    score: number;
}

/** Suggested trip request for a driver’s ride (same scoring rules as `findCandidateRidesForTripRequest`). */
export interface TripRequestForRideMatch {
    tripRequestId: string;
    originText: string;
    destinationText: string;
    earliestDesiredAt: string;
    latestDesiredAt: string;
    preferredDepartAt: string | null;
    seatsNeeded: number;
    riderUserId: string;
    originDistance: number;
    destinationDistance: number;
    timeDifference: number;
    score: number;
}

export class TripRequestRideMatchingError extends Error {
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
        this.name = "TripRequestRideMatchingError";
        this.statusCode = statusCode;
        this.error = error;
        this.code = code;
    }
}

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

function round(value: number, precision = 3): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}

export function haversineDistanceKm(
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number
): number {
    const dLat = toRadians(latitudeB - latitudeA);
    const dLng = toRadians(longitudeB - longitudeA);
    const latARad = toRadians(latitudeA);
    const latBRad = toRadians(latitudeB);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(latARad) *
            Math.cos(latBRad) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return KM_EARTH_RADIUS * c;
}

function getTripRequestReferenceTime(tripRequest: TripRequestForMatching): Date {
    return tripRequest.preferredDepartAt ?? tripRequest.earliestDesiredAt;
}

function getRideReferenceTime(ride: RideForMatching): Date {
    return ride.preferredDepartAt ?? ride.earliestDepartAt;
}

function hasTripRequestCoordinates(tripRequest: TripRequestForMatching): boolean {
    return (
        typeof tripRequest.originLatitude === "number" &&
        typeof tripRequest.originLongitude === "number" &&
        typeof tripRequest.destinationLatitude === "number" &&
        typeof tripRequest.destinationLongitude === "number"
    );
}

function normalize(value: number, maxValue: number): number {
    if (maxValue <= 0) return 0;
    return Math.min(value / maxValue, 1);
}

function calculateImbalancePenalty(imbalance: number): number {
    if (imbalance <= IMBALANCE_TOLERANCE) {
        return 0;
    }

    return (imbalance - IMBALANCE_TOLERANCE) / (1 - IMBALANCE_TOLERANCE);
}

function calculateScore(
    originDistanceKm: number,
    destinationDistanceKm: number,
    timeDifferenceMinutes: number
): { score: number; imbalance: number } {
    const normalizedOriginDistance = normalize(
        originDistanceKm,
        ORIGIN_THRESHOLD_KM
    );
    const normalizedDestinationDistance = normalize(
        destinationDistanceKm,
        DESTINATION_THRESHOLD_KM
    );
    const normalizedTimeDifference = normalize(
        timeDifferenceMinutes,
        TIME_WINDOW_MINUTES
    );

    const imbalance = Math.abs(
        normalizedOriginDistance - normalizedDestinationDistance
    );
    const imbalancePenalty = calculateImbalancePenalty(imbalance);

    const score =
        normalizedOriginDistance * ORIGIN_DISTANCE_WEIGHT +
        normalizedDestinationDistance * DESTINATION_DISTANCE_WEIGHT +
        normalizedTimeDifference * TIME_DIFFERENCE_WEIGHT +
        imbalancePenalty * IMBALANCE_PENALTY_WEIGHT;

    return { score, imbalance };
}

function toRideMatchCandidate(
    ride: RideForMatching,
    tripRequest: TripRequestForMatching,
    now: Date
): RideMatchCandidate | null {
    if (tripRequest.status !== "ACTIVE") {
        return null;
    }
    if (
        ride.status !== "ACTIVE" ||
        ride.seatsAvailable < 1 ||
        ride.driverUserId === tripRequest.riderUserId
    ) {
        return null;
    }

    const rideTime = getRideReferenceTime(ride);
    if (rideTime.getTime() < now.getTime()) {
        return null;
    }

    if (
        ride.originLatitude === null ||
        ride.originLongitude === null ||
        ride.destinationLatitude === null ||
        ride.destinationLongitude === null ||
        tripRequest.originLatitude === null ||
        tripRequest.originLongitude === null ||
        tripRequest.destinationLatitude === null ||
        tripRequest.destinationLongitude === null
    ) {
        return null;
    }

    const originDistance = haversineDistanceKm(
        tripRequest.originLatitude,
        tripRequest.originLongitude,
        ride.originLatitude,
        ride.originLongitude
    );

    if (originDistance > ORIGIN_THRESHOLD_KM) {
        return null;
    }

    const destinationDistance = haversineDistanceKm(
        tripRequest.destinationLatitude,
        tripRequest.destinationLongitude,
        ride.destinationLatitude,
        ride.destinationLongitude
    );

    if (destinationDistance > DESTINATION_THRESHOLD_KM) {
        return null;
    }

    const tripRequestTime = getTripRequestReferenceTime(tripRequest);
    const timeDifference =
        Math.abs(rideTime.getTime() - tripRequestTime.getTime()) / MS_PER_MINUTE;

    if (timeDifference > TIME_WINDOW_MINUTES) {
        return null;
    }

    const { score, imbalance } = calculateScore(
        originDistance,
        destinationDistance,
        timeDifference
    );
    if (score > MAX_MATCH_SCORE || imbalance > MAX_ALLOWED_IMBALANCE) {
        return null;
    }

    return {
        rideId: ride.id,
        originText: ride.originText,
        destinationText: ride.destinationText,
        departureTime: rideTime.toISOString(),
        availableSeats: ride.seatsAvailable,
        originDistance: round(originDistance),
        destinationDistance: round(destinationDistance),
        timeDifference: round(timeDifference),
        score: round(score),
    };
}

export async function findCandidateRidesForTripRequest(
    tripRequestId: string
): Promise<RideMatchCandidate[]> {
    const tripRequest = await prisma.tripRequest.findUnique({
        where: { id: tripRequestId },
        select: tripRequestSelect,
    });

    if (!tripRequest) {
        throw new TripRequestRideMatchingError("Trip request not found.", {
            statusCode: 404,
            error: "Not Found",
            code: "TRIP_REQUEST_NOT_FOUND",
        });
    }

    if (!hasTripRequestCoordinates(tripRequest)) {
        throw new TripRequestRideMatchingError(
            "Trip request is missing required coordinates.",
            {
                statusCode: 400,
                error: "Bad Request",
                code: "TRIP_REQUEST_COORDINATES_REQUIRED",
            }
        );
    }

    const tripRequestTime = getTripRequestReferenceTime(tripRequest);
    const lowerBound = new Date(
        tripRequestTime.getTime() - TIME_WINDOW_MINUTES * MS_PER_MINUTE
    );
    const upperBound = new Date(
        tripRequestTime.getTime() + TIME_WINDOW_MINUTES * MS_PER_MINUTE
    );
    const now = new Date();
    const effectiveLowerBound = new Date(
        Math.max(lowerBound.getTime(), now.getTime())
    );

    const rides = await prisma.ride.findMany({
        where: {
            status: "ACTIVE",
            seatsAvailable: { gt: 0 },
            driverUserId: { not: tripRequest.riderUserId },
            originLatitude: { not: null },
            originLongitude: { not: null },
            destinationLatitude: { not: null },
            destinationLongitude: { not: null },
            earliestDepartAt: { lte: upperBound },
            latestDepartAt: { gte: effectiveLowerBound },
        },
        orderBy: [{ earliestDepartAt: "asc" }, { id: "asc" }],
        take: MAX_RIDE_CANDIDATES,
        select: rideSelect,
    });

    const matches = rides
        .map((ride) => toRideMatchCandidate(ride, tripRequest, now))
        .filter((candidate): candidate is RideMatchCandidate => candidate !== null)
        .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            if (a.timeDifference !== b.timeDifference) {
                return a.timeDifference - b.timeDifference;
            }
            return a.rideId.localeCompare(b.rideId);
        })
        .slice(0, MAX_MATCH_RESULTS);

    return matches;
}

function toTripRequestForRideMatch(
    ride: RideForMatching,
    tripRequest: TripRequestForMatching,
    now: Date
): TripRequestForRideMatch | null {
    const c = toRideMatchCandidate(ride, tripRequest, now);
    if (!c) {
        return null;
    }

    return {
        tripRequestId: tripRequest.id,
        originText: tripRequest.originText,
        destinationText: tripRequest.destinationText,
        earliestDesiredAt: tripRequest.earliestDesiredAt.toISOString(),
        latestDesiredAt: tripRequest.latestDesiredAt.toISOString(),
        preferredDepartAt: tripRequest.preferredDepartAt
            ? tripRequest.preferredDepartAt.toISOString()
            : null,
        seatsNeeded: tripRequest.seatsNeeded,
        riderUserId: tripRequest.riderUserId,
        originDistance: c.originDistance,
        destinationDistance: c.destinationDistance,
        timeDifference: c.timeDifference,
        score: c.score,
    };
}

/**
 * Suggested active trip requests for a driver’s ride. Uses the same `toRideMatchCandidate`
 * scoring as the trip-request → rides direction (not duplicated on the client).
 */
export async function findCandidateTripRequestsForRide(
    rideId: string
): Promise<TripRequestForRideMatch[]> {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: rideSelect,
    });

    if (!ride) {
        throw new TripRequestRideMatchingError("Ride not found.", {
            statusCode: 404,
            error: "Not Found",
            code: "RIDE_NOT_FOUND",
        });
    }

    if (
        ride.originLatitude === null ||
        ride.originLongitude === null ||
        ride.destinationLatitude === null ||
        ride.destinationLongitude === null
    ) {
        throw new TripRequestRideMatchingError(
            "Ride is missing required coordinates for matching.",
            {
                statusCode: 400,
                error: "Bad Request",
                code: "RIDE_COORDINATES_REQUIRED",
            }
        );
    }

    const now = new Date();
    const rideTime = getRideReferenceTime(ride);
    if (rideTime.getTime() < now.getTime()) {
        return [];
    }

    if (ride.status !== "ACTIVE" || ride.seatsAvailable < 1) {
        return [];
    }

    const lowerBound = new Date(
        rideTime.getTime() - TIME_WINDOW_MINUTES * MS_PER_MINUTE
    );
    const upperBound = new Date(
        rideTime.getTime() + TIME_WINDOW_MINUTES * MS_PER_MINUTE
    );
    const effectiveLowerBound = new Date(
        Math.max(lowerBound.getTime(), now.getTime())
    );

    const tripRequests = await prisma.tripRequest.findMany({
        where: {
            status: "ACTIVE",
            seatsNeeded: { gte: 1 },
            riderUserId: { not: ride.driverUserId },
            originLatitude: { not: null },
            originLongitude: { not: null },
            destinationLatitude: { not: null },
            destinationLongitude: { not: null },
            earliestDesiredAt: { lte: upperBound },
            latestDesiredAt: { gte: effectiveLowerBound },
        },
        orderBy: [{ earliestDesiredAt: "asc" }, { id: "asc" }],
        take: MAX_RIDE_CANDIDATES,
        select: tripRequestSelect,
    });

    return tripRequests
        .map((tr) => toTripRequestForRideMatch(ride, tr, now))
        .filter(
            (candidate): candidate is TripRequestForRideMatch => candidate !== null
        )
        .sort((a, b) => {
            if (a.score !== b.score) {
                return a.score - b.score;
            }
            if (a.timeDifference !== b.timeDifference) {
                return a.timeDifference - b.timeDifference;
            }
            return a.tripRequestId.localeCompare(b.tripRequestId);
        })
        .slice(0, MAX_MATCH_RESULTS);
}
