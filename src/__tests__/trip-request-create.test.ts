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
        tripRequest: {
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
import { POST } from "@/app/api/trip-requests/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a valid trip request creation request body */
function validBody(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    const earliest = new Date(now.getTime() + 60 * 60 * 1000); // +1h
    const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000); // +3h

    return {
        originText: "Stetson University",
        destinationText: "Daytona Beach",
        earliestDesiredAt: earliest.toISOString(),
        latestDesiredAt: latest.toISOString(),
        distanceCategory: "MEDIUM",
        seatsNeeded: 2,
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
        "Idempotency-Key": "test-key-456",
        ...headers,
    };

    return new Request("http://localhost:3000/api/trip-requests", {
        method: "POST",
        headers: allHeaders,
        body: JSON.stringify(body),
    });
}

/** Default successful auth result */
function successAuth() {
    return {
        user: {
            clerkUserId: "user_rider789",
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

/** Fake trip request returned from Prisma create */
function fakeTripRequest(overrides: Record<string, unknown> = {}) {
    const body = validBody();
    return {
        id: "trip-req-uuid-001",
        riderUserId: "user_rider789",
        originText: body.originText,
        destinationText: body.destinationText,
        earliestDesiredAt: new Date(body.earliestDesiredAt),
        latestDesiredAt: new Date(body.latestDesiredAt),
        distanceCategory: "MEDIUM",
        seatsNeeded: 2,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/trip-requests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    });

    // 1) Successful create → 201 (trip request + idempotency key created atomically via $transaction)
    it("returns 201 with created trip request on successful create", async () => {
        const tripReq = fakeTripRequest();
        mockPrisma.tripRequest.create.mockResolvedValue(tripReq);
        mockPrisma.idempotencyKey.create.mockResolvedValue({});

        const req = makeRequest(validBody());
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.id).toBe("trip-req-uuid-001");
        expect(json.riderUserId).toBe("user_rider789");
        expect(json.seatsNeeded).toBe(2);
        expect(json.status).toBe("ACTIVE");
        // Verify $transaction was used for atomicity
        expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    });

    // 2) Missing Idempotency-Key → 400
    it("returns 400 when Idempotency-Key header is missing", async () => {
        const reqNoKey = new Request("http://localhost:3000/api/trip-requests", {
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
    it("returns 400 when earliestDesiredAt is after latestDesiredAt", async () => {
        const now = new Date();
        const body = validBody({
            earliestDesiredAt: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
            latestDesiredAt: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("latestDesiredAt");
    });

    // 4) Desired window > 48h → 400
    it("returns 400 when desired window exceeds 48 hours", async () => {
        const now = new Date();
        const body = validBody({
            earliestDesiredAt: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
            latestDesiredAt: new Date(now.getTime() + 50 * 60 * 60 * 1000).toISOString(), // 49h gap
        });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const messages = json.details.map((d: { message: string }) => d.message);
        expect(messages.some((m: string) => m.includes("48 hours"))).toBe(true);
    });

    // 5) seatsNeeded outside 1..8 → 400
    it("returns 400 when seatsNeeded is outside 1-8 range", async () => {
        const body = validBody({ seatsNeeded: 10 });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("seatsNeeded");
    });

    // 6) Invalid distanceCategory → 400
    it("returns 400 when distanceCategory is invalid", async () => {
        const body = validBody({ distanceCategory: "VERY_FAR" });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("distanceCategory");
    });

    // 7) Idempotency replay → 200 with same trip request id
    it("returns 200 with existing trip request on idempotency replay", async () => {
        const existingTripReq = fakeTripRequest();
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            id: "idem-uuid-002",
            userId: "user_rider789",
            idempotencyKey: "test-key-456",
            entityType: "TRIP_REQUEST",
            tripRequestId: existingTripReq.id,
            tripRequest: existingTripReq,
        });

        const req = makeRequest(validBody());
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.id).toBe("trip-req-uuid-001");
        // Ensure no new trip request was created
        expect(mockPrisma.tripRequest.create).not.toHaveBeenCalled();
    });

    // 8) Auth failure → returns error response from requireStetsonAuth
    it("returns 401 when user is not authenticated", async () => {
        mockRequireStetsonAuth.mockResolvedValue({
            error: new Response(
                JSON.stringify({ error: "Unauthorized", message: "Not authenticated" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            ),
        });

        const req = makeRequest(validBody());
        const res = await POST(req as never);

        expect(res.status).toBe(401);
    });

    // 9) Body is not an object (array) → 400
    it("returns 400 when request body is an array instead of object", async () => {
        const req = new Request("http://localhost:3000/api/trip-requests", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "test-key-456",
            },
            body: JSON.stringify([1, 2, 3]),
        });

        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.message).toContain("JSON object");
    });

    // 10) Missing originText → 400
    it("returns 400 when originText is missing", async () => {
        const body = validBody();
        delete (body as Record<string, unknown>).originText;

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("originText");
    });

    // 11) Missing destinationText → 400
    it("returns 400 when destinationText is missing", async () => {
        const body = validBody();
        delete (body as Record<string, unknown>).destinationText;

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("destinationText");
    });

    // 12) originText too short (< 3 chars) → 400
    it("returns 400 when originText is shorter than 3 characters", async () => {
        const body = validBody({ originText: "AB" });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("originText");
    });

    // 13) earliestDesiredAt in the past → 400
    it("returns 400 when earliestDesiredAt is in the past", async () => {
        const past = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const body = validBody({
            earliestDesiredAt: past.toISOString(),
            latestDesiredAt: new Date(past.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("earliestDesiredAt");
    });

    // 14) seatsNeeded is a float → 400
    it("returns 400 when seatsNeeded is not an integer", async () => {
        const body = validBody({ seatsNeeded: 2.5 });

        const req = makeRequest(body);
        const res = await POST(req as never);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Validation Error");
        const fields = json.details.map((d: { field: string }) => d.field);
        expect(fields).toContain("seatsNeeded");
    });

    // 15) Stale idempotency key (tripRequest is null) → deletes key and re-creates
    it("deletes stale idempotency key and re-creates when tripRequest is null", async () => {
        // First call returns an idempotency key with null tripRequest (corruption)
        mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({
            id: "stale-idem-uuid",
            userId: "user_rider789",
            idempotencyKey: "test-key-456",
            entityType: "TRIP_REQUEST",
            tripRequestId: null,
            tripRequest: null,
        });

        // Add deleteMany mock for the stale key cleanup (no-op safe)
        (mockPrisma.idempotencyKey as Record<string, ReturnType<typeof vi.fn>>).deleteMany =
            vi.fn().mockResolvedValue({ count: 1 });

        const tripReq = fakeTripRequest();
        mockPrisma.tripRequest.create.mockResolvedValue(tripReq);
        mockPrisma.idempotencyKey.create.mockResolvedValue({});

        const req = makeRequest(validBody());
        const res = await POST(req as never);
        const json = await res.json();

        // Should have deleted the stale key via deleteMany
        expect(
            (mockPrisma.idempotencyKey as Record<string, ReturnType<typeof vi.fn>>).deleteMany
        ).toHaveBeenCalledWith({ where: { id: "stale-idem-uuid" } });
        // Should have re-created successfully
        expect(res.status).toBe(201);
        expect(json.id).toBe("trip-req-uuid-001");
    });

    // 16) Successful create with route context and timing fields → 201
    it("returns 201 with pickupInstructions, dropoffInstructions, and preferredDepartAt", async () => {
        const body = validBody();
        const preferred = new Date(
            (new Date(body.earliestDesiredAt).getTime() + new Date(body.latestDesiredAt).getTime()) / 2
        ).toISOString();

        const tripReq = fakeTripRequest({
            pickupInstructions: "Meet at the north entrance",
            dropoffInstructions: "Drop off at terminal B",
            preferredDepartAt: new Date(preferred),
        });
        mockPrisma.tripRequest.create.mockResolvedValue(tripReq);
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

    // 17) Whitespace-only pickupInstructions → 400
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

    // 18) dropoffInstructions > 500 chars → 400
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

    // 19) preferredDepartAt before earliestDesiredAt → 400
    it("returns 400 when preferredDepartAt is before earliestDesiredAt", async () => {
        const now = new Date();
        const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000);
        const preferred = new Date(earliest.getTime() - 30 * 60 * 1000); // 30 min before earliest

        const body = validBody({
            earliestDesiredAt: earliest.toISOString(),
            latestDesiredAt: latest.toISOString(),
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

    // 20) preferredDepartAt after latestDesiredAt → 400
    it("returns 400 when preferredDepartAt is after latestDesiredAt", async () => {
        const now = new Date();
        const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const latest = new Date(earliest.getTime() + 2 * 60 * 60 * 1000);
        const preferred = new Date(latest.getTime() + 30 * 60 * 1000); // 30 min after latest

        const body = validBody({
            earliestDesiredAt: earliest.toISOString(),
            latestDesiredAt: latest.toISOString(),
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
