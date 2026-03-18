import { NextResponse } from "next/server";

const OLLAMA_MODEL = "qwen2.5:7b-instruct";

/**
 * GET /api/chat/health
 *
 * Lightweight health check for the chat gateway.
 * Returns the configured model name. Does not depend on Ollama availability.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        model: OLLAMA_MODEL,
    });
}
