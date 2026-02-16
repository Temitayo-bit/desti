import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Setup ───────────────────────────────────────────────────────────────
const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        user: { upsert: vi.fn().mockResolvedValue({}) },
        idempotencyKey: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        ride: {
            updateMany: vi.fn(),
            findUnique: vi.fn(),
        },
        booking: {
            create: vi.fn(),
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

import { POST } from "@/app/api/bookings/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
    return new Request("http://localhost:3000/api/bookings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "test-key-123",
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

function successAuth() {
    return {
        user: {
            clerkUserId: "rider_test1",
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/bookings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
        mockPrisma.ride.findUnique.mockResolvedValue({
            id: "ride-1",
            driverUserId: "driver_other_user",
        });
    });

    // 1. Success
    it("returns 201 and creates booking on success", async () => {
        // Mock capacity check success
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
        // Mock booking create success
        mockPrisma.booking.create.mockResolvedValue({
            id: "booking-123",
            status: "CONFIRMED",
            rideId: "ride-1",
            riderUserId: "rider_test1",
            seatsBooked: 2,
        });

        const req = makeRequest({ rideId: "ride-1", seatsBooked: 2 });
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.id).toBe("booking-123");
        expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: "ride-1", seatsAvailable: { gte: 2 } }),
            data: { seatsAvailable: { decrement: 2 } },
        }));
    });

    // 2. Idempotency Replay
    it("returns 200 and existing booking on idempotency replay", async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            booking: { id: "booking-old", status: "CONFIRMED" },
        });

        const req = makeRequest({ rideId: "ride-1", seatsBooked: 1 });
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.id).toBe("booking-old");
        expect(mockPrisma.ride.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.ride.updateMany).not.toHaveBeenCalled();
    });

    // 3. Self Booking Guard
    it("returns 409 and blocks self-booking without mutating seats or booking rows", async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
            id: "ride-1",
            driverUserId: "rider_test1",
        });

        const req = makeRequest({ rideId: "ride-1", seatsBooked: 1 });
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.code).toBe("SELF_BOOKING_NOT_ALLOWED");
        expect(json.message).toBe("You can’t book your own ride.");
        expect(mockPrisma.ride.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.booking.create).not.toHaveBeenCalled();
        expect(mockPrisma.idempotencyKey.create).not.toHaveBeenCalled();
        expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
    });

    // 4. Validation Errors
    it("returns 400 for invalid seatsBooked", async () => {
        const req = makeRequest({ rideId: "ride-1", seatsBooked: 9 });
        const res = await POST(req as never);
        expect(res.status).toBe(400);
    });

    // 5. Capacity Failure (UpdateMany returns 0)
    it("returns 409 when seats are unavailable (race condition checked via count=0)", async () => {
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 0 });
        // Mock finding the ride to determine WHY it failed
        mockPrisma.ride.findUnique.mockResolvedValue({
            id: "ride-1",
            status: "ACTIVE",
            latestDepartAt: new Date(Date.now() + 100000),
            seatsAvailable: 0, // Not enough
        });

        const req = makeRequest({ rideId: "ride-1", seatsBooked: 1 });
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.message).toBe("Not enough seats available.");
    });

    // 6. Stale Ride (Status not ACTIVE)
    it("returns 409 when ride is not active", async () => {
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.ride.findUnique.mockResolvedValue({
            id: "ride-1",
            status: "COMPLETED", // Not ACTIVE
        });

        const req = makeRequest({ rideId: "ride-1", seatsBooked: 1 });
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.message).toBe("Ride is not active.");
    });

    // 7. Double Booking (Unique Constraint Violation)
    it("returns 409 when rider already has a confirmed booking", async () => {
        mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
        // Simulate unique constraint violation
        const error = new Error("Unique constraint failed");
        (error as any).code = "P2002";
        mockPrisma.booking.create.mockRejectedValue(error);

        const req = makeRequest({ rideId: "ride-1", seatsBooked: 1 });
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.message).toMatch(/already have a confirmed booking/);
    });
});
