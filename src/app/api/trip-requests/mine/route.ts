import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const tripRequestSummarySelect = {
    id: true,
    riderUserId: true,
    originText: true,
    destinationText: true,
    earliestDesiredAt: true,
    latestDesiredAt: true,
    distanceCategory: true,
    seatsNeeded: true,
    pickupInstructions: true,
    dropoffInstructions: true,
    preferredDepartAt: true,
    status: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.TripRequestSelect;

/**
 * GET /api/trip-requests/mine
 *
 * Returns non-cancelled trip requests owned by the authenticated rider.
 * Includes both upcoming and past trip requests.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const riderUserId = auth.user.clerkUserId;

        const items = await prisma.tripRequest.findMany({
            where: {
                riderUserId,
                status: {
                    not: "CANCELLED",
                },
            },
            orderBy: [{ earliestDesiredAt: "desc" }, { id: "desc" }],
            select: tripRequestSummarySelect,
        });

        return NextResponse.json({ items, nextCursor: null });
    } catch (error) {
        console.error("[GET /api/trip-requests/mine] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message:
                    "An unexpected error occurred while fetching your trip requests.",
            },
            { status: 500 }
        );
    }
}
