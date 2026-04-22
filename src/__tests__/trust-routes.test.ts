import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockRequireStetsonAuth,
    mockCompleteBookingManually,
    mockCreateBookingRating,
    mockGetDriverRatingSummary,
    MockTrustServiceError,
} = vi.hoisted(() => {
    class TestTrustServiceError extends Error {
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
        mockRequireStetsonAuth: vi.fn(),
        mockCompleteBookingManually: vi.fn(),
        mockCreateBookingRating: vi.fn(),
        mockGetDriverRatingSummary: vi.fn(),
        MockTrustServiceError: TestTrustServiceError,
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/services/trust-service", () => ({
    completeBookingManually: (...args: unknown[]) => mockCompleteBookingManually(...args),
    createBookingRating: (...args: unknown[]) => mockCreateBookingRating(...args),
    getDriverRatingSummary: (...args: unknown[]) => mockGetDriverRatingSummary(...args),
    TrustServiceError: MockTrustServiceError,
}));

import { POST as completeBookingPOST } from "@/app/api/bookings/[bookingId]/complete/route";
import { POST as createRatingPOST } from "@/app/api/bookings/[bookingId]/rating/route";
import { GET as ratingSummaryGET } from "@/app/api/users/[userId]/rating-summary/route";

function successAuth(userId = "driver-1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: `${userId}@stetson.edu`,
        },
    };
}

describe("trust route handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
    });

    it("POST /api/bookings/:bookingId/complete completes booking for authorized actor", async () => {
        mockCompleteBookingManually.mockResolvedValue({
            id: "booking-1",
            status: "COMPLETED",
            completedAt: new Date("2030-01-01T12:00:00.000Z"),
        });

        const request = new Request("http://localhost:3000/api/bookings/booking-1/complete", {
            method: "POST",
        });

        const response = await completeBookingPOST(request as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe("COMPLETED");
        expect(mockCompleteBookingManually).toHaveBeenCalledWith("booking-1", "driver-1");
    });

    it("POST /api/bookings/:bookingId/complete maps trust conflicts cleanly", async () => {
        mockCompleteBookingManually.mockRejectedValue(
            new MockTrustServiceError("Booking is already completed.", {
                statusCode: 409,
                error: "Conflict",
                code: "BOOKING_ALREADY_COMPLETED",
            })
        );

        const request = new Request("http://localhost:3000/api/bookings/booking-1/complete", {
            method: "POST",
        });

        const response = await completeBookingPOST(request as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.code).toBe("BOOKING_ALREADY_COMPLETED");
    });

    it("POST /api/bookings/:bookingId/rating creates rider -> driver rating", async () => {
        mockCreateBookingRating.mockResolvedValue({
            id: "rating-1",
            bookingId: "booking-1",
            raterUserId: "rider-1",
            rateeUserId: "driver-1",
            score: 5,
            comment: "Great ride",
            createdAt: new Date("2030-01-01T13:00:00.000Z"),
        });

        mockRequireStetsonAuth.mockResolvedValue(successAuth("rider-1"));

        const request = new Request("http://localhost:3000/api/bookings/booking-1/rating", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score: 5, comment: "Great ride" }),
        });

        const response = await createRatingPOST(request as never, {
            params: Promise.resolve({ bookingId: "booking-1" }),
        });

        expect(response.status).toBe(201);
        expect(mockCreateBookingRating).toHaveBeenCalledWith(
            "booking-1",
            "rider-1",
            { score: 5, comment: "Great ride" }
        );
    });

    it("GET /api/users/:userId/rating-summary returns average and count", async () => {
        mockGetDriverRatingSummary.mockResolvedValue({
            userId: "driver-1",
            averageRating: 4.5,
            ratingCount: 2,
        });

        const request = new Request("http://localhost:3000/api/users/driver-1/rating-summary", {
            method: "GET",
        });

        const response = await ratingSummaryGET(request as never, {
            params: Promise.resolve({ userId: "driver-1" }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            userId: "driver-1",
            averageRating: 4.5,
            ratingCount: 2,
        });
    });
});
