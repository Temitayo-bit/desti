import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rideSummarySelect = {
  id: true,
  driverUserId: true,
  originText: true,
  destinationText: true,
  earliestDepartAt: true,
  latestDepartAt: true,
  distanceCategory: true,
  priceCents: true,
  seatsTotal: true,
  seatsAvailable: true,
  pickupInstructions: true,
  dropoffInstructions: true,
  preferredDepartAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RideSelect;

/**
 * GET /api/rides/mine
 *
 * Returns rides owned by the authenticated driver.
 * Includes both past and upcoming rides.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStetsonAuth(request);
    if (auth.error) return auth.error;

    const driverUserId = auth.user.clerkUserId;

    const items = await prisma.ride.findMany({
      where: {
        driverUserId,
        status: "ACTIVE",
      },
      orderBy: [{ earliestDepartAt: "desc" }, { id: "desc" }],
      select: rideSummarySelect,
    });

    return NextResponse.json({ items, nextCursor: null });
  } catch (error) {
    console.error("[GET /api/rides/mine] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred while fetching your rides.",
      },
      { status: 500 },
    );
  }
}
