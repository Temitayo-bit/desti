import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────────────
// vi.hoisted() ensures these are available when vi.mock factories execute (hoisted)
const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => ({
    mockRequireStetsonAuth: vi.fn(),
    mockPrisma: {
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
    },
}));

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

    // 1) Successful create → 201
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
            driverUserId: "user_test123",
            idempotencyKey: "test-key-123",
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
});
