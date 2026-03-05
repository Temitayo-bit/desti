import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    OfferQueryValidationError,
    decodeOfferCursor,
    encodeOfferCursor,
    parseOfferLimit,
    parseOfferRole,
    parseOfferStatus,
} from "@/lib/offer-query";

const offerMineSelect = {
    id: true,
    tripRequestId: true,
    driverUserId: true,
    riderUserId: true,
    seatsOffered: true,
    priceCents: true,
    message: true,
    status: true,
    createdAt: true,
    tripRequest: {
        select: {
            id: true,
            originText: true,
            destinationText: true,
            earliestDesiredAt: true,
            latestDesiredAt: true,
            preferredDepartAt: true,
            distanceCategory: true,
            seatsNeeded: true,
            status: true,
        },
    },
} satisfies Prisma.OfferSelect;

type OfferMineItem = Prisma.OfferGetPayload<{
    select: typeof offerMineSelect;
}>;

/**
 * GET /api/offers/mine
 *
 * Returns the caller's offers filtered by role with deterministic cursor pagination.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const userId = auth.user.clerkUserId;
        const searchParams = new URL(request.url).searchParams;

        const role = parseOfferRole(searchParams.get("role"));
        const status = parseOfferStatus(searchParams.get("status"));
        const limit = parseOfferLimit(searchParams.get("limit"));
        const cursor = decodeOfferCursor(searchParams.get("cursor"));

        const andClauses: Prisma.OfferWhereInput[] = [
            role === "rider" ? { riderUserId: userId } : { driverUserId: userId },
        ];

        if (status) {
            andClauses.push({ status });
        }

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

        const offers = await prisma.offer.findMany({
            where: { AND: andClauses },
            take: limit + 1,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: offerMineSelect,
        });

        const hasNextPage = offers.length > limit;
        const items: OfferMineItem[] = hasNextPage ? offers.slice(0, limit) : offers;
        const lastItem = items.at(-1);
        const nextCursor =
            hasNextPage && lastItem
                ? encodeOfferCursor(lastItem.id, lastItem.createdAt)
                : null;

        return NextResponse.json({ items, nextCursor });
    } catch (error) {
        if (error instanceof OfferQueryValidationError) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    field: error.field,
                    message: error.message,
                },
                { status: 400 }
            );
        }

        console.error("[GET /api/offers/mine] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching offers.",
            },
            { status: 500 }
        );
    }
}
