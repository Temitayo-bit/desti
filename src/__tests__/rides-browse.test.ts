import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        ride: {
            findMany: vi.fn(),
        },
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

vi.mock("@/generated/prisma/client", () => ({
    DistanceCategory: {
        SHORT: "SHORT",
        MEDIUM: "MEDIUM",
        LONG: "LONG",
    },
}));

import { GET } from "@/app/api/rides/route";

function successAuth() {
    return {
        user: {
            clerkUserId: "user_test123",
            primaryStetsonEmail: "test@stetson.edu",
        },
    };
}

function makeRequest(query = ""): Request {
    return new Request(`http://localhost:3000/api/rides${query}`, {
        method: "GET",
    });
}

function fakeRide(overrides: Record<string, unknown> = {}) {
    return {
        id: "11111111-1111-4111-8111-111111111111",
        driverUserId: "driver_1",
        originText: "Stetson",
        destinationText: "Airport",
        earliestDepartAt: new Date("2030-01-01T10:00:00.000Z"),
        latestDepartAt: new Date("2030-01-01T11:00:00.000Z"),
        distanceCategory: "MEDIUM",
        priceCents: 500,
        seatsTotal: 4,
        seatsAvailable: 2,
        pickupInstructions: null,
        dropoffInstructions: null,
        preferredDepartAt: null,
        status: "ACTIVE",
        createdAt: new Date("2030-01-01T09:00:00.000Z"),
        updatedAt: new Date("2030-01-01T09:00:00.000Z"),
        ...overrides,
    };
}

function getAndClauses(call: unknown): Array<Record<string, unknown>> {
    const args = call as { where: { AND: Array<Record<string, unknown>> } };
    return args.where.AND;
}

describe("GET /api/rides", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.ride.findMany.mockResolvedValue([]);
    });

    it("applies ACTIVE + not stale filters by default", async () => {
        const res = await GET(makeRequest() as never);
        expect(res.status).toBe(200);

        const findManyArg = mockPrisma.ride.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);

        expect(andClauses).toEqual(
            expect.arrayContaining([
                { status: "ACTIVE" },
                { latestDepartAt: { gt: expect.any(Date) } },
                { earliestDepartAt: { gte: expect.any(Date) } },
                { seatsAvailable: { gte: 1 } },
            ])
        );
    });

    it("excludes full rides by default and honors includeFull=true", async () => {
        await GET(makeRequest() as never);
        await GET(makeRequest("?includeFull=true") as never);

        const firstCall = mockPrisma.ride.findMany.mock.calls[0][0];
        const secondCall = mockPrisma.ride.findMany.mock.calls[1][0];

        expect(getAndClauses(firstCall)).toEqual(
            expect.arrayContaining([{ seatsAvailable: { gte: 1 } }])
        );
        expect(
            getAndClauses(secondCall).some((clause) => "seatsAvailable" in clause)
        ).toBe(false);
    });

    it("applies distanceCategory and seatsMin filters", async () => {
        await GET(
            makeRequest("?distanceCategory=SHORT&seatsMin=3&latestBefore=2030-01-03T00:00:00.000Z") as never
        );

        const findManyArg = mockPrisma.ride.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);

        expect(andClauses).toEqual(
            expect.arrayContaining([
                { distanceCategory: "SHORT" },
                { seatsAvailable: { gte: 3 } },
                { latestDepartAt: { lte: new Date("2030-01-03T00:00:00.000Z") } },
            ])
        );
    });

    it("returns 400 on invalid cursor", async () => {
        const res = await GET(makeRequest("?cursor=not-valid-base64") as never);
        expect(res.status).toBe(400);
        expect(mockPrisma.ride.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 on invalid enum/date/limit", async () => {
        const badLimit = await GET(makeRequest("?limit=0") as never);
        expect(badLimit.status).toBe(400);

        const badEnum = await GET(makeRequest("?distanceCategory=FAR") as never);
        expect(badEnum.status).toBe(400);

        const badDate = await GET(makeRequest("?earliestAfter=notadate") as never);
        expect(badDate.status).toBe(400);
    });

    it("paginates deterministically without duplicates", async () => {
        const t1 = new Date("2030-01-01T10:00:00.000Z");
        const t2 = new Date("2030-01-01T10:00:00.000Z");
        const t3 = new Date("2030-01-01T11:00:00.000Z");

        const ride1 = fakeRide({
            id: "11111111-1111-4111-8111-111111111111",
            earliestDepartAt: t1,
        });
        const ride2 = fakeRide({
            id: "22222222-2222-4222-8222-222222222222",
            earliestDepartAt: t2,
        });
        const ride3 = fakeRide({
            id: "33333333-3333-4333-8333-333333333333",
            earliestDepartAt: t3,
        });

        mockPrisma.ride.findMany
            .mockResolvedValueOnce([ride1, ride2, ride3]) // limit=2 => +1 sentinel
            .mockResolvedValueOnce([ride3]);

        const page1Res = await GET(makeRequest("?limit=2") as never);
        const page1 = (await page1Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page1.items.map((r) => r.id)).toEqual([ride1.id, ride2.id]);
        expect(page1.nextCursor).not.toBeNull();

        const page2Res = await GET(
            makeRequest(`?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`) as never
        );
        const page2 = (await page2Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page2.items.map((r) => r.id)).toEqual([ride3.id]);
        expect(page2.nextCursor).toBeNull();

        const combinedIds = [...page1.items, ...page2.items].map((r) => r.id);
        expect(new Set(combinedIds).size).toBe(combinedIds.length);

        const secondCallArg = mockPrisma.ride.findMany.mock.calls[1][0];
        const secondAndClauses = getAndClauses(secondCallArg);
        expect(secondAndClauses).toEqual(
            expect.arrayContaining([
                {
                    OR: [
                        { earliestDepartAt: { gt: t2 } },
                        { earliestDepartAt: t2, id: { gt: ride2.id } },
                    ],
                },
            ])
        );
    });
});
