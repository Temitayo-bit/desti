import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
    return {
        mockPrisma: {
            tripRequest: {
                findUnique: vi.fn(),
            },
            ride: {
                findMany: vi.fn(),
            },
        },
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import {
    findCandidateRidesForTripRequest,
    ORIGIN_THRESHOLD_KM,
    TIME_WINDOW_MINUTES,
    TripRequestRideMatchingError,
} from "@/services/trip-request-ride-matching-service";

function fakeTripRequest(overrides: Record<string, unknown> = {}) {
    return {
        id: "trip-1",
        riderUserId: "rider-1",
        originLatitude: 29.0361,
        originLongitude: -81.302,
        destinationLatitude: 29.2108,
        destinationLongitude: -81.0228,
        earliestDesiredAt: new Date("2030-01-01T10:00:00.000Z"),
        preferredDepartAt: null,
        ...overrides,
    };
}

function fakeRide(overrides: Record<string, unknown> = {}) {
    return {
        id: "ride-1",
        driverUserId: "driver-1",
        originText: "Stetson University",
        destinationText: "Daytona Beach",
        originLatitude: 29.0362,
        originLongitude: -81.3021,
        destinationLatitude: 29.2107,
        destinationLongitude: -81.0227,
        earliestDepartAt: new Date("2030-01-01T10:30:00.000Z"),
        latestDepartAt: new Date("2030-01-01T11:30:00.000Z"),
        preferredDepartAt: null,
        seatsAvailable: 2,
        status: "ACTIVE",
        ...overrides,
    };
}

describe("trip request ride matching service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.tripRequest.findUnique.mockResolvedValue(fakeTripRequest());
        mockPrisma.ride.findMany.mockResolvedValue([]);
    });

    it("returns valid ride candidates", async () => {
        mockPrisma.ride.findMany.mockResolvedValue([fakeRide()]);

        const result = await findCandidateRidesForTripRequest("trip-1");

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            rideId: "ride-1",
            originText: "Stetson University",
            destinationText: "Daytona Beach",
            availableSeats: 2,
        });
        expect(result[0].originDistance).toBeLessThan(ORIGIN_THRESHOLD_KM);

        expect(mockPrisma.ride.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 250,
                where: expect.objectContaining({
                    status: "ACTIVE",
                    seatsAvailable: { gt: 0 },
                    driverUserId: { not: "rider-1" },
                }),
            })
        );
    });

    it("excludes rides outside the distance thresholds", async () => {
        mockPrisma.ride.findMany.mockResolvedValue([
            fakeRide({
                id: "ride-far",
                originLatitude: 30.2,
                originLongitude: -81.3,
            }),
        ]);

        const result = await findCandidateRidesForTripRequest("trip-1");

        expect(result).toEqual([]);
    });

    it("excludes rides outside the time window", async () => {
        mockPrisma.ride.findMany.mockResolvedValue([
            fakeRide({
                id: "ride-late",
                earliestDepartAt: new Date("2030-01-01T15:00:00.000Z"),
            }),
        ]);

        const result = await findCandidateRidesForTripRequest("trip-1");

        expect(result).toEqual([]);
    });

    it("excludes rides owned by the same user", async () => {
        mockPrisma.ride.findMany.mockResolvedValue([
            fakeRide({
                id: "ride-self",
                driverUserId: "rider-1",
            }),
        ]);

        const result = await findCandidateRidesForTripRequest("trip-1");

        expect(result).toEqual([]);
    });

    it("excludes full rides", async () => {
        mockPrisma.ride.findMany.mockResolvedValue([
            fakeRide({
                id: "ride-full",
                seatsAvailable: 0,
            }),
        ]);

        const result = await findCandidateRidesForTripRequest("trip-1");

        expect(result).toEqual([]);
    });

    it("sorts candidates by best score first", async () => {
        mockPrisma.ride.findMany.mockResolvedValue([
            fakeRide({
                id: "ride-worse",
                originLatitude: 29.09,
                destinationLatitude: 29.26,
                earliestDepartAt: new Date(
                    "2030-01-01T11:25:00.000Z"
                ),
            }),
            fakeRide({
                id: "ride-best",
                originLatitude: 29.0361,
                destinationLatitude: 29.2108,
                earliestDepartAt: new Date(
                    "2030-01-01T10:05:00.000Z"
                ),
            }),
        ]);

        const result = await findCandidateRidesForTripRequest("trip-1");

        expect(result.map((item) => item.rideId)).toEqual([
            "ride-best",
            "ride-worse",
        ]);
    });

    it("returns an empty array when there are no matches", async () => {
        mockPrisma.ride.findMany.mockResolvedValue([]);

        const result = await findCandidateRidesForTripRequest("trip-1");

        expect(result).toEqual([]);
    });

    it("throws 404 when trip request does not exist", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(null);

        await expect(
            findCandidateRidesForTripRequest("trip-missing")
        ).rejects.toMatchObject<TripRequestRideMatchingError>({
            statusCode: 404,
            code: "TRIP_REQUEST_NOT_FOUND",
        });
    });

    it("throws 400 when trip request has missing coordinates", async () => {
        mockPrisma.tripRequest.findUnique.mockResolvedValue(
            fakeTripRequest({
                originLatitude: null,
            })
        );

        await expect(
            findCandidateRidesForTripRequest("trip-1")
        ).rejects.toMatchObject<TripRequestRideMatchingError>({
            statusCode: 400,
            code: "TRIP_REQUEST_COORDINATES_REQUIRED",
        });
    });

    it("uses the configured time window when prefiltering in the DB query", async () => {
        await findCandidateRidesForTripRequest("trip-1");

        const call = mockPrisma.ride.findMany.mock.calls[0][0] as {
            where: {
                earliestDepartAt: { lte: Date };
                latestDepartAt: { gte: Date };
            };
        };

        const upperBound = call.where.earliestDepartAt.lte;
        const lowerBound = call.where.latestDepartAt.gte;
        const windowMinutes =
            (upperBound.getTime() - lowerBound.getTime()) / (2 * 60_000);

        expect(windowMinutes).toBe(TIME_WINDOW_MINUTES);
    });
});
