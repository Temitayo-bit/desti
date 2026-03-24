import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    CHAT_WIDGET_HISTORY_LIMIT,
    requestChatAnswer,
    trimChatHistory,
    toChatHistory,
    type ChatWidgetMessage,
} from "@/lib/chat-widget";

const originalFetch = globalThis.fetch;

describe("chat widget helper", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("maps widget messages into API history format", () => {
        const messages: ChatWidgetMessage[] = [
            {
                id: "1",
                role: "user",
                content: "How do I post a ride?",
            },
            {
                id: "2",
                role: "assistant",
                content: "Use the Post Rides page.",
            },
        ];

        expect(toChatHistory(messages)).toEqual([
            {
                role: "user",
                content: "How do I post a ride?",
            },
            {
                role: "assistant",
                content: "Use the Post Rides page.",
            },
        ]);
    });

    it("trims API history to the last 10 messages", () => {
        const history = Array.from(
            { length: CHAT_WIDGET_HISTORY_LIMIT + 4 },
            (_, index) => ({
                role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
                content: `Message ${index + 1}`,
            })
        );

        expect(trimChatHistory(history)).toEqual(
            history.slice(-CHAT_WIDGET_HISTORY_LIMIT)
        );
    });

    it("posts the current message and history to /api/chat", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                answer: "Open Post Rides from the left navigation.",
            }),
        });
        globalThis.fetch = fetchMock as typeof globalThis.fetch;

        const answer = await requestChatAnswer({
            message: "How do I post a ride?",
            history: [
                {
                    role: "user",
                    content: "Hi",
                },
            ],
        });

        expect(answer).toBe("Open Post Rides from the left navigation.");
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/chat",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "How do I post a ride?",
                    history: [
                        {
                            role: "user",
                            content: "Hi",
                        },
                    ],
                }),
            })
        );
    });

    it("surfaces API error payloads", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({
                error: "AI service unavailable. Please try again later.",
            }),
        }) as typeof globalThis.fetch;

        await expect(
            requestChatAnswer({
                message: "Hello",
                history: [],
            })
        ).rejects.toThrow("AI service unavailable. Please try again later.");
    });

    it("rejects malformed success payloads", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                answer: "",
            }),
        }) as typeof globalThis.fetch;

        await expect(
            requestChatAnswer({
                message: "Hello",
                history: [],
            })
        ).rejects.toThrow("Chat service returned an invalid response.");
    });
});
