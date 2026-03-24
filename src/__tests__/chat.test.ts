import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/* ── Mock: fs/promises (knowledge pack) ────────────────────────────────── */

const mockReadFile = vi.fn();
vi.mock("fs/promises", () => ({
    readFile: (...args: unknown[]) => mockReadFile(...args),
}));

/* ── Mock: Gemini SDK (@google/genai) ──────────────────────────────────── */

const mockSendMessage = vi.fn();
const mockChatsCreate = vi.fn(() => ({ sendMessage: mockSendMessage }));
const mockGoogleGenAI = vi.fn(function MockGoogleGenAI() {
    return {
        chats: { create: mockChatsCreate },
    };
});

vi.mock("@google/genai", () => ({
    GoogleGenAI: mockGoogleGenAI,
}));

const originalGeminiApiKey = process.env.GEMINI_API_KEY;
const originalGeminiModel = process.env.GEMINI_MODEL;

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
        mockSendMessage.mockResolvedValue({
            text: "Here is your answer!",
        });
        process.env.GEMINI_API_KEY = "test-gemini-key";
        process.env.GEMINI_MODEL = "gemini-test-model";
    });

    afterEach(() => {
        process.env.GEMINI_API_KEY = originalGeminiApiKey;
        process.env.GEMINI_MODEL = originalGeminiModel;
    });

    // ── 1. POST /api/chat returns answer when Gemini responds ────────────

    it("returns a string answer when Gemini responds successfully", async () => {
        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        const req = makeRequest({ message: "How do I create a ride?" });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.answer).toBe("Here is your answer!");
    });

    // ── 2. System instruction and history are passed to Gemini ───────────

    it("injects system prompt, knowledge pack, history, and user message into Gemini call", async () => {
        mockSendMessage.mockResolvedValue({
            text: "Response",
        });

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

        expect(mockChatsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                model: "gemini-test-model",
                config: expect.objectContaining({
                    systemInstruction: expect.stringContaining(
                        "You are Desti Assistant—help for Desti, a campus transport app for verified Stetson students."
                    ),
                }),
                history: [
                    { role: "user", parts: [{ text: "Hello" }] },
                    { role: "model", parts: [{ text: "Hi there!" }] },
                ],
            })
        );
        expect(mockChatsCreate.mock.calls.length).toBeGreaterThan(0);
        const createCalls = mockChatsCreate.mock.calls as unknown as Array<
            [{ config?: { systemInstruction?: string } }]
        >;
        const createArg = createCalls[0]![0];
        expect(createArg.config?.systemInstruction).toContain("Knowledge Pack");
        expect(createArg.config?.systemInstruction).toContain("Test Knowledge");

        expect(mockSendMessage).toHaveBeenCalledWith({
            message: "How do bookings work?",
        });
    });

    // ── 3. History truncation ─────────────────────────────────────────────

    it("truncates history to last 10 messages", async () => {
        mockSendMessage.mockResolvedValue({
            text: "Ok",
        });

        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        // 15 history messages
        const history = Array.from({ length: 15 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: `Message ${i}`,
        }));

        const req = makeRequest({ message: "Latest question", history });
        await POST(req);

        expect(mockChatsCreate.mock.calls.length).toBeGreaterThan(0);
        const truncateCalls = mockChatsCreate.mock.calls as unknown as Array<
            [{ history?: { parts: [{ text: string }] }[] }]
        >;
        const chatConfig = truncateCalls[0]![0];
        const messages = chatConfig.history!;

        // 10 history messages only (already truncated)
        expect(messages).toHaveLength(10);

        // First history message should be Message 5 (index 5 of original 15)
        const firstHistory = messages[0];
        expect(firstHistory.parts[0].text).toBe("Message 5");

        // Last history message should be Message 14
        const lastHistory = messages[9];
        expect(lastHistory.parts[0].text).toBe("Message 14");
    });

    // ── 4. Missing Gemini config → 503 ───────────────────────────────────

    it("returns 503 when Gemini API key is missing", async () => {
        process.env.GEMINI_API_KEY = "";

        vi.resetModules();
        const { POST } = await import("@/app/api/chat/route");

        const req = makeRequest({ message: "Hello" });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(503);
        expect(json.error).toBe("AI service unavailable. Missing server configuration.");
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
        vi.resetModules();
        process.env.GEMINI_MODEL = "gemini-health-model";
        const { GET } = await import("@/app/api/chat/health/route");

        const res = await GET();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.status).toBe("ok");
        expect(json.provider).toBe("gemini");
        expect(json.model).toBe("gemini-health-model");
    });
});
