import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    MockMatchLifecycleError,
    MockTripRequestRideMatchingError,
} from "@/__tests__/helpers/lifecycle-error-mocks";

const { mockRequireStetsonAuth, mockAcceptMatch } = vi.hoisted(() => {
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockAcceptMatch: vi.fn(),
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/services/trip-request-match-lifecycle-service", () => {
    return {
        acceptMatch: (...args: unknown[]) => mockAcceptMatch(...args),
        MatchLifecycleError: MockMatchLifecycleError,
    };
});

vi.mock("@/services/trip-request-ride-matching-service", () => {
    return { TripRequestRideMatchingError: MockTripRequestRideMatchingError };
});

import { POST } from "@/app/api/matches/[matchId]/accept/route";
import { MatchLifecycleError } from "@/services/trip-request-match-lifecycle-service";

function makeRequest(matchId = "match-1"): Request {
    return new Request(`http://localhost:3000/api/matches/${matchId}/accept`, {
        method: "POST",
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

describe("POST /api/matches/:matchId/accept", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockAcceptMatch.mockResolvedValue({
            matchId: "match-1",
            tripRequestId: "trip-1",
            rideId: "ride-1",
            state: "ACCEPTED",
            scoreSnapshot: 0.312,
            originDistanceSnapshot: 0.4,
            destinationDistanceSnapshot: 0.5,
            timeDifferenceSnapshot: 30,
            originText: "Stetson University",
            destinationText: "Daytona Beach",
            departureTime: "2030-01-01T10:30:00.000Z",
            availableSeats: 2,
            acceptedAt: "2030-01-01T09:00:00.000Z",
            rejectedAt: null,
            expiredAt: null,
            expirationReason: null,
        });
    });

    it("returns auth/onboarding failures directly", async () => {
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

        const response = await POST(makeRequest() as never, {
            params: Promise.resolve({ matchId: "match-1" }),
        });

        expect(response.status).toBe(403);
        expect(mockAcceptMatch).not.toHaveBeenCalled();
    });

    it("accepts a suggested match", async () => {
        const response = await POST(makeRequest("match-1") as never, {
            params: Promise.resolve({ matchId: "match-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(mockAcceptMatch).toHaveBeenCalledWith("match-1", "rider-1");
        expect(json.item.state).toBe("ACCEPTED");
    });

    it("returns 409 for non-suggested matches", async () => {
        mockAcceptMatch.mockRejectedValue(
            new MatchLifecycleError("Only suggested matches can be accepted.", {
                statusCode: 409,
                error: "Conflict",
                code: "MATCH_NOT_SUGGESTED",
            })
        );

        const response = await POST(makeRequest("match-1") as never, {
            params: Promise.resolve({ matchId: "match-1" }),
        });
        const json = await response.json();

        expect(response.status).toBe(409);
        expect(json).toEqual({
            error: "Conflict",
            code: "MATCH_NOT_SUGGESTED",
            message: "Only suggested matches can be accepted.",
        });
    });

    it("returns 403 for unauthorized actors", async () => {
        mockAcceptMatch.mockRejectedValue(
            new MatchLifecycleError("You are not allowed to manage this match.", {
                statusCode: 403,
                error: "Forbidden",
                code: "MATCH_FORBIDDEN",
            })
        );

        const response = await POST(makeRequest("match-1") as never, {
            params: Promise.resolve({ matchId: "match-1" }),
        });

        expect(response.status).toBe(403);
    });
});
