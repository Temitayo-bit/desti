import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
    mockRequireStetsonAuth,
    mockListUserConversations,
    mockMessageFindFirst,
} = vi.hoisted(() => ({
    mockRequireStetsonAuth: vi.fn(),
    mockListUserConversations: vi.fn(),
    mockMessageFindFirst: vi.fn(),
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
    });

    it("returns conversations with latestMessage preview or null", async () => {
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

        mockListUserConversations.mockResolvedValue([c1, c2]);
        mockMessageFindFirst
            .mockResolvedValueOnce({
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                conversationId: c1.id,
                senderUserId: c1.driverUserId,
                body: "On my way.",
                createdAt: new Date("2030-01-01T10:01:00.000Z"),
            })
            .mockResolvedValueOnce(null);

        const items = await listConversationsController("user_rider_1");

        expect(items).toHaveLength(2);
        expect(items[0]).toEqual(
            expect.objectContaining({
                id: c1.id,
                type: c1.type,
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
                latestMessage: null,
            })
        );
        expect(mockMessageFindFirst).toHaveBeenCalledTimes(2);
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
});
