import { NextResponse } from "next/server";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * GET /api/chat/health
 *
 * Lightweight health check for the chat gateway.
 * Returns provider and configured model. No live upstream check.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        provider: "gemini",
        model: GEMINI_MODEL,
    });
}
