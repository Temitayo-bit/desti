import { beforeEach, describe, expect, it, vi } from "vitest";

type MatchStateValue = "SUGGESTED" | "ACCEPTED" | "REJECTED" | "EXPIRED";

interface TripRequestRecord {
    id: string;
    riderUserId: string;
    status: "ACTIVE" | "CANCELLED" | "CLOSED";
    earliestDesiredAt: Date;
    preferredDepartAt: Date | null;
}

interface RideRecord {
    id: string;
    originText: string;
    destinationText: string;
    earliestDepartAt: Date;
    preferredDepartAt: Date | null;
    seatsAvailable: number;
}

interface MatchRecord {
    id: string;
    tripRequestId: string;
    rideId: string;
    state: MatchStateValue;
    scoreSnapshot: number;
    originDistanceSnapshot: number;
    destinationDistanceSnapshot: number;
    timeDifferenceSnapshot: number;
    acceptedAt: Date | null;
    rejectedAt: Date | null;
    expiredAt: Date | null;
    expirationReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const { mockPrisma, mockFindCandidateRidesForTripRequest, state } = vi.hoisted(
    () => {
        const tripRequests = new Map<string, TripRequestRecord>();
        const rides = new Map<string, RideRecord>();
        let matches: MatchRecord[] = [];
        let idCounter = 0;

        function attachRelations(match: MatchRecord) {
            const tripRequest = tripRequests.get(match.tripRequestId);
            const ride = rides.get(match.rideId);
            if (!tripRequest || !ride) return null;

            return {
                ...match,
                tripRequest: {
                    riderUserId: tripRequest.riderUserId,
                },
                ride: {
                    id: ride.id,
                    originText: ride.originText,
                    destinationText: ride.destinationText,
                    earliestDepartAt: ride.earliestDepartAt,
                    preferredDepartAt: ride.preferredDepartAt,
                    seatsAvailable: ride.seatsAvailable,
                },
            };
        }

        function whereMatches(where: Record<string, unknown> | undefined, match: MatchRecord) {
            if (!where) return true;

            if (
                typeof where.tripRequestId === "string" &&
                match.tripRequestId !== where.tripRequestId
            ) {
                return false;
            }

            if (typeof where.id === "object" && where.id !== null && "in" in where.id) {
                const values = (where.id as { in: string[] }).in;
                if (!values.includes(match.id)) return false;
            }

            if (
                typeof where.rideId === "object" &&
                where.rideId !== null &&
                "in" in where.rideId
            ) {
                const values = (where.rideId as { in: string[] }).in;
                if (!values.includes(match.rideId)) return false;
            }

            if (typeof where.state === "string" && match.state !== where.state) {
                return false;
            }

            if (
                typeof where.state === "object" &&
                where.state !== null &&
                "not" in where.state
            ) {
                if (match.state === (where.state as { not: MatchStateValue }).not) {
                    return false;
                }
            }

            return true;
        }

        const prismaClient = {
            tripRequest: {
                findUnique: vi.fn(
                    async ({
                        where,
                    }: {
                        where: { id: string };
                    }): Promise<TripRequestRecord | null> => {
                        return tripRequests.get(where.id) ?? null;
                    }
                ),
            },
            match: {
                findMany: vi.fn(
                    async ({
                        where,
                        orderBy,
                    }: {
                        where?: Record<string, unknown>;
                        orderBy?: Array<Record<string, "asc" | "desc">>;
                    }) => {
                        let filtered = matches.filter((match) =>
                            whereMatches(where, match)
                        );

                        if (orderBy) {
                            filtered = [...filtered].sort((a, b) => {
                                for (const clause of orderBy) {
                                    if ("createdAt" in clause) {
                                        const direction = clause.createdAt;
                                        if (
                                            a.createdAt.getTime() !==
                                            b.createdAt.getTime()
                                        ) {
                                            return direction === "asc"
                                                ? a.createdAt.getTime() -
                                                      b.createdAt.getTime()
                                                : b.createdAt.getTime() -
                                                      a.createdAt.getTime();
                                        }
                                    }
                                    if ("id" in clause && a.id !== b.id) {
                                        const direction = clause.id;
                                        return direction === "asc"
                                            ? a.id.localeCompare(b.id)
                                            : b.id.localeCompare(a.id);
                                    }
                                }
                                return 0;
                            });
                        }

                        return filtered
                            .map((match) => attachRelations(match))
                            .filter((value): value is NonNullable<typeof value> =>
                                Boolean(value)
                            );
                    }
                ),
                findUnique: vi.fn(
                    async ({ where }: { where: { id: string } }) => {
                        const match = matches.find((candidate) => candidate.id === where.id);
                        if (!match) return null;
                        return attachRelations(match);
                    }
                ),
                updateMany: vi.fn(
                    async ({
                        where,
                        data,
                    }: {
                        where: Record<string, unknown>;
                        data: Partial<MatchRecord>;
                    }) => {
                        let count = 0;
                        matches = matches.map((match) => {
                            if (!whereMatches(where, match)) return match;
                            count += 1;
                            return {
                                ...match,
                                ...data,
                                updatedAt: new Date("2030-01-01T09:00:00.000Z"),
                            };
                        });
                        return { count };
                    }
                ),
                createMany: vi.fn(
                    async ({
                        data,
                        skipDuplicates,
                    }: {
                        data: Array<{
                            tripRequestId: string;
                            rideId: string;
                            state: MatchStateValue;
                            scoreSnapshot: number;
                            originDistanceSnapshot: number;
                            destinationDistanceSnapshot: number;
                            timeDifferenceSnapshot: number;
                        }>;
                        skipDuplicates?: boolean;
                    }) => {
                        let count = 0;
                        for (const row of data) {
                            const exists = matches.some(
                                (match) =>
                                    match.tripRequestId === row.tripRequestId &&
                                    match.rideId === row.rideId
                            );
                            if (exists && skipDuplicates) continue;
                            if (exists) continue;

                            idCounter += 1;
                            matches.push({
                                id: `match-${idCounter}`,
                                tripRequestId: row.tripRequestId,
                                rideId: row.rideId,
                                state: row.state,
                                scoreSnapshot: row.scoreSnapshot,
                                originDistanceSnapshot: row.originDistanceSnapshot,
                                destinationDistanceSnapshot:
                                    row.destinationDistanceSnapshot,
                                timeDifferenceSnapshot: row.timeDifferenceSnapshot,
                                acceptedAt: null,
                                rejectedAt: null,
                                expiredAt: null,
                                expirationReason: null,
                                createdAt: new Date(
                                    `2030-01-01T08:0${idCounter}:00.000Z`
                                ),
                                updatedAt: new Date(
                                    `2030-01-01T08:0${idCounter}:00.000Z`
                                ),
                            });
                            count += 1;
                        }
                        return { count };
                    }
                ),
                update: vi.fn(
                    async ({
                        where,
                        data,
                    }: {
                        where: { id: string };
                        data: Partial<MatchRecord>;
                    }) => {
                        const index = matches.findIndex(
                            (candidate) => candidate.id === where.id
                        );
                        if (index < 0) throw new Error("missing match in mock");

                        matches[index] = {
                            ...matches[index],
                            ...data,
                            updatedAt: new Date("2030-01-01T09:30:00.000Z"),
                        };

                        const attached = attachRelations(matches[index]);
                        if (!attached) throw new Error("missing relations in mock");
                        return attached;
                    }
                ),
            },
        };

        return {
            state: {
                tripRequests,
                rides,
                getMatches: () => matches,
                setMatches: (nextMatches: MatchRecord[]) => {
                    matches = nextMatches;
                },
                reset() {
                    tripRequests.clear();
                    rides.clear();
                    matches = [];
                    idCounter = 0;
                },
            },
            mockPrisma: prismaClient,
            mockFindCandidateRidesForTripRequest: vi.fn(),
        };
    }
);

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/services/trip-request-ride-matching-service", () => {
    class MockTripRequestRideMatchingError extends Error {
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
            this.statusCode = statusCode;
            this.error = error;
            this.code = code;
        }
    }

    return {
        findCandidateRidesForTripRequest: (...args: unknown[]) =>
            mockFindCandidateRidesForTripRequest(...args),
        TripRequestRideMatchingError: MockTripRequestRideMatchingError,
    };
});

import {
    acceptMatch,
    expireInvalidMatchesForTripRequest,
    getActiveMatchesForTripRequest,
    MatchLifecycleError,
    persistMatchesForTripRequest,
    rejectMatch,
} from "@/services/trip-request-match-lifecycle-service";

function seedActiveTripRequest(id = "trip-1", riderUserId = "rider-1") {
    state.tripRequests.set(id, {
        id,
        riderUserId,
        status: "ACTIVE",
        earliestDesiredAt: new Date("2030-01-01T10:00:00.000Z"),
        preferredDepartAt: null,
    });
}

function seedRide(id = "ride-1") {
    state.rides.set(id, {
        id,
        originText: "Stetson University",
        destinationText: "Daytona Beach",
        earliestDepartAt: new Date("2030-01-01T10:30:00.000Z"),
        preferredDepartAt: null,
        seatsAvailable: 2,
    });
}

function seedMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
    const match: MatchRecord = {
        id: "match-1",
        tripRequestId: "trip-1",
        rideId: "ride-1",
        state: "SUGGESTED",
        scoreSnapshot: 0.24,
        originDistanceSnapshot: 0.5,
        destinationDistanceSnapshot: 0.6,
        timeDifferenceSnapshot: 20,
        acceptedAt: null,
        rejectedAt: null,
        expiredAt: null,
        expirationReason: null,
        createdAt: new Date("2030-01-01T08:00:00.000Z"),
        updatedAt: new Date("2030-01-01T08:00:00.000Z"),
        ...overrides,
    };
    state.setMatches([match]);
    return match;
}

describe("trip request match lifecycle service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.reset();
        seedActiveTripRequest();
        seedRide();
        mockFindCandidateRidesForTripRequest.mockResolvedValue([
            {
                rideId: "ride-1",
                originText: "Stetson University",
                destinationText: "Daytona Beach",
                departureTime: "2030-01-01T10:30:00.000Z",
                availableSeats: 2,
                originDistance: 0.5,
                destinationDistance: 0.6,
                timeDifference: 20,
                score: 0.24,
            },
        ]);
    });

    it("persists generated candidates as suggested matches", async () => {
        await persistMatchesForTripRequest("trip-1");

        const matches = state.getMatches();
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
            tripRequestId: "trip-1",
            rideId: "ride-1",
            state: "SUGGESTED",
            scoreSnapshot: 0.24,
            originDistanceSnapshot: 0.5,
            destinationDistanceSnapshot: 0.6,
            timeDifferenceSnapshot: 20,
        });
    });

    it("does not duplicate an existing suggested pair", async () => {
        seedMatch({ state: "SUGGESTED" });

        await persistMatchesForTripRequest("trip-1");

        expect(state.getMatches()).toHaveLength(1);
    });

    it("does not recreate a rejected pair", async () => {
        seedMatch({
            state: "REJECTED",
            rejectedAt: new Date("2030-01-01T09:00:00.000Z"),
        });

        await persistMatchesForTripRequest("trip-1");

        const matches = state.getMatches();
        expect(matches).toHaveLength(1);
        expect(matches[0].state).toBe("REJECTED");
    });

    it("does not recreate an accepted pair as suggested", async () => {
        seedMatch({
            state: "ACCEPTED",
            acceptedAt: new Date("2030-01-01T09:00:00.000Z"),
        });

        await persistMatchesForTripRequest("trip-1");

        const matches = state.getMatches();
        expect(matches).toHaveLength(1);
        expect(matches[0].state).toBe("ACCEPTED");
    });

    it("keeps expired pairs suppressed (no automatic revival)", async () => {
        seedMatch({
            state: "EXPIRED",
            expiredAt: new Date("2030-01-01T09:00:00.000Z"),
            expirationReason: "RIDE_NO_LONGER_MATCH_ELIGIBLE",
        });

        await persistMatchesForTripRequest("trip-1");

        const matches = state.getMatches();
        expect(matches).toHaveLength(1);
        expect(matches[0].state).toBe("EXPIRED");
    });

    it("returns only active suggested matches on read", async () => {
        state.setMatches([
            {
                id: "match-1",
                tripRequestId: "trip-1",
                rideId: "ride-1",
                state: "SUGGESTED",
                scoreSnapshot: 0.24,
                originDistanceSnapshot: 0.5,
                destinationDistanceSnapshot: 0.6,
                timeDifferenceSnapshot: 20,
                acceptedAt: null,
                rejectedAt: null,
                expiredAt: null,
                expirationReason: null,
                createdAt: new Date("2030-01-01T08:00:00.000Z"),
                updatedAt: new Date("2030-01-01T08:00:00.000Z"),
            },
            {
                id: "match-2",
                tripRequestId: "trip-1",
                rideId: "ride-2",
                state: "EXPIRED",
                scoreSnapshot: 0.36,
                originDistanceSnapshot: 0.7,
                destinationDistanceSnapshot: 0.8,
                timeDifferenceSnapshot: 30,
                acceptedAt: null,
                rejectedAt: null,
                expiredAt: new Date("2030-01-01T09:10:00.000Z"),
                expirationReason: "RIDE_NO_LONGER_MATCH_ELIGIBLE",
                createdAt: new Date("2030-01-01T08:10:00.000Z"),
                updatedAt: new Date("2030-01-01T08:10:00.000Z"),
            },
        ]);
        seedRide("ride-2");
        mockFindCandidateRidesForTripRequest.mockResolvedValue([
            {
                rideId: "ride-1",
                originText: "Stetson University",
                destinationText: "Daytona Beach",
                departureTime: "2030-01-01T10:30:00.000Z",
                availableSeats: 2,
                originDistance: 0.5,
                destinationDistance: 0.6,
                timeDifference: 20,
                score: 0.24,
            },
        ]);

        const items = await getActiveMatchesForTripRequest("trip-1", "rider-1");

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            matchId: "match-1",
            state: "SUGGESTED",
            rideId: "ride-1",
        });
    });

    it("expires matches when trip request is no longer active", async () => {
        seedMatch();
        state.tripRequests.set("trip-1", {
            id: "trip-1",
            riderUserId: "rider-1",
            status: "CANCELLED",
            earliestDesiredAt: new Date("2030-01-01T10:00:00.000Z"),
            preferredDepartAt: null,
        });

        await expireInvalidMatchesForTripRequest("trip-1");

        const match = state.getMatches()[0];
        expect(match.state).toBe("EXPIRED");
        expect(match.expirationReason).toBe("TRIP_REQUEST_NOT_ACTIVE");
    });

    it("read flow expires invalid parents and returns no active suggestions", async () => {
        seedMatch();
        state.tripRequests.set("trip-1", {
            id: "trip-1",
            riderUserId: "rider-1",
            status: "CANCELLED",
            earliestDesiredAt: new Date("2030-01-01T10:00:00.000Z"),
            preferredDepartAt: null,
        });

        const items = await getActiveMatchesForTripRequest("trip-1", "rider-1");

        expect(items).toEqual([]);
        expect(state.getMatches()[0].state).toBe("EXPIRED");
    });

    it("expires matches when trip request time has passed", async () => {
        seedMatch();
        state.tripRequests.set("trip-1", {
            id: "trip-1",
            riderUserId: "rider-1",
            status: "ACTIVE",
            earliestDesiredAt: new Date("2000-01-01T10:00:00.000Z"),
            preferredDepartAt: null,
        });

        await expireInvalidMatchesForTripRequest("trip-1");

        const match = state.getMatches()[0];
        expect(match.state).toBe("EXPIRED");
        expect(match.expirationReason).toBe("TRIP_REQUEST_DEPARTURE_PASSED");
    });

    it("expires matches when ride is no longer match-eligible", async () => {
        seedMatch();
        mockFindCandidateRidesForTripRequest.mockResolvedValue([]);

        await expireInvalidMatchesForTripRequest("trip-1");

        const match = state.getMatches()[0];
        expect(match.state).toBe("EXPIRED");
        expect(match.expirationReason).toBe("RIDE_NO_LONGER_MATCH_ELIGIBLE");
    });

    it("expires matches when ride departure has passed", async () => {
        seedMatch();
        mockFindCandidateRidesForTripRequest.mockResolvedValue([]);

        await expireInvalidMatchesForTripRequest("trip-1");

        expect(state.getMatches()[0].state).toBe("EXPIRED");
        expect(state.getMatches()[0].expirationReason).toBe(
            "RIDE_NO_LONGER_MATCH_ELIGIBLE"
        );
    });

    it("expires matches when ride is cancelled/completed/not bookable", async () => {
        seedMatch();
        mockFindCandidateRidesForTripRequest.mockResolvedValue([]);

        await expireInvalidMatchesForTripRequest("trip-1");

        expect(state.getMatches()[0].state).toBe("EXPIRED");
        expect(state.getMatches()[0].expirationReason).toBe(
            "RIDE_NO_LONGER_MATCH_ELIGIBLE"
        );
    });

    it("expires matches when ride has no available seats", async () => {
        seedMatch();
        mockFindCandidateRidesForTripRequest.mockResolvedValue([]);

        await expireInvalidMatchesForTripRequest("trip-1");

        expect(state.getMatches()[0].state).toBe("EXPIRED");
        expect(state.getMatches()[0].expirationReason).toBe(
            "RIDE_NO_LONGER_MATCH_ELIGIBLE"
        );
    });

    it("rejects a suggested match and keeps it suppressed", async () => {
        seedMatch();

        const rejected = await rejectMatch("match-1", "rider-1");

        expect(rejected.state).toBe("REJECTED");
        expect(rejected.rejectedAt).not.toBeNull();

        await persistMatchesForTripRequest("trip-1");
        expect(state.getMatches()).toHaveLength(1);
        expect(state.getMatches()[0].state).toBe("REJECTED");
    });

    it("fails rejecting a non-suggested match", async () => {
        seedMatch({
            state: "ACCEPTED",
            acceptedAt: new Date("2030-01-01T09:00:00.000Z"),
        });

        await expect(rejectMatch("match-1", "rider-1")).rejects.toMatchObject({
            statusCode: 409,
            code: "MATCH_NOT_SUGGESTED",
        } satisfies Partial<MatchLifecycleError>);
    });

    it("accepts a suggested match and keeps it suppressed from normal suggestions", async () => {
        seedMatch();

        const accepted = await acceptMatch("match-1", "rider-1");

        expect(accepted.state).toBe("ACCEPTED");
        expect(accepted.acceptedAt).not.toBeNull();

        await persistMatchesForTripRequest("trip-1");
        expect(state.getMatches()).toHaveLength(1);
        expect(state.getMatches()[0].state).toBe("ACCEPTED");
    });

    it("fails accepting a non-suggested match", async () => {
        seedMatch({
            state: "REJECTED",
            rejectedAt: new Date("2030-01-01T09:00:00.000Z"),
        });

        await expect(acceptMatch("match-1", "rider-1")).rejects.toMatchObject({
            statusCode: 409,
            code: "MATCH_NOT_SUGGESTED",
        } satisfies Partial<MatchLifecycleError>);
    });

    it("blocks unauthorized access for trip request matches", async () => {
        await expect(
            getActiveMatchesForTripRequest("trip-1", "other-user")
        ).rejects.toMatchObject({
            statusCode: 403,
            code: "TRIP_REQUEST_MATCH_FORBIDDEN",
        } satisfies Partial<MatchLifecycleError>);
    });
});
