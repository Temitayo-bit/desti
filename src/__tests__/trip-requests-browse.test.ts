import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        tripRequest: {
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

import { GET } from "@/app/api/trip-requests/route";

function successAuth() {
    return {
        user: {
            clerkUserId: "user_test123",
            primaryStetsonEmail: "test@stetson.edu",
        },
    };
}

function makeRequest(query = ""): Request {
    return new Request(`http://localhost:3000/api/trip-requests${query}`, {
        method: "GET",
    });
}

function fakeTripRequest(overrides: Record<string, unknown> = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        riderUserId: "rider_1",
        originText: "Stetson",
        destinationText: "Airport",
        earliestDesiredAt: new Date("2030-01-01T10:00:00.000Z"),
        latestDesiredAt: new Date("2030-01-01T11:00:00.000Z"),
        distanceCategory: "MEDIUM",
        seatsNeeded: 2,
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

describe("GET /api/trip-requests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.tripRequest.findMany.mockResolvedValue([]);
    });

    it("applies ACTIVE + not stale filters by default", async () => {
        const res = await GET(makeRequest() as never);
        expect(res.status).toBe(200);

        const findManyArg = mockPrisma.tripRequest.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);

        expect(andClauses).toEqual(
            expect.arrayContaining([
                { status: "ACTIVE" },
                { latestDesiredAt: { gt: expect.any(Date) } },
            ])
        );
    });

    it("applies distanceCategory and seatsMax filters", async () => {
        await GET(
            makeRequest("?distanceCategory=LONG&seatsMax=2&earliestAfter=2030-01-01T00:00:00.000Z&latestBefore=2030-01-03T00:00:00.000Z") as never
        );

        const findManyArg = mockPrisma.tripRequest.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);

        expect(andClauses).toEqual(
            expect.arrayContaining([
                { distanceCategory: "LONG" },
                { seatsNeeded: { lte: 2 } },
                { earliestDesiredAt: { gte: new Date("2030-01-01T00:00:00.000Z") } },
                { latestDesiredAt: { lte: new Date("2030-01-03T00:00:00.000Z") } },
            ])
        );
    });

    it("returns 400 on invalid cursor", async () => {
        const res = await GET(makeRequest("?cursor=broken_cursor") as never);
        expect(res.status).toBe(400);
        expect(mockPrisma.tripRequest.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 on invalid enum/date/limit", async () => {
        const badLimit = await GET(makeRequest("?limit=999") as never);
        expect(badLimit.status).toBe(400);

        const badEnum = await GET(makeRequest("?distanceCategory=FAR") as never);
        expect(badEnum.status).toBe(400);

        const badDate = await GET(makeRequest("?latestBefore=notadate") as never);
        expect(badDate.status).toBe(400);
    });

    it("paginates deterministically without duplicates", async () => {
        const t1 = new Date("2030-01-01T10:00:00.000Z");
        const t2 = new Date("2030-01-01T10:00:00.000Z");
        const t3 = new Date("2030-01-01T11:00:00.000Z");

        const req1 = fakeTripRequest({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            earliestDesiredAt: t1,
        });
        const req2 = fakeTripRequest({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            earliestDesiredAt: t2,
        });
        const req3 = fakeTripRequest({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            earliestDesiredAt: t3,
        });

        mockPrisma.tripRequest.findMany
            .mockResolvedValueOnce([req1, req2, req3]) // limit=2 => +1 sentinel
            .mockResolvedValueOnce([req3]);

        const page1Res = await GET(makeRequest("?limit=2") as never);
        const page1 = (await page1Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page1.items.map((r) => r.id)).toEqual([req1.id, req2.id]);
        expect(page1.nextCursor).not.toBeNull();

        const page2Res = await GET(
            makeRequest(`?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`) as never
        );
        const page2 = (await page2Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page2.items.map((r) => r.id)).toEqual([req3.id]);
        expect(page2.nextCursor).toBeNull();

        const combinedIds = [...page1.items, ...page2.items].map((r) => r.id);
        expect(new Set(combinedIds).size).toBe(combinedIds.length);

        const secondCallArg = mockPrisma.tripRequest.findMany.mock.calls[1][0];
        const secondAndClauses = getAndClauses(secondCallArg);
        expect(secondAndClauses).toEqual(
            expect.arrayContaining([
                {
                    OR: [
                        { earliestDesiredAt: { gt: t2 } },
                        { earliestDesiredAt: t2, id: { gt: req2.id } },
                    ],
                },
            ])
        );
    });
});
