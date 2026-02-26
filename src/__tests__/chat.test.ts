import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/* ── Mock: fs/promises (knowledge pack) ────────────────────────────────── */

const mockReadFile = vi.fn();
vi.mock("fs/promises", () => ({
    readFile: (...args: unknown[]) => mockReadFile(...args),
}));

/* ── Mock: global fetch (Ollama) ───────────────────────────────────────── */

const originalFetch = globalThis.fetch;

function makeRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Chat Gateway", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: knowledge pack loads successfully
        mockReadFile.mockResolvedValue("# Test Knowledge\nSome knowledge content.");
        // Reset knowledge cache between tests by re-importing fresh module
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    // ── 1. POST /api/chat returns answer when Ollama responds ────────────

    it("returns a string answer when Ollama responds successfully", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                message: { role: "assistant", content: "Here is your answer!" },
            }),
        });

        // Re-import to clear cached knowledge
        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        const req = makeRequest({ message: "How do I create a ride?" });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.answer).toBe("Here is your answer!");
    });

    // ── 2. System prompt and knowledge pack are injected ─────────────────

    it("injects system prompt, knowledge pack, history, and user message into Ollama call", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                message: { role: "assistant", content: "Response" },
            }),
        });
        globalThis.fetch = mockFetch;

        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        const req = makeRequest({
            message: "How do bookings work?",
            history: [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there!" },
            ],
        });
        await POST(req);

        expect(mockFetch).toHaveBeenCalledOnce();
        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);

        expect(callBody.model).toBe("qwen2.5:7b-instruct");

        const messages = callBody.messages;
        // First message: system prompt
        expect(messages[0].role).toBe("system");
        expect(messages[0].content).toContain("help assistant for a campus transport app");

        // Second message: knowledge pack
        expect(messages[1].role).toBe("system");
        expect(messages[1].content).toContain("Knowledge Pack");
        expect(messages[1].content).toContain("Test Knowledge");

        // History messages
        expect(messages[2]).toEqual({ role: "user", content: "Hello" });
        expect(messages[3]).toEqual({ role: "assistant", content: "Hi there!" });

        // User message (last)
        expect(messages[messages.length - 1]).toEqual({
            role: "user",
            content: "How do bookings work?",
        });
    });

    // ── 3. History truncation ─────────────────────────────────────────────

    it("truncates history to last 10 messages", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                message: { role: "assistant", content: "Ok" },
            }),
        });
        globalThis.fetch = mockFetch;

        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        // 15 history messages
        const history = Array.from({ length: 15 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: `Message ${i}`,
        }));

        const req = makeRequest({ message: "Latest question", history });
        await POST(req);

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        const messages = callBody.messages;

        // 2 system + 10 history (truncated) + 1 user = 13
        expect(messages).toHaveLength(13);

        // First history message should be Message 5 (index 5 of original 15)
        const firstHistory = messages[2]; // after 2 system messages
        expect(firstHistory.content).toBe("Message 5");

        // Last before user message should be Message 14
        const lastHistory = messages[11]; // index 11
        expect(lastHistory.content).toBe("Message 14");
    });

    // ── 4. Ollama down → 503 ──────────────────────────────────────────────

    it("returns 503 when Ollama is unreachable", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(
            new TypeError("fetch failed")
        );

        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        const req = makeRequest({ message: "Hello" });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.error).toBe("Model unavailable. Ensure Ollama is running.");
    });

    // ── 5. Validation: missing message → 400 ─────────────────────────────

    it("returns 400 when message is missing or empty", async () => {
        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        const req1 = makeRequest({ message: "" });
        const res1 = await POST(req1);
        expect(res1.status).toBe(400);

        const req2 = makeRequest({ message: "   " });
        const res2 = await POST(req2);
        expect(res2.status).toBe(400);

        const req3 = makeRequest({});
        const res3 = await POST(req3);
        expect(res3.status).toBe(400);
    });

    // ── 6. Validation: invalid history → 400 ─────────────────────────────

    it("returns 400 when history is malformed", async () => {
        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        const req = makeRequest({
            message: "Hi",
            history: [{ role: 123, content: "bad" }],
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    // ── 7. GET /api/chat/health ──────────────────────────────────────────

    it("returns 200 with status ok and model name", async () => {
        const { GET } = await import("@/app/api/chat/health/route");

        const res = await GET();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.status).toBe("ok");
        expect(json.model).toBe("qwen2.5:7b-instruct");
    });
});
