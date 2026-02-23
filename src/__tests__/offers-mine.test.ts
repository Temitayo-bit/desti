import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        offer: {
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
    OfferStatus: {
        PENDING: "PENDING",
        ACCEPTED: "ACCEPTED",
        CANCELLED: "CANCELLED",
    },
}));

import { GET } from "@/app/api/offers/mine/route";

function successAuth() {
    return {
        user: {
            clerkUserId: "user_test_1",
            primaryStetsonEmail: "test@stetson.edu",
        },
    };
}

function makeRequest(query = ""): Request {
    return new Request(`http://localhost:3000/api/offers/mine${query}`, {
        method: "GET",
    });
}

function fakeOffer(overrides: Record<string, unknown> = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tripRequestId: "11111111-1111-4111-8111-111111111111",
        driverUserId: "driver_1",
        riderUserId: "rider_1",
        seatsOffered: 1,
        priceCents: 1500,
        message: null,
        status: "PENDING",
        createdAt: new Date("2030-01-02T10:00:00.000Z"),
        tripRequest: {
            id: "11111111-1111-4111-8111-111111111111",
            originText: "Stetson University",
            destinationText: "Orlando Airport",
            earliestDesiredAt: new Date("2030-01-03T09:00:00.000Z"),
            latestDesiredAt: new Date("2030-01-03T10:00:00.000Z"),
            preferredDepartAt: null,
            distanceCategory: "MEDIUM",
            seatsNeeded: 1,
            status: "ACTIVE",
        },
        ...overrides,
    };
}

function getAndClauses(call: unknown): Array<Record<string, unknown>> {
    const args = call as { where: { AND: Array<Record<string, unknown>> } };
    return args.where.AND;
}

describe("GET /api/offers/mine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.offer.findMany.mockResolvedValue([]);
    });

    it("returns rider offers when role=rider", async () => {
        const res = await GET(makeRequest("?role=rider") as never);
        expect(res.status).toBe(200);

        const findManyArg = mockPrisma.offer.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);
        expect(andClauses).toEqual(
            expect.arrayContaining([{ riderUserId: "user_test_1" }])
        );
    });

    it("returns driver offers when role=driver", async () => {
        const res = await GET(makeRequest("?role=driver") as never);
        expect(res.status).toBe(200);

        const findManyArg = mockPrisma.offer.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);
        expect(andClauses).toEqual(
            expect.arrayContaining([{ driverUserId: "user_test_1" }])
        );
    });

    it("applies status filter when provided", async () => {
        await GET(makeRequest("?role=rider&status=ACCEPTED") as never);

        const findManyArg = mockPrisma.offer.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);
        expect(andClauses).toEqual(
            expect.arrayContaining([
                { riderUserId: "user_test_1" },
                { status: "ACCEPTED" },
            ])
        );
    });

    it("uses requested limit and enforces default paging shape", async () => {
        await GET(makeRequest("?role=driver&limit=2") as never);

        const findManyArg = mockPrisma.offer.findMany.mock.calls[0][0];
        expect(findManyArg.take).toBe(3);
        expect(findManyArg.orderBy).toEqual([
            { createdAt: "desc" },
            { id: "desc" },
        ]);
    });

    it("returns 400 for missing or invalid role", async () => {
        const missingRole = await GET(makeRequest() as never);
        expect(missingRole.status).toBe(400);

        const badRole = await GET(makeRequest("?role=admin") as never);
        expect(badRole.status).toBe(400);

        expect(mockPrisma.offer.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid status, limit, and cursor", async () => {
        const badStatus = await GET(makeRequest("?role=rider&status=OPEN") as never);
        expect(badStatus.status).toBe(400);

        const badLimit = await GET(makeRequest("?role=rider&limit=0") as never);
        expect(badLimit.status).toBe(400);

        const badLimitType = await GET(makeRequest("?role=rider&limit=1.5") as never);
        expect(badLimitType.status).toBe(400);

        const badCursor = await GET(
            makeRequest("?role=rider&cursor=broken_cursor") as never
        );
        expect(badCursor.status).toBe(400);

        expect(mockPrisma.offer.findMany).not.toHaveBeenCalled();
    });

    it("paginates deterministically with no duplicates and correct nextCursor", async () => {
        const t2 = new Date("2030-01-02T10:00:00.000Z");
        const t1 = new Date("2030-01-01T10:00:00.000Z");

        const o1 = fakeOffer({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            createdAt: t2,
        });
        const o2 = fakeOffer({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            createdAt: t2,
        });
        const o3 = fakeOffer({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            createdAt: t1,
        });

        mockPrisma.offer.findMany
            .mockResolvedValueOnce([o1, o2, o3]) // limit=2 => +1 sentinel
            .mockResolvedValueOnce([o3]);

        const page1Res = await GET(makeRequest("?role=rider&limit=2") as never);
        const page1 = (await page1Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page1.items.map((item) => item.id)).toEqual([o1.id, o2.id]);
        expect(page1.nextCursor).not.toBeNull();

        const page2Res = await GET(
            makeRequest(
                `?role=rider&limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`
            ) as never
        );
        const page2 = (await page2Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page2.items.map((item) => item.id)).toEqual([o3.id]);
        expect(page2.nextCursor).toBeNull();

        const combinedIds = [...page1.items, ...page2.items].map((item) => item.id);
        expect(new Set(combinedIds).size).toBe(combinedIds.length);

        const secondCallArg = mockPrisma.offer.findMany.mock.calls[1][0];
        const secondAndClauses = getAndClauses(secondCallArg);
        expect(secondAndClauses).toEqual(
            expect.arrayContaining([
                {
                    OR: [
                        { createdAt: { lt: t2 } },
                        { createdAt: t2, id: { lt: o2.id } },
                    ],
                },
            ])
        );
    });

    it("includes minimal trip request summary fields", async () => {
        const offer = fakeOffer();
        mockPrisma.offer.findMany.mockResolvedValue([offer]);

        const res = await GET(makeRequest("?role=rider") as never);
        expect(res.status).toBe(200);

        const body = (await res.json()) as {
            items: Array<Record<string, unknown>>;
        };
        const first = body.items[0];

        expect(first).toEqual(
            expect.objectContaining({
                id: offer.id,
                tripRequestId: offer.tripRequestId,
                driverUserId: offer.driverUserId,
                riderUserId: offer.riderUserId,
                seatsOffered: offer.seatsOffered,
                priceCents: offer.priceCents,
                message: offer.message,
                status: offer.status,
                createdAt: offer.createdAt.toISOString(),
                tripRequest: expect.objectContaining({
                    id: offer.tripRequest.id,
                    originText: offer.tripRequest.originText,
                    destinationText: offer.tripRequest.destinationText,
                    earliestDesiredAt: offer.tripRequest.earliestDesiredAt.toISOString(),
                    latestDesiredAt: offer.tripRequest.latestDesiredAt.toISOString(),
                    preferredDepartAt: offer.tripRequest.preferredDepartAt,
                    distanceCategory: offer.tripRequest.distanceCategory,
                    seatsNeeded: offer.tripRequest.seatsNeeded,
                    status: offer.tripRequest.status,
                }),
            })
        );
    });
});
