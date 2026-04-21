import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockRequireStetsonAuth,
    mockGetActiveMatchesForTripRequest,
} = vi.hoisted(() => {
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockGetActiveMatchesForTripRequest: vi.fn(),
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/services/trip-request-match-lifecycle-service", () => {
    class MockMatchLifecycleError extends Error {
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
        getActiveMatchesForTripRequest: (...args: unknown[]) =>
            mockGetActiveMatchesForTripRequest(...args),
        MatchLifecycleError: MockMatchLifecycleError,
    };
});

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
        TripRequestRideMatchingError: MockTripRequestRideMatchingError,
    };
});

import { GET } from "@/app/api/trip-requests/[tripRequestId]/matches/route";
import { MatchLifecycleError } from "@/services/trip-request-match-lifecycle-service";
import { TripRequestRideMatchingError } from "@/services/trip-request-ride-matching-service";

function makeRequest(): Request {
    return new Request("http://localhost:3000/api/trip-requests/trip-1/matches", {
        method: "GET",
    });
}

function successAuth() {
    return {
        user: {
            clerkUserId: "rider-1",
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

describe("GET /api/trip-requests/:tripRequestId/matches", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockGetActiveMatchesForTripRequest.mockResolvedValue([]);
    });

    it("returns auth error responses directly (onboarding/auth guard)", async () => {
        mockRequireStetsonAuth.mockResolvedValue({
            error: new Response(
                JSON.stringify({
                    error: "Forbidden",
                    code: "ONBOARDING_REQUIRED",
                    message: "Complete onboarding before accessing this endpoint.",
                }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            ),
        });

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-1" }),
        });

        expect(response.status).toBe(403);
        expect(mockGetActiveMatchesForTripRequest).not.toHaveBeenCalled();
    });

    it("returns 403 when actor does not own trip request", async () => {
        mockGetActiveMatchesForTripRequest.mockRejectedValue(
            new MatchLifecycleError(
                "You are not allowed to access matches for this trip request.",
                {
                    statusCode: 403,
                    error: "Forbidden",
                    code: "TRIP_REQUEST_MATCH_FORBIDDEN",
                }
            )
        );

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(403);
        expect(json).toEqual({
            error: "Forbidden",
            code: "TRIP_REQUEST_MATCH_FORBIDDEN",
            message: "You are not allowed to access matches for this trip request.",
        });
    });

    it("returns 404 when trip request is not found", async () => {
        mockGetActiveMatchesForTripRequest.mockRejectedValue(
            new MatchLifecycleError("Trip request not found.", {
                statusCode: 404,
                error: "Not Found",
                code: "TRIP_REQUEST_NOT_FOUND",
            })
        );

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-missing" }),
        });
        const json = await response.json();

        expect(response.status).toBe(404);
        expect(json).toEqual({
            error: "Not Found",
            code: "TRIP_REQUEST_NOT_FOUND",
            message: "Trip request not found.",
        });
    });

    it("passes through trip request coordinate errors", async () => {
        mockGetActiveMatchesForTripRequest.mockRejectedValue(
            new TripRequestRideMatchingError(
                "Trip request is missing required coordinates.",
                {
                    statusCode: 400,
                    error: "Bad Request",
                    code: "TRIP_REQUEST_COORDINATES_REQUIRED",
                }
            )
        );

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
            error: "Bad Request",
            code: "TRIP_REQUEST_COORDINATES_REQUIRED",
            message: "Trip request is missing required coordinates.",
        });
    });

    it("returns an empty array when there are no active suggested matches", async () => {
        mockGetActiveMatchesForTripRequest.mockResolvedValue([]);

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ items: [] });
    });

    it("returns active suggested matches from lifecycle service", async () => {
        mockGetActiveMatchesForTripRequest.mockResolvedValue([
            {
                matchId: "match-1",
                rideId: "ride-1",
                state: "SUGGESTED",
                scoreSnapshot: 0.312,
                originDistanceSnapshot: 0.4,
                destinationDistanceSnapshot: 0.5,
                timeDifferenceSnapshot: 30,
                originText: "Stetson University",
                destinationText: "Daytona Beach",
                departureTime: "2030-01-01T10:30:00.000Z",
                availableSeats: 2,
            },
        ]);

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(mockGetActiveMatchesForTripRequest).toHaveBeenCalledWith(
            "trip-1",
            "rider-1"
        );
        expect(json).toEqual({
            items: [
                {
                    matchId: "match-1",
                    rideId: "ride-1",
                    state: "SUGGESTED",
                    scoreSnapshot: 0.312,
                    originDistanceSnapshot: 0.4,
                    destinationDistanceSnapshot: 0.5,
                    timeDifferenceSnapshot: 30,
                    originText: "Stetson University",
                    destinationText: "Daytona Beach",
                    departureTime: "2030-01-01T10:30:00.000Z",
                    availableSeats: 2,
                },
            ],
        });
    });
});
