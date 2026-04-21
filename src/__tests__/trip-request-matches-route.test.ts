import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockFindCandidateRidesForTripRequest } =
    vi.hoisted(() => {
        return {
            mockRequireStetsonAuth: vi.fn(),
            mockFindCandidateRidesForTripRequest: vi.fn(),
        };
    });

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
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

import { GET } from "@/app/api/trip-requests/[tripRequestId]/matches/route";
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
        mockFindCandidateRidesForTripRequest.mockResolvedValue([]);
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
        expect(mockFindCandidateRidesForTripRequest).not.toHaveBeenCalled();
    });

    it("returns 404 when trip request is not found", async () => {
        mockFindCandidateRidesForTripRequest.mockRejectedValue(
            new TripRequestRideMatchingError("Trip request not found.", {
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

    it("returns an empty array when there are no matches", async () => {
        mockFindCandidateRidesForTripRequest.mockResolvedValue([]);

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ items: [] });
    });

    it("returns candidate rides from the matching service", async () => {
        mockFindCandidateRidesForTripRequest.mockResolvedValue([
            {
                rideId: "ride-1",
                originText: "Stetson University",
                destinationText: "Daytona Beach",
                departureTime: "2030-01-01T10:30:00.000Z",
                availableSeats: 2,
                originDistance: 0.4,
                destinationDistance: 0.5,
                timeDifference: 30,
                score: 6.36,
            },
        ]);

        const response = await GET(makeRequest() as never, {
            params: Promise.resolve({ tripRequestId: "trip-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
            items: [
                {
                    rideId: "ride-1",
                    originText: "Stetson University",
                    destinationText: "Daytona Beach",
                    departureTime: "2030-01-01T10:30:00.000Z",
                    availableSeats: 2,
                    originDistance: 0.4,
                    destinationDistance: 0.5,
                    timeDifference: 30,
                    score: 6.36,
                },
            ],
        });
    });
});
