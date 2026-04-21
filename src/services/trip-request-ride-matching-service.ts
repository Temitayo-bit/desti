import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ORIGIN_THRESHOLD_KM = 15;
export const DESTINATION_THRESHOLD_KM = 15;
export const TIME_WINDOW_MINUTES = 90;

const ORIGIN_DISTANCE_WEIGHT = 0.4;
const DESTINATION_DISTANCE_WEIGHT = 0.4;
const TIME_DIFFERENCE_WEIGHT = 0.2;
const MAX_RIDE_CANDIDATES = 250;
const KM_EARTH_RADIUS = 6371;
const MS_PER_MINUTE = 60_000;

const tripRequestSelect = {
    id: true,
    riderUserId: true,
    originLatitude: true,
    originLongitude: true,
    destinationLatitude: true,
    destinationLongitude: true,
    earliestDesiredAt: true,
    preferredDepartAt: true,
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

function calculateScore(
    originDistanceKm: number,
    destinationDistanceKm: number,
    timeDifferenceMinutes: number
): number {
    return (
        originDistanceKm * ORIGIN_DISTANCE_WEIGHT +
        destinationDistanceKm * DESTINATION_DISTANCE_WEIGHT +
        timeDifferenceMinutes * TIME_DIFFERENCE_WEIGHT
    );
}

function toRideMatchCandidate(
    ride: RideForMatching,
    tripRequest: TripRequestForMatching
): RideMatchCandidate | null {
    if (
        ride.status !== "ACTIVE" ||
        ride.seatsAvailable < 1 ||
        ride.driverUserId === tripRequest.riderUserId
    ) {
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

    const rideTime = getRideReferenceTime(ride);
    const tripRequestTime = getTripRequestReferenceTime(tripRequest);
    const timeDifference =
        Math.abs(rideTime.getTime() - tripRequestTime.getTime()) / MS_PER_MINUTE;

    if (timeDifference > TIME_WINDOW_MINUTES) {
        return null;
    }

    const score = calculateScore(
        originDistance,
        destinationDistance,
        timeDifference
    );

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
            latestDepartAt: { gte: lowerBound },
        },
        orderBy: [{ earliestDepartAt: "asc" }, { id: "asc" }],
        take: MAX_RIDE_CANDIDATES,
        select: rideSelect,
    });

    const matches = rides
        .map((ride) => toRideMatchCandidate(ride, tripRequest))
        .filter((candidate): candidate is RideMatchCandidate => candidate !== null)
        .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            if (a.timeDifference !== b.timeDifference) {
                return a.timeDifference - b.timeDifference;
            }
            return a.rideId.localeCompare(b.rideId);
        });

    return matches;
}
