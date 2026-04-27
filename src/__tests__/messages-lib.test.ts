import { describe, expect, it } from "vitest";
import {
    appendUniqueMessages,
    encodeMessageCursorFromItem,
    resolveSelectedConversationId,
    type ConversationMessageItem,
} from "@/lib/messages";

function makeMessage(
    overrides: Partial<ConversationMessageItem> = {}
): ConversationMessageItem {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        conversationId: "11111111-1111-4111-8111-111111111111",
        senderUserId: "user_1",
        body: "hello",
        createdAt: "2030-01-01T10:00:00.000Z",
        ...overrides,
    };
}

describe("messages lib", () => {
    it("encodes cursor as base64 json", () => {
        const encoded = encodeMessageCursorFromItem({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            createdAt: "2030-01-01T10:05:00.000Z",
        });

        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        expect(JSON.parse(decoded)).toEqual({
            createdAt: "2030-01-01T10:05:00.000Z",
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        });
    });

    it("appends incoming messages and de-duplicates by id", () => {
        const existing = [
            makeMessage({
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                body: "old content",
            }),
            makeMessage({
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                createdAt: "2030-01-01T10:01:00.000Z",
                body: "existing two",
            }),
        ];

        const incoming = [
            makeMessage({
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                body: "new content",
            }),
            makeMessage({
                id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                createdAt: "2030-01-01T10:02:00.000Z",
                body: "incoming three",
            }),
        ];

        const result = appendUniqueMessages(existing, incoming);
        expect(result).toHaveLength(3);
        expect(result[0].id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        expect(result[0].body).toBe("new content");
        expect(result[2].id).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    });

    it("sorts combined messages by createdAt then id", () => {
        const existing = [
            makeMessage({
                id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                createdAt: "2030-01-01T10:00:00.000Z",
            }),
        ];
        const incoming = [
            makeMessage({
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                createdAt: "2030-01-01T09:59:00.000Z",
            }),
            makeMessage({
                id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                createdAt: "2030-01-01T10:00:00.000Z",
            }),
        ];

        const result = appendUniqueMessages(existing, incoming);
        expect(result.map((item) => item.id)).toEqual([
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        ]);
    });

    it("prefers requested conversation id when present", () => {
        const selected = resolveSelectedConversationId({
            conversations: [{ id: "c1" }, { id: "c2" }],
            previousSelectedConversationId: "c1",
            requestedConversationId: "c2",
        });

        expect(selected).toBe("c2");
    });

    it("falls back to previous selection when requested is missing", () => {
        const selected = resolveSelectedConversationId({
            conversations: [{ id: "c1" }, { id: "c2" }],
            previousSelectedConversationId: "c1",
            requestedConversationId: "c9",
        });

        expect(selected).toBe("c1");
    });

    it("falls back to first conversation id", () => {
        const selected = resolveSelectedConversationId({
            conversations: [{ id: "c1" }, { id: "c2" }],
            previousSelectedConversationId: null,
            requestedConversationId: null,
        });

        expect(selected).toBe("c1");
    });
});
