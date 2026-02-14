import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DistanceCategory, Prisma } from "@/generated/prisma/client";
import {
    QueryValidationError,
    decodeCursor,
    encodeCursor,
    parseBooleanParam,
    parseDistanceCategory,
    parseISODateParam,
    parseLimit,
    parseSeatsParam,
} from "@/lib/browse-query";

// ── Constants ────────────────────────────────────────────────────────────────
const VALID_DISTANCE_CATEGORIES: ReadonlySet<string> = new Set(
    Object.values(DistanceCategory)
);
const MAX_DEPARTURE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const CLOCK_SKEW_GRACE_MS = 10 * 60 * 1000; // 10 minutes

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

type RideSummary = Prisma.RideGetPayload<{ select: typeof rideSummarySelect }>;

// ── GET /api/rides ───────────────────────────────────────────────────────────

/**
 * GET /api/rides
 *
 * Returns active rides with cursor-based pagination and strict query validation.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;

        const now = new Date();
        const searchParams = new URL(request.url).searchParams;

        const limit = parseLimit(searchParams.get("limit"));
        const cursor = decodeCursor(searchParams.get("cursor"));
        const distanceCategory = parseDistanceCategory(
            searchParams.get("distanceCategory")
        );
        const includeFull = parseBooleanParam(
            searchParams.get("includeFull"),
            "includeFull",
            false
        );
        const earliestAfter =
            parseISODateParam(searchParams.get("earliestAfter"), "earliestAfter") ??
            now;
        const latestBefore = parseISODateParam(
            searchParams.get("latestBefore"),
            "latestBefore"
        );
        const seatsMin = parseSeatsParam(searchParams.get("seatsMin"), "seatsMin");

        const andClauses: Prisma.RideWhereInput[] = [
            { status: "ACTIVE" },
            { latestDepartAt: { gt: now } },
            { earliestDepartAt: { gte: earliestAfter } },
        ];

        if (latestBefore) {
            andClauses.push({ latestDepartAt: { lte: latestBefore } });
        }
        if (distanceCategory) {
            andClauses.push({ distanceCategory });
        }

        const seatsThreshold = seatsMin ?? (includeFull ? undefined : 1);
        if (seatsThreshold !== undefined) {
            andClauses.push({ seatsAvailable: { gte: seatsThreshold } });
        }

        if (cursor) {
            andClauses.push({
                OR: [
                    { earliestDepartAt: { gt: cursor.timestamp } },
                    {
                        earliestDepartAt: cursor.timestamp,
                        id: { gt: cursor.id },
                    },
                ],
            });
        }

        const rides = await prisma.ride.findMany({
            where: { AND: andClauses },
            take: limit + 1,
            orderBy: [{ earliestDepartAt: "asc" }, { id: "asc" }],
            select: rideSummarySelect,
        });

        const hasNextPage = rides.length > limit;
        const items: RideSummary[] = hasNextPage ? rides.slice(0, limit) : rides;
        const lastItem = items.at(-1);
        const nextCursor =
            hasNextPage && lastItem
                ? encodeCursor(lastItem.id, lastItem.earliestDepartAt)
                : null;

        return NextResponse.json({ items, nextCursor });
    } catch (error) {
        if (error instanceof QueryValidationError) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    field: error.field,
                    message: error.message,
                },
                { status: 400 }
            );
        }

        console.error("[GET /api/rides] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while fetching rides.",
            },
            { status: 500 }
        );
    }
}

// ── Validation helpers ───────────────────────────────────────────────────────

interface ValidationError {
    field: string;
    message: string;
}

/**
 * Validates the ride creation request body.
 * Returns an array of field-level errors (empty = valid).
 */
function validateRideBody(body: Record<string, unknown>): {
    errors: ValidationError[];
    parsed: {
        originText: string;
        destinationText: string;
        earliestDepartAt: Date;
        latestDepartAt: Date;
        distanceCategory: DistanceCategory;
        priceCents: number;
        seatsTotal: number;
        pickupInstructions: string | null;
        dropoffInstructions: string | null;
        preferredDepartAt: Date | null;
    } | null;
} {
    const errors: ValidationError[] = [];

    // — originText ————————————————————————————————————————————————————————————
    const originRaw = body.originText;
    if (typeof originRaw !== "string") {
        errors.push({ field: "originText", message: "originText is required and must be a string." });
    }
    const originText = typeof originRaw === "string" ? originRaw.trim() : "";
    if (typeof originRaw === "string" && (originText.length < 3 || originText.length > 200)) {
        errors.push({ field: "originText", message: "originText must be between 3 and 200 characters after trimming." });
    }

    // — destinationText ———————————————————————————————————————————————————————
    const destRaw = body.destinationText;
    if (typeof destRaw !== "string") {
        errors.push({ field: "destinationText", message: "destinationText is required and must be a string." });
    }
    const destinationText = typeof destRaw === "string" ? destRaw.trim() : "";
    if (typeof destRaw === "string" && (destinationText.length < 3 || destinationText.length > 200)) {
        errors.push({ field: "destinationText", message: "destinationText must be between 3 and 200 characters after trimming." });
    }

    // — earliestDepartAt ——————————————————————————————————————————————————————
    const earliestRaw = body.earliestDepartAt;
    let earliestDepartAt: Date | null = null;
    if (typeof earliestRaw !== "string" || !earliestRaw) {
        errors.push({ field: "earliestDepartAt", message: "earliestDepartAt is required and must be an ISO datetime string." });
    } else {
        earliestDepartAt = new Date(earliestRaw);
        if (isNaN(earliestDepartAt.getTime())) {
            errors.push({ field: "earliestDepartAt", message: "earliestDepartAt must be a valid ISO datetime." });
            earliestDepartAt = null;
        }
    }

    // — latestDepartAt ————————————————————————————————————————————————————————
    const latestRaw = body.latestDepartAt;
    let latestDepartAt: Date | null = null;
    if (typeof latestRaw !== "string" || !latestRaw) {
        errors.push({ field: "latestDepartAt", message: "latestDepartAt is required and must be an ISO datetime string." });
    } else {
        latestDepartAt = new Date(latestRaw);
        if (isNaN(latestDepartAt.getTime())) {
            errors.push({ field: "latestDepartAt", message: "latestDepartAt must be a valid ISO datetime." });
            latestDepartAt = null;
        }
    }

    // — Datetime cross-field validation ———————————————————————————————————————
    if (earliestDepartAt && latestDepartAt) {
        if (latestDepartAt.getTime() <= earliestDepartAt.getTime()) {
            errors.push({ field: "latestDepartAt", message: "latestDepartAt must be strictly after earliestDepartAt." });
        } else {
            const windowMs = latestDepartAt.getTime() - earliestDepartAt.getTime();
            if (windowMs > MAX_DEPARTURE_WINDOW_MS) {
                errors.push({ field: "latestDepartAt", message: "Departure window must be 48 hours or less." });
            }
        }
    }

    if (earliestDepartAt) {
        const graceThreshold = Date.now() - CLOCK_SKEW_GRACE_MS;
        if (earliestDepartAt.getTime() < graceThreshold) {
            errors.push({ field: "earliestDepartAt", message: "earliestDepartAt must not be in the past (10-minute grace allowed)." });
        }
    }

    // — distanceCategory ——————————————————————————————————————————————————————
    const distRaw = body.distanceCategory;
    if (typeof distRaw !== "string" || !VALID_DISTANCE_CATEGORIES.has(distRaw)) {
        errors.push({ field: "distanceCategory", message: "distanceCategory must be one of SHORT, MEDIUM, or LONG." });
    }

    // — priceCents ————————————————————————————————————————————————————————————
    const priceRaw = body.priceCents;
    if (typeof priceRaw !== "number" || !Number.isInteger(priceRaw) || priceRaw < 0) {
        errors.push({ field: "priceCents", message: "priceCents must be a non-negative integer." });
    }

    // — seatsTotal ————————————————————————————————————————————————————————————
    const seatsRaw = body.seatsTotal;
    if (typeof seatsRaw !== "number" || !Number.isInteger(seatsRaw) || seatsRaw < 1 || seatsRaw > 8) {
        errors.push({ field: "seatsTotal", message: "seatsTotal must be an integer between 1 and 8." });
    }

    // — pickupInstructions (optional) ———————————————————————————————————————
    let pickupInstructions: string | null = null;
    if (body.pickupInstructions !== undefined && body.pickupInstructions !== null) {
        if (typeof body.pickupInstructions !== "string") {
            errors.push({ field: "pickupInstructions", message: "pickupInstructions must be a string." });
        } else {
            const trimmed = body.pickupInstructions.trim();
            if (trimmed.length === 0) {
                errors.push({ field: "pickupInstructions", message: "pickupInstructions must not be empty after trimming." });
            } else if (trimmed.length > 500) {
                errors.push({ field: "pickupInstructions", message: "pickupInstructions must be 500 characters or fewer." });
            } else {
                pickupInstructions = trimmed;
            }
        }
    }

    // — dropoffInstructions (optional) ——————————————————————————————————————
    let dropoffInstructions: string | null = null;
    if (body.dropoffInstructions !== undefined && body.dropoffInstructions !== null) {
        if (typeof body.dropoffInstructions !== "string") {
            errors.push({ field: "dropoffInstructions", message: "dropoffInstructions must be a string." });
        } else {
            const trimmed = body.dropoffInstructions.trim();
            if (trimmed.length === 0) {
                errors.push({ field: "dropoffInstructions", message: "dropoffInstructions must not be empty after trimming." });
            } else if (trimmed.length > 500) {
                errors.push({ field: "dropoffInstructions", message: "dropoffInstructions must be 500 characters or fewer." });
            } else {
                dropoffInstructions = trimmed;
            }
        }
    }

    // — preferredDepartAt (optional) ———————————————————————————————————————
    let preferredDepartAt: Date | null = null;
    if (body.preferredDepartAt !== undefined && body.preferredDepartAt !== null) {
        if (typeof body.preferredDepartAt !== "string") {
            errors.push({ field: "preferredDepartAt", message: "preferredDepartAt must be an ISO datetime string." });
        } else {
            preferredDepartAt = new Date(body.preferredDepartAt);
            if (isNaN(preferredDepartAt.getTime())) {
                errors.push({ field: "preferredDepartAt", message: "preferredDepartAt must be a valid ISO datetime." });
                preferredDepartAt = null;
            } else if (earliestDepartAt && latestDepartAt) {
                if (preferredDepartAt.getTime() < earliestDepartAt.getTime()) {
                    errors.push({ field: "preferredDepartAt", message: "preferredDepartAt must not be before earliestDepartAt." });
                } else if (preferredDepartAt.getTime() > latestDepartAt.getTime()) {
                    errors.push({ field: "preferredDepartAt", message: "preferredDepartAt must not be after latestDepartAt." });
                }
            }
        }
    }

    if (errors.length > 0) {
        return { errors, parsed: null };
    }

    return {
        errors: [],
        parsed: {
            originText,
            destinationText,
            earliestDepartAt: earliestDepartAt!,
            latestDepartAt: latestDepartAt!,
            distanceCategory: distRaw as DistanceCategory,
            priceCents: priceRaw as number,
            seatsTotal: seatsRaw as number,
            pickupInstructions,
            dropoffInstructions,
            preferredDepartAt,
        },
    };
}

// ── POST /api/rides ──────────────────────────────────────────────────────────

/**
 * POST /api/rides
 *
 * Creates a new ride. Requires:
 * - Valid Clerk session with verified @stetson.edu email
 * - Idempotency-Key header
 * - Valid ride details in the request body
 *
 * Returns 201 on first create, 200 on idempotent replay.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Auth guard — derive driverUserId from authenticated user
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;

        const driverUserId = auth.user.clerkUserId;

        // 2. Require Idempotency-Key header
        const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
        if (!idempotencyKey) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    message: "Idempotency-Key header is required.",
                },
                { status: 400 }
            );
        }

        // 3. Parse and validate request body
        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    message: "Request body must be valid JSON.",
                },
                { status: 400 }
            );
        }

        // Ensure body is a plain object (reject null, arrays, primitives)
        if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    message: "Request body must be a JSON object.",
                },
                { status: 400 }
            );
        }

        const body = rawBody as Record<string, unknown>;

        // Reject any client attempt to provide driverUserId (ignore it)
        delete body.driverUserId;

        const validation = validateRideBody(body);
        if (validation.errors.length > 0) {
            return NextResponse.json(
                {
                    error: "Validation Error",
                    message: "One or more fields are invalid.",
                    details: validation.errors,
                },
                { status: 400 }
            );
        }

        const parsed = validation.parsed!;

        // 4. Idempotency check — return existing ride if key was already used
        const existingMapping = await prisma.idempotencyKey.findUnique({
            where: {
                userId_idempotencyKey_entityType: {
                    userId: driverUserId,
                    idempotencyKey,
                    entityType: "RIDE",
                },
            },
            include: { ride: true },
        });

        if (existingMapping) {
            return NextResponse.json(existingMapping.ride, { status: 200 });
        }

        // 5. Ensure local User record exists (FK: rides.driver_user_id → users.clerk_user_id)
        await prisma.user.upsert({
            where: { clerkUserId: driverUserId },
            update: { email: auth.user.primaryStetsonEmail },
            create: { clerkUserId: driverUserId, email: auth.user.primaryStetsonEmail },
        });

        // 6. Create ride + idempotency mapping in a single atomic transaction.
        //    If the idempotency key insert hits a P2002 (race condition),
        //    the entire transaction rolls back — preventing orphan rides.
        let ride;
        try {
            ride = await prisma.$transaction(async (tx) => {
                const newRide = await tx.ride.create({
                    data: {
                        driverUserId,
                        originText: parsed.originText,
                        destinationText: parsed.destinationText,
                        earliestDepartAt: parsed.earliestDepartAt,
                        latestDepartAt: parsed.latestDepartAt,
                        distanceCategory: parsed.distanceCategory,
                        priceCents: parsed.priceCents,
                        seatsTotal: parsed.seatsTotal,
                        seatsAvailable: parsed.seatsTotal, // ← invariant: seatsAvailable == seatsTotal on create
                        pickupInstructions: parsed.pickupInstructions,
                        dropoffInstructions: parsed.dropoffInstructions,
                        preferredDepartAt: parsed.preferredDepartAt,
                        status: "ACTIVE",
                    },
                });

                await tx.idempotencyKey.create({
                    data: {
                        userId: driverUserId,
                        idempotencyKey,
                        entityType: "RIDE",
                        rideId: newRide.id,
                    },
                });

                return newRide;
            });
        } catch (err: unknown) {
            // Race condition: another concurrent request already stored the key.
            // The transaction rolled back, so no orphan ride was persisted.
            // Fetch the existing mapping and return that ride instead.
            if (isPrismaUniqueConstraintError(err)) {
                const existing = await prisma.idempotencyKey.findUnique({
                    where: {
                        userId_idempotencyKey_entityType: {
                            userId: driverUserId,
                            idempotencyKey,
                            entityType: "RIDE",
                        },
                    },
                    include: { ride: true },
                });

                if (existing) {
                    return NextResponse.json(existing.ride, { status: 200 });
                }
            }

            throw err; // Re-throw unexpected errors
        }

        // 7. Return created ride
        return NextResponse.json(ride, { status: 201 });
    } catch (error) {
        console.error("[POST /api/rides] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while creating the ride.",
            },
            { status: 500 }
        );
    }
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Type guard: checks if an error is a Prisma unique constraint violation (P2002).
 */
function isPrismaUniqueConstraintError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
    );
}
