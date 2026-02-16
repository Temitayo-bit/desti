import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    BookingQueryValidationError,
    decodeBookingCursor,
    encodeBookingCursor,
    parseBookingLimit,
    parseBookingStatus,
} from "@/lib/booking-query";

const bookingMineSelect = {
    id: true,
    rideId: true,
    riderUserId: true,
    seatsBooked: true,
    status: true,
    createdAt: true,
    ride: {
        select: {
            id: true,
            originText: true,
            destinationText: true,
            earliestDepartAt: true,
            latestDepartAt: true,
            preferredDepartAt: true,
            distanceCategory: true,
            priceCents: true,
            seatsTotal: true,
            seatsAvailable: true,
            status: true,
        },
    },
} satisfies Prisma.BookingSelect;

type BookingMineItem = Prisma.BookingGetPayload<{
    select: typeof bookingMineSelect;
}>;

/**
 * GET /api/bookings/mine
 *
 * Returns the caller's bookings with deterministic cursor pagination.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;

        const userId = auth.user.clerkUserId;
        const searchParams = new URL(request.url).searchParams;

        const limit = parseBookingLimit(searchParams.get("limit"));
        const status = parseBookingStatus(searchParams.get("status"));
        const cursor = decodeBookingCursor(searchParams.get("cursor"));

        const andClauses: Prisma.BookingWhereInput[] = [
            { riderUserId: userId },
            { status },
        ];

        if (cursor) {
            andClauses.push({
                OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    {
                        createdAt: cursor.createdAt,
                        id: { lt: cursor.id },
                    },
                ],
            });
        }

        const bookings = await prisma.booking.findMany({
            where: { AND: andClauses },
            take: limit + 1,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: bookingMineSelect,
        });

        const hasNextPage = bookings.length > limit;
        const items: BookingMineItem[] = hasNextPage
            ? bookings.slice(0, limit)
            : bookings;
        const lastItem = items.at(-1);
        const nextCursor =
            hasNextPage && lastItem
                ? encodeBookingCursor(lastItem.id, lastItem.createdAt)
                : null;

        return NextResponse.json({ items, nextCursor });
    } catch (error) {
        if (error instanceof BookingQueryValidationError) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    field: error.field,
                    message: error.message,
                },
                { status: 400 }
            );
        }

        console.error("[GET /api/bookings/mine] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching bookings.",
            },
            { status: 500 }
        );
    }
}
