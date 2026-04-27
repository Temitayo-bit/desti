import { NextResponse } from "next/server";

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * GET /api/chat/health
 *
 * Lightweight health check for the chat gateway.
 * Returns provider and configured model. No live upstream check.
 */
export async function GET() {
    const model =
        process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
    return NextResponse.json({
        status: "ok",
        provider: "gemini",
        model,
    });
}
