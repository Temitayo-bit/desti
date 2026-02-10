import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Public health-check endpoint. No auth required.
 * Useful for uptime monitoring and deployment verification.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
    });
}
