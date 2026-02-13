import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────────────
// vi.hoisted() ensures these are available when vi.mock factories execute (hoisted)
const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        user: {
            upsert: vi.fn().mockResolvedValue({}),
        },
        idempotencyKey: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        ride: {
            create: vi.fn(),
        },
        // $transaction executes the callback with the mock client itself as `tx`
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

// Mock DistanceCategory enum from generated Prisma client
vi.mock("@/generated/prisma/client", () => ({
    DistanceCategory: {
        SHORT: "SHORT",
        MEDIUM: "MEDIUM",
        LONG: "LONG",
    },
}));

// ── Import handler AFTER mocks are set up ────────────────────────────────────
import { POST } from "@/app/api/rides/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a valid ride creation request body */
function validBody(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    const earliest = new Date(now.getTime() + 60 * 60 * 1000); // +1h
    const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000); // +3h

    return {
        originText: "Stetson University",
        destinationText: "Daytona Beach",
        earliestDepartAt: earliest.toISOString(),
        latestDepartAt: latest.toISOString(),
        distanceCategory: "MEDIUM",
        priceCents: 500,
        seatsTotal: 4,
        ...overrides,
    };
}

/** Create a NextRequest-like object */
function makeRequest(
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
): Request {
    const allHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Idempotency-Key": "test-key-123",
        ...headers,
    };

    return new Request("http://localhost:3000/api/rides", {
        method: "POST",
        headers: allHeaders,
        body: JSON.stringify(body),
    });
}

/** Default successful auth result */
function successAuth() {
    return {
        user: {
            clerkUserId: "user_test123",
            primaryStetsonEmail: "test@stetson.edu",
        },
    };
}

/** Fake ride returned from Prisma create */
function fakeRide(overrides: Record<string, unknown> = {}) {
    const body = validBody();
    return {
        id: "ride-uuid-001",
        driverUserId: "user_test123",
        originText: body.originText,
        destinationText: body.destinationText,
        earliestDepartAt: new Date(body.earliestDepartAt),
        latestDepartAt: new Date(body.latestDepartAt),
        distanceCategory: "MEDIUM",
        priceCents: 500,
        seatsTotal: 4,
        seatsAvailable: 4,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/rides", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    });

    // 1) Successful create → 201 (ride + idempotency key created atomically via $transaction)
    it("returns 201 with created ride on successful create", async () => {
        const ride = fakeRide();
        mockPrisma.ride.create.mockResolvedValue(ride);
        mockPrisma.idempotencyKey.create.mockResolvedValue({});

        const req = makeRequest(validBody());
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.id).toBe("ride-uuid-001");
        expect(json.driverUserId).toBe("user_test123");
        expect(json.seatsAvailable).toBe(4);
        expect(json.status).toBe("ACTIVE");
        // Verify $transaction was used for atomicity
        expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    });

    // 2) Missing Idempotency-Key → 400
    it("returns 400 when Idempotency-Key header is missing", async () => {
        const reqNoKey = new Request("http://localhost:3000/api/rides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validBody()),
        });

        const res = await POST(reqNoKey as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.message).toContain("Idempotency-Key");
    });

    // 3) earliest > latest → 400
    it("returns 400 when earliestDepartAt is after latestDepartAt", async () => {
        const now = new Date();
        const body = validBody({
            earliestDepartAt: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
            latestDepartAt: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("latestDepartAt");
    });

    // 4) Departure window > 48h → 400
    it("returns 400 when departure window exceeds 48 hours", async () => {
        const now = new Date();
        const body = validBody({
            earliestDepartAt: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
            latestDepartAt: new Date(now.getTime() + 50 * 60 * 60 * 1000).toISOString(), // 49h gap
        });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const messages = json.details.map((d: { message: string }) => d.message);
        expect(messages.some((m: string) => m.includes("48 hours"))).toBe(true);
    });

    // 5) seatsTotal outside 1..8 → 400
    it("returns 400 when seatsTotal is outside 1-8 range", async () => {
        const body = validBody({ seatsTotal: 10 });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("seatsTotal");
    });

    // 6) priceCents negative → 400
    it("returns 400 when priceCents is negative", async () => {
        const body = validBody({ priceCents: -100 });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("priceCents");
    });

    // 7) Idempotency replay → 200 with same ride id
    it("returns 200 with existing ride on idempotency replay", async () => {
        const existingRide = fakeRide();
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            id: "idem-uuid-001",
            userId: "user_test123",
            idempotencyKey: "test-key-123",
            entityType: "RIDE",
            rideId: existingRide.id,
            ride: existingRide,
        });

        const req = makeRequest(validBody());
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.id).toBe("ride-uuid-001");
        // Ensure no new ride was created
        expect(mockPrisma.ride.create).not.toHaveBeenCalled();
    });

    // 8) Successful create with route context and timing fields → 201
    it("returns 201 with pickupInstructions, dropoffInstructions, and preferredDepartAt", async () => {
        const body = validBody();
        const preferred = new Date(
            (new Date(body.earliestDepartAt).getTime() + new Date(body.latestDepartAt).getTime()) / 2
        ).toISOString();

        const ride = fakeRide({
            pickupInstructions: "Meet at the north entrance",
            dropoffInstructions: "Drop off at terminal B",
            preferredDepartAt: new Date(preferred),
        });
        mockPrisma.ride.create.mockResolvedValue(ride);
        mockPrisma.idempotencyKey.create.mockResolvedValue({});

        const req = makeRequest({
            ...body,
            pickupInstructions: "  Meet at the north entrance  ",
            dropoffInstructions: "Drop off at terminal B",
            preferredDepartAt: preferred,
        });
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.pickupInstructions).toBe("Meet at the north entrance");
        expect(json.dropoffInstructions).toBe("Drop off at terminal B");
    });

    // 9) Whitespace-only pickupInstructions → 400
    it("returns 400 when pickupInstructions is only whitespace", async () => {
        const body = validBody({ pickupInstructions: "   " });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("pickupInstructions");
    });

    // 10) dropoffInstructions > 500 chars → 400
    it("returns 400 when dropoffInstructions exceeds 500 characters", async () => {
        const body = validBody({ dropoffInstructions: "A".repeat(501) });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("dropoffInstructions");
    });

    // 11) preferredDepartAt before earliestDepartAt → 400
    it("returns 400 when preferredDepartAt is before earliestDepartAt", async () => {
        const now = new Date();
        const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000);
        const preferred = new Date(earliest.getTime() - 30 * 60 * 1000); // 30 min before earliest

        const body = validBody({
            earliestDepartAt: earliest.toISOString(),
            latestDepartAt: latest.toISOString(),
            preferredDepartAt: preferred.toISOString(),
        });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("preferredDepartAt");
    });

    // 12) preferredDepartAt after latestDepartAt → 400
    it("returns 400 when preferredDepartAt is after latestDepartAt", async () => {
        const now = new Date();
        const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000);
        const preferred = new Date(latest.getTime() + 30 * 60 * 1000); // 30 min after latest

        const body = validBody({
            earliestDepartAt: earliest.toISOString(),
            latestDepartAt: latest.toISOString(),
            preferredDepartAt: preferred.toISOString(),
        });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("preferredDepartAt");
    });
});
