import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/* ── Constants ────────────────────────────────────────────────────────────── */

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_MODEL = "qwen2.5:7b-instruct";
const OLLAMA_TIMEOUT_MS = 30_000;
const MAX_HISTORY = 10;

const SYSTEM_PROMPT = `You are the help assistant for a campus transport app for verified Stetson students.

You must:
- Only answer using the provided Knowledge Pack and the user's question.
- If the user asks you to create or search for rides or trip requests, you must not claim you performed the action.
- Instead, explain how the user would do it in the app and ask for missing details.
- Be concise and clear.
- Do not invent features.
- Do not mention implementation details like Prisma, Vercel, or server architecture.
- If a rule depends on time, state it clearly.`;

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface ChatMessage {
    role: string;
    content: string;
}

/* ── Knowledge pack loader ────────────────────────────────────────────────── */

let cachedKnowledge: string | null = null;

async function loadKnowledgePack(): Promise<string> {
    if (cachedKnowledge) return cachedKnowledge;
    const filePath = join(process.cwd(), "chat", "knowledge.md");
    try {
        cachedKnowledge = await readFile(filePath, "utf-8");
        return cachedKnowledge;
    } catch {
        throw new Error(`Knowledge pack not found at ${filePath}`);
    }
}

/* ── Validation ───────────────────────────────────────────────────────────── */

function validateRequest(body: unknown): {
    message: string;
    history: ChatMessage[];
} | { error: string } {
    if (!body || typeof body !== "object") {
        return { error: "Request body must be a JSON object." };
    }

    const { message, history } = body as Record<string, unknown>;

    if (typeof message !== "string" || message.trim().length === 0) {
        return { error: "\"message\" is required and must be a non-empty string." };
    }

    let parsedHistory: ChatMessage[] = [];
    if (history !== undefined) {
        if (!Array.isArray(history)) {
            return { error: "\"history\" must be an array of { role, content } objects." };
        }
        for (const entry of history) {
            if (
                !entry ||
                typeof entry !== "object" ||
                typeof (entry as Record<string, unknown>).role !== "string" ||
                typeof (entry as Record<string, unknown>).content !== "string"
            ) {
                return { error: "Each history entry must have \"role\" (string) and \"content\" (string)." };
            }
        }
        parsedHistory = history as ChatMessage[];
    }

    return {
        message: message.trim(),
        history: parsedHistory,
    };
}

/* ── POST /api/chat ───────────────────────────────────────────────────────── */

/**
 * POST /api/chat
 *
 * Accepts a user message and optional chat history, assembles a prompt
 * with the system instructions and knowledge pack, calls Ollama locally,
 * and returns the assistant's answer.
 *
 * No auth required for Milestone 1. No DB calls. Q&A only.
 */
export async function POST(request: NextRequest) {
    // ── Parse & validate ─────────────────────────────────────────────────
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON in request body." },
            { status: 400 }
        );
    }

    const validation = validateRequest(body);
    if ("error" in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { message, history } = validation;

    // ── Load knowledge pack ──────────────────────────────────────────────
    let knowledge: string;
    try {
        knowledge = await loadKnowledgePack();
    } catch (err) {
        console.error("[POST /api/chat] Knowledge pack error:", err);
        return NextResponse.json(
            { error: "Knowledge pack unavailable. Server misconfigured." },
            { status: 500 }
        );
    }

    // ── Assemble messages ────────────────────────────────────────────────
    // Order: system prompt → knowledge pack → last 10 history → user message

    const truncatedHistory = history.slice(-MAX_HISTORY);

    const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `--- Knowledge Pack ---\n${knowledge}\n--- End Knowledge Pack ---` },
        ...truncatedHistory,
        { role: "user", content: message },
    ];

    // ── Call Ollama ──────────────────────────────────────────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
        const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages,
                stream: false,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!ollamaRes.ok) {
            const text = await ollamaRes.text().catch(() => "");
            console.error(`[POST /api/chat] Ollama returned ${ollamaRes.status}:`, text);
            return NextResponse.json(
                { error: "Model returned an error. Try again later." },
                { status: 502 }
            );
        }

        const ollamaData = await ollamaRes.json();
        const answer: string = ollamaData?.message?.content ?? "";

        return NextResponse.json({ answer });
    } catch (err: unknown) {
        clearTimeout(timeout);

        // Timeout (AbortError)
        if (err instanceof Error && err.name === "AbortError") {
            return NextResponse.json(
                { error: "Chat request timed out. The model took too long to respond." },
                { status: 504 }
            );
        }

        // Connection refused / Ollama not running
        const errMsg = err instanceof Error ? err.message : String(err);
        if (
            errMsg.includes("ECONNREFUSED") ||
            errMsg.includes("fetch failed") ||
            errMsg.includes("connect")
        ) {
            return NextResponse.json(
                { error: "Model unavailable. Ensure Ollama is running." },
                { status: 503 }
            );
        }

        console.error("[POST /api/chat] Unexpected error:", err);
        return NextResponse.json(
            { error: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
