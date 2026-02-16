import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        booking: {
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
    BookingStatus: {
        CONFIRMED: "CONFIRMED",
        CANCELLED: "CANCELLED",
    },
}));

import { GET } from "@/app/api/bookings/mine/route";

function successAuth() {
    return {
        user: {
            clerkUserId: "rider_test_1",
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

function makeRequest(query = ""): Request {
    return new Request(`http://localhost:3000/api/bookings/mine${query}`, {
        method: "GET",
    });
}

function fakeBooking(overrides: Record<string, unknown> = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        rideId: "ride-123",
        riderUserId: "rider_test_1",
        seatsBooked: 2,
        status: "CONFIRMED",
        createdAt: new Date("2030-01-02T10:00:00.000Z"),
        ride: {
            id: "ride-123",
            originText: "Stetson University",
            destinationText: "Airport",
            earliestDepartAt: new Date("2030-01-03T09:00:00.000Z"),
            latestDepartAt: new Date("2030-01-03T10:00:00.000Z"),
            preferredDepartAt: new Date("2030-01-03T09:30:00.000Z"),
            distanceCategory: "MEDIUM",
            priceCents: 1200,
            seatsTotal: 4,
            seatsAvailable: 2,
            status: "ACTIVE",
        },
        ...overrides,
    };
}

function getAndClauses(call: unknown): Array<Record<string, unknown>> {
    const args = call as { where: { AND: Array<Record<string, unknown>> } };
    return args.where.AND;
}

describe("GET /api/bookings/mine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.booking.findMany.mockResolvedValue([]);
    });

    it("returns CONFIRMED bookings by default", async () => {
        const res = await GET(makeRequest() as never);
        expect(res.status).toBe(200);

        const findManyArg = mockPrisma.booking.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);
        expect(andClauses).toEqual(
            expect.arrayContaining([
                { riderUserId: "rider_test_1" },
                { status: "CONFIRMED" },
            ])
        );
    });

    it("supports status=CANCELLED", async () => {
        await GET(makeRequest("?status=CANCELLED") as never);

        const findManyArg = mockPrisma.booking.findMany.mock.calls[0][0];
        const andClauses = getAndClauses(findManyArg);
        expect(andClauses).toEqual(
            expect.arrayContaining([
                { riderUserId: "rider_test_1" },
                { status: "CANCELLED" },
            ])
        );
    });

    it("returns 400 for invalid cursor", async () => {
        const res = await GET(makeRequest("?cursor=bad_cursor") as never);
        expect(res.status).toBe(400);
        expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid limit and status", async () => {
        const badLimit = await GET(makeRequest("?limit=0") as never);
        expect(badLimit.status).toBe(400);

        const badStatus = await GET(makeRequest("?status=PENDING") as never);
        expect(badStatus.status).toBe(400);
    });

    it("paginates deterministically without duplicates", async () => {
        const t2 = new Date("2030-01-02T10:00:00.000Z");
        const t1 = new Date("2030-01-01T10:00:00.000Z");

        const b1 = fakeBooking({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            createdAt: t2,
        });
        const b2 = fakeBooking({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            createdAt: t2,
        });
        const b3 = fakeBooking({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            createdAt: t1,
        });

        mockPrisma.booking.findMany
            .mockResolvedValueOnce([b1, b2, b3]) // limit=2 => +1 sentinel
            .mockResolvedValueOnce([b3]);

        const page1Res = await GET(makeRequest("?limit=2") as never);
        const page1 = (await page1Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page1.items.map((item) => item.id)).toEqual([b1.id, b2.id]);
        expect(page1.nextCursor).not.toBeNull();

        const page2Res = await GET(
            makeRequest(`?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`) as never
        );
        const page2 = (await page2Res.json()) as {
            items: Array<{ id: string }>;
            nextCursor: string | null;
        };

        expect(page2.items.map((item) => item.id)).toEqual([b3.id]);
        expect(page2.nextCursor).toBeNull();

        const combinedIds = [...page1.items, ...page2.items].map((item) => item.id);
        expect(new Set(combinedIds).size).toBe(combinedIds.length);

        const secondCallArg = mockPrisma.booking.findMany.mock.calls[1][0];
        const secondAndClauses = getAndClauses(secondCallArg);
        expect(secondAndClauses).toEqual(
            expect.arrayContaining([
                {
                    OR: [
                        { createdAt: { lt: t2 } },
                        { createdAt: t2, id: { lt: b2.id } },
                    ],
                },
            ])
        );
    });

    it("includes minimal ride summary fields", async () => {
        const booking = fakeBooking();
        mockPrisma.booking.findMany.mockResolvedValue([booking]);

        const res = await GET(makeRequest() as never);
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            items: Array<Record<string, unknown>>;
        };
        const first = body.items[0];

        expect(first).toEqual(
            expect.objectContaining({
                id: booking.id,
                rideId: booking.rideId,
                riderUserId: booking.riderUserId,
                seatsBooked: booking.seatsBooked,
                status: booking.status,
                createdAt: booking.createdAt.toISOString(),
                ride: expect.objectContaining({
                    id: booking.ride.id,
                    originText: booking.ride.originText,
                    destinationText: booking.ride.destinationText,
                    earliestDepartAt: booking.ride.earliestDepartAt.toISOString(),
                    latestDepartAt: booking.ride.latestDepartAt.toISOString(),
                    preferredDepartAt: booking.ride.preferredDepartAt.toISOString(),
                    distanceCategory: booking.ride.distanceCategory,
                    priceCents: booking.ride.priceCents,
                    seatsTotal: booking.ride.seatsTotal,
                    seatsAvailable: booking.ride.seatsAvailable,
                    status: booking.ride.status,
                }),
            })
        );
    });
});
