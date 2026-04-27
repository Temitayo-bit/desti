import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/matches
 *
 * Returns SUGGESTED matches for the authenticated user's active trip requests.
 * The user sees matches where their trip request was matched to a ride.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const userId = auth.user.clerkUserId;

        const matches = await prisma.match.findMany({
            where: {
                state: "SUGGESTED",
                tripRequest: {
                    riderUserId: userId,
                    status: "ACTIVE",
                },
            },
            select: {
                id: true,
                state: true,
                scoreSnapshot: true,
                originDistanceSnapshot: true,
                destinationDistanceSnapshot: true,
                timeDifferenceSnapshot: true,
                createdAt: true,
                tripRequest: {
                    select: {
                        id: true,
                        originText: true,
                        destinationText: true,
                        earliestDesiredAt: true,
                        latestDesiredAt: true,
                        seatsNeeded: true,
                    },
                },
                ride: {
                    select: {
                        id: true,
                        originText: true,
                        destinationText: true,
                        earliestDepartAt: true,
                        latestDepartAt: true,
                        priceCents: true,
                        seatsAvailable: true,
                        seatsTotal: true,
                        distanceCategory: true,
                        driver: {
                            select: {
                                name: true,
                                profilePictureUrl: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ scoreSnapshot: "desc" }, { createdAt: "desc" }],
            take: 10,
        });

        return NextResponse.json({ items: matches }, { status: 200 });
    } catch (error) {
        console.error("[GET /api/matches] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching matches.",
            },
            { status: 500 }
        );
    }
}
