import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
    mockRequireStetsonAuth,
    mockListUserConversations,
    mockMessageFindFirst,
    mockUserFindMany,
    mockBookingFindMany,
    mockOfferFindMany,
} = vi.hoisted(() => ({
    mockRequireStetsonAuth: vi.fn(),
    mockListUserConversations: vi.fn(),
    mockMessageFindFirst: vi.fn(),
    mockUserFindMany: vi.fn(),
    mockBookingFindMany: vi.fn(),
    mockOfferFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/services/conversationService", async () => {
    const actual = await vi.importActual<typeof import("@/services/conversationService")>(
        "@/services/conversationService"
    );
    return {
        ...actual,
        listUserConversations: (...args: unknown[]) => mockListUserConversations(...args),
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: {
        message: {
            findFirst: (...args: unknown[]) => mockMessageFindFirst(...args),
        },
        user: {
            findMany: (...args: unknown[]) => mockUserFindMany(...args),
        },
        booking: {
            findMany: (...args: unknown[]) => mockBookingFindMany(...args),
        },
        offer: {
            findMany: (...args: unknown[]) => mockOfferFindMany(...args),
        },
    },
}));

import { listConversationsController } from "@/controllers/conversationController";
import { handleGetConversations } from "@/routes/conversations";

function authSuccess(userId = "user_rider_1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

describe("Conversations List", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(authSuccess());
        mockListUserConversations.mockResolvedValue([]);
        mockUserFindMany.mockResolvedValue([]);
        mockBookingFindMany.mockResolvedValue([]);
        mockOfferFindMany.mockResolvedValue([]);
    });

    it("returns conversations with latestMessage preview and counterpart display names", async () => {
        const c1 = {
            id: "11111111-1111-4111-8111-111111111111",
            type: "BOOKING",
            bookingId: "booking-1",
            offerId: null,
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            updatedAt: new Date("2030-01-01T10:00:00.000Z"),
        };
        const c2 = {
            id: "22222222-2222-4222-8222-222222222222",
            type: "OFFER",
            bookingId: null,
            offerId: "offer-1",
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_2",
            updatedAt: new Date("2030-01-01T09:00:00.000Z"),
        };
        const c3 = {
            id: "33333333-3333-4333-8333-333333333333",
            type: "OFFER",
            bookingId: null,
            offerId: "offer-2",
            riderUserId: "user_driver_3",
            driverUserId: "user_rider_1",
            updatedAt: new Date("2030-01-01T08:00:00.000Z"),
        };

        mockListUserConversations.mockResolvedValue([c1, c2, c3]);
        mockUserFindMany.mockResolvedValue([
            {
                clerkUserId: "user_driver_1",
                name: " Sarah Driver ",
                email: "sarah@stetson.edu",
            },
            {
                clerkUserId: "user_driver_2",
                name: null,
                email: "mike.driver@stetson.edu",
            },
        ]);
        mockMessageFindFirst
            .mockResolvedValueOnce({
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                conversationId: c1.id,
                senderUserId: c1.driverUserId,
                body: "On my way.",
                createdAt: new Date("2030-01-01T10:01:00.000Z"),
            })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        mockBookingFindMany.mockResolvedValue([
            {
                id: "booking-1",
                ride: {
                    destinationText: "Orlando Airport",
                    earliestDepartAt: new Date("2030-01-05T14:00:00.000Z"),
                },
                tripRequest: null,
            },
        ]);
        mockOfferFindMany.mockResolvedValue([
            {
                id: "offer-1",
                tripRequest: {
                    destinationText: "Tampa",
                    earliestDesiredAt: new Date("2030-01-06T15:00:00.000Z"),
                },
            },
            {
                id: "offer-2",
                tripRequest: {
                    destinationText: "Jacksonville",
                    earliestDesiredAt: new Date("2030-01-07T16:00:00.000Z"),
                },
            },
        ]);

        const items = await listConversationsController("user_rider_1");

        expect(items).toHaveLength(3);
        expect(items[0]).toEqual(
            expect.objectContaining({
                id: c1.id,
                type: c1.type,
                counterpartUserId: c1.driverUserId,
                counterpartDisplayName: "Sarah Driver",
                tripDestinationText: "Orlando Airport",
                tripStartsAt: new Date("2030-01-05T14:00:00.000Z"),
                latestMessage: expect.objectContaining({
                    conversationId: c1.id,
                    body: "On my way.",
                }),
            })
        );
        expect(items[1]).toEqual(
            expect.objectContaining({
                id: c2.id,
                type: c2.type,
                counterpartUserId: c2.driverUserId,
                counterpartDisplayName: "mike.driver",
                tripDestinationText: "Tampa",
                tripStartsAt: new Date("2030-01-06T15:00:00.000Z"),
                latestMessage: null,
            })
        );
        expect(items[2]).toEqual(
            expect.objectContaining({
                id: c3.id,
                type: c3.type,
                counterpartUserId: c3.riderUserId,
                counterpartDisplayName: c3.riderUserId,
                tripDestinationText: "Jacksonville",
                tripStartsAt: new Date("2030-01-07T16:00:00.000Z"),
                latestMessage: null,
            })
        );
        expect(mockMessageFindFirst).toHaveBeenCalledTimes(3);
        expect(mockUserFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    clerkUserId: {
                        in: expect.arrayContaining([
                            c1.driverUserId,
                            c2.driverUserId,
                            c3.riderUserId,
                        ]),
                    },
                },
            })
        );
    });

    it("passes through auth errors on GET /api/conversations", async () => {
        const authError = new Response(
            JSON.stringify({ error: "Unauthorized", message: "Authentication required." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
        mockRequireStetsonAuth.mockResolvedValue({ error: authError });

        const res = await handleGetConversations(
            new NextRequest("http://localhost:3000/api/conversations")
        );

        expect(res.status).toBe(401);
        expect(mockListUserConversations).not.toHaveBeenCalled();
    });

    it("returns one canonical conversation per counterpart user", async () => {
        const newerEmpty = {
            id: "11111111-1111-4111-8111-111111111111",
            type: "BOOKING",
            bookingId: "booking-new",
            offerId: null,
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            updatedAt: new Date("2030-01-01T10:10:00.000Z"),
        };
        const olderWithMessage = {
            id: "22222222-2222-4222-8222-222222222222",
            type: "OFFER",
            bookingId: null,
            offerId: "offer-old",
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            updatedAt: new Date("2030-01-01T10:00:00.000Z"),
        };

        mockListUserConversations.mockResolvedValue([newerEmpty, olderWithMessage]);
        mockUserFindMany.mockResolvedValue([
            {
                clerkUserId: "user_driver_1",
                name: "John Doe",
                email: "john@stetson.edu",
            },
        ]);
        mockMessageFindFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: "msg-1",
                conversationId: olderWithMessage.id,
                senderUserId: "user_driver_1",
                body: "Existing thread message",
                createdAt: new Date("2030-01-01T10:05:00.000Z"),
            });

        const items = await listConversationsController("user_rider_1");

        expect(items).toHaveLength(1);
        expect(items[0].id).toBe(olderWithMessage.id);
        expect(items[0].counterpartDisplayName).toBe("John Doe");
        expect(items[0].latestMessage?.body).toBe("Existing thread message");
    });
});
