import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    getConversationMessagesController,
    sendConversationMessageController,
} from "@/controllers/messageController";
import { ConversationServiceError } from "@/services/conversationService";

const {
    mockAssertConversationParticipant,
    mockValidateMessageBody,
    mockCountRecentMessages,
    mockCreateMessage,
    mockMessageFindMany,
} = vi.hoisted(() => ({
    mockAssertConversationParticipant: vi.fn(),
    mockValidateMessageBody: vi.fn(),
    mockCountRecentMessages: vi.fn(),
    mockCreateMessage: vi.fn(),
    mockMessageFindMany: vi.fn(),
}));

vi.mock("@/helpers/conversationAuth", () => ({
    assertConversationParticipant: (...args: unknown[]) =>
        mockAssertConversationParticipant(...args),
}));

vi.mock("@/helpers/messageValidation", () => ({
    validateMessageBody: (...args: unknown[]) => mockValidateMessageBody(...args),
}));

vi.mock("@/services/conversationService", async () => {
    const actual = await vi.importActual<typeof import("@/services/conversationService")>(
        "@/services/conversationService"
    );
    return {
        ...actual,
        countRecentMessages: (...args: unknown[]) => mockCountRecentMessages(...args),
        createMessage: (...args: unknown[]) => mockCreateMessage(...args),
    };
});

vi.mock("@/lib/prisma", () => ({
    prisma: {
        message: {
            findMany: (...args: unknown[]) => mockMessageFindMany(...args),
        },
    },
}));

const USER_ID = "user_rider_1";
const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";

function makeMessage(overrides: Record<string, unknown> = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        conversationId: CONVERSATION_ID,
        senderUserId: USER_ID,
        body: "hello",
        createdAt: new Date("2030-01-01T10:00:00.000Z"),
        ...overrides,
    };
}

describe("Conversation Messages Controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAssertConversationParticipant.mockResolvedValue({
            id: CONVERSATION_ID,
        });
        mockCountRecentMessages.mockResolvedValue(0);
    });

    it("GET uses default limit=20 and ASC ordering", async () => {
        mockMessageFindMany.mockResolvedValue([]);

        await getConversationMessagesController(
            USER_ID,
            CONVERSATION_ID,
            new URLSearchParams()
        );

        expect(mockMessageFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 21,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            })
        );
    });

    it("GET returns 400 when limit is invalid", async () => {
        await expect(
            getConversationMessagesController(
                USER_ID,
                CONVERSATION_ID,
                new URLSearchParams("limit=0")
            )
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_LIMIT",
        });
    });

    it("GET paginates with createdAt cursor and no duplicate overlap", async () => {
        const m1 = makeMessage({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            createdAt: new Date("2030-01-01T10:00:00.000Z"),
        });
        const m2 = makeMessage({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            createdAt: new Date("2030-01-01T10:00:00.000Z"),
            body: "second",
        });
        const m3 = makeMessage({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            createdAt: new Date("2030-01-01T10:01:00.000Z"),
            body: "third",
        });

        mockMessageFindMany
            .mockResolvedValueOnce([m1, m2, m3]) // first page limit=2 (+1 sentinel)
            .mockResolvedValueOnce([m3]); // second page

        const page1 = await getConversationMessagesController(
            USER_ID,
            CONVERSATION_ID,
            new URLSearchParams("limit=2")
        );

        expect(page1.items.map((m) => m.id)).toEqual([m1.id, m2.id]);
        expect(page1.nextCursor).not.toBeNull();

        const page2 = await getConversationMessagesController(
            USER_ID,
            CONVERSATION_ID,
            new URLSearchParams(`limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`)
        );

        expect(page2.items.map((m) => m.id)).toEqual([m3.id]);
        expect(page2.nextCursor).toBeNull();

        const ids = [...page1.items, ...page2.items].map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);

        const secondCallArg = mockMessageFindMany.mock.calls[1][0];
        expect(secondCallArg.where.AND).toEqual(
            expect.arrayContaining([
                {
                    OR: [
                        { createdAt: { gt: m2.createdAt } },
                        { createdAt: m2.createdAt, id: { gt: m2.id } },
                    ],
                },
            ])
        );
    });

    it("GET returns 404 for non-participant", async () => {
        mockAssertConversationParticipant.mockRejectedValue(
            new ConversationServiceError(
                "Conversation not found.",
                "CONVERSATION_NOT_FOUND",
                404
            )
        );

        await expect(
            getConversationMessagesController(
                USER_ID,
                CONVERSATION_ID,
                new URLSearchParams()
            )
        ).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    it("POST sends a message successfully", async () => {
        mockValidateMessageBody.mockReturnValue({
            valid: true,
            trimmed: "Hello there",
        });
        mockCreateMessage.mockResolvedValue(
            makeMessage({
                body: "Hello there",
                id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            })
        );

        const result = await sendConversationMessageController(
            USER_ID,
            CONVERSATION_ID,
            { body: "  Hello there  " }
        );

        expect(result.body).toBe("Hello there");
        expect(mockCountRecentMessages).toHaveBeenCalledWith(
            USER_ID,
            CONVERSATION_ID,
            5
        );
        expect(mockCreateMessage).toHaveBeenCalledWith(
            CONVERSATION_ID,
            USER_ID,
            "Hello there"
        );
    });

    it("POST returns 400 for empty/whitespace messages", async () => {
        mockValidateMessageBody.mockReturnValue({
            valid: false,
            error: "Message body must not be empty.",
        });

        await expect(
            sendConversationMessageController(USER_ID, CONVERSATION_ID, { body: "   " })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_MESSAGE",
        });
    });

    it("POST returns 400 when message exceeds 1000 chars", async () => {
        mockValidateMessageBody.mockReturnValue({
            valid: false,
            error: "Message body must not exceed 1000 characters.",
        });

        await expect(
            sendConversationMessageController(USER_ID, CONVERSATION_ID, {
                body: "x".repeat(1001),
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: "INVALID_MESSAGE",
        });
    });

    it("POST enforces rate limit at 20 messages / 5 minutes", async () => {
        mockValidateMessageBody.mockReturnValue({
            valid: true,
            trimmed: "allowed content",
        });
        mockCountRecentMessages.mockResolvedValue(20);

        await expect(
            sendConversationMessageController(USER_ID, CONVERSATION_ID, {
                body: "allowed content",
            })
        ).rejects.toMatchObject({
            statusCode: 429,
            code: "RATE_LIMIT_EXCEEDED",
        });

        expect(mockCreateMessage).not.toHaveBeenCalled();
    });

    it("POST returns 404 for non-participant", async () => {
        mockAssertConversationParticipant.mockRejectedValue(
            new ConversationServiceError(
                "Conversation not found.",
                "CONVERSATION_NOT_FOUND",
                404
            )
        );

        await expect(
            sendConversationMessageController(USER_ID, CONVERSATION_ID, {
                body: "hello",
            })
        ).rejects.toMatchObject({
            statusCode: 404,
        });
    });
});
