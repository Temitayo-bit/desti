import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Setup ───────────────────────────────────────────────────────────────
const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        booking: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        ride: {
            update: vi.fn(),
        },
        $transaction: vi.fn(async (cb: (tx: typeof prismaClient) => Promise<unknown>) => cb(prismaClient)),
    };
    return {
        mockRequireStetsonAuth: vi.fn(),
        mockPrisma: prismaClient,
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

import { POST } from "@/app/api/bookings/[bookingId]/cancel/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(bookingId: string): Request {
    return new Request(`http://localhost:3000/api/bookings/${bookingId}/cancel`, {
        method: "POST",
    });
}

function successAuth(userId = "rider_test1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/bookings/:bookingId/cancel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
    });

    // 1. Success
    it("cancels booking and restores seats", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue({
            id: "booking-1",
            riderUserId: "rider_test1",
            rideId: "ride-1",
            seatsBooked: 2,
            status: "CONFIRMED",
        });

        const req = makeRequest("booking-1");
        // Mock Next.js dynamic route params
        const res = await POST(req as never, { params: { bookingId: "booking-1" } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.message).toBe("Booking cancelled successfully.");

        // Verify changes
        expect(mockPrisma.booking.update).toHaveBeenCalledWith({
            where: { id: "booking-1" },
            data: { status: "CANCELLED" },
        });
        expect(mockPrisma.ride.update).toHaveBeenCalledWith({
            where: { id: "ride-1" },
            data: { seatsAvailable: { increment: 2 } },
        });
    });

    // 2. Unauthorized
    it("returns 403 if rider does not match", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue({
            id: "booking-1",
            riderUserId: "other_user", // Mismatch
            status: "CONFIRMED",
        });

        const req = makeRequest("booking-1");
        const res = await POST(req as never, { params: { bookingId: "booking-1" } });

        expect(res.status).toBe(403);
    });

    // 3. Not Found
    it("returns 404 if booking does not exist", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(null);

        const req = makeRequest("booking-missing");
        const res = await POST(req as never, { params: { bookingId: "booking-missing" } });

        expect(res.status).toBe(404);
    });

    // 4. Already Cancelled (Idempotent)
    it("returns 200 no-op if already cancelled", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue({
            id: "booking-1",
            riderUserId: "rider_test1",
            status: "CANCELLED",
        });

        const req = makeRequest("booking-1");
        const res = await POST(req as never, { params: { bookingId: "booking-1" } });

        expect(res.status).toBe(200);
        // Rides should NOT be updated
        expect(mockPrisma.ride.update).not.toHaveBeenCalled();
        // Booking should NOT be updated
        expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });
});
