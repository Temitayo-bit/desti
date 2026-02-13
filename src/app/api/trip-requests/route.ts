import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DistanceCategory } from "@/generated/prisma/client";

// ── Constants ────────────────────────────────────────────────────────────────
const VALID_DISTANCE_CATEGORIES: ReadonlySet<string> = new Set(
    Object.values(DistanceCategory)
);
const MAX_DESIRED_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const CLOCK_SKEW_GRACE_MS = 10 * 60 * 1000; // 10 minutes

// ── Validation helpers ───────────────────────────────────────────────────────

interface ValidationError {
    field: string;
    message: string;
}

/**
 * Validates the trip request creation request body.
 * Returns an array of field-level errors (empty = valid).
 */
function validateTripRequestBody(body: Record<string, unknown>): {
    errors: ValidationError[];
    parsed: {
        originText: string;
        destinationText: string;
        earliestDesiredAt: Date;
        latestDesiredAt: Date;
        distanceCategory: DistanceCategory;
        seatsNeeded: number;
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

    // — earliestDesiredAt —————————————————————————————————————————————————————
    const earliestRaw = body.earliestDesiredAt;
    let earliestDesiredAt: Date | null = null;
    if (typeof earliestRaw !== "string" || !earliestRaw) {
        errors.push({ field: "earliestDesiredAt", message: "earliestDesiredAt is required and must be an ISO datetime string." });
    } else {
        earliestDesiredAt = new Date(earliestRaw);
        if (isNaN(earliestDesiredAt.getTime())) {
            errors.push({ field: "earliestDesiredAt", message: "earliestDesiredAt must be a valid ISO datetime." });
            earliestDesiredAt = null;
        }
    }

    // — latestDesiredAt ———————————————————————————————————————————————————————
    const latestRaw = body.latestDesiredAt;
    let latestDesiredAt: Date | null = null;
    if (typeof latestRaw !== "string" || !latestRaw) {
        errors.push({ field: "latestDesiredAt", message: "latestDesiredAt is required and must be an ISO datetime string." });
    } else {
        latestDesiredAt = new Date(latestRaw);
        if (isNaN(latestDesiredAt.getTime())) {
            errors.push({ field: "latestDesiredAt", message: "latestDesiredAt must be a valid ISO datetime." });
            latestDesiredAt = null;
        }
    }

    // — Datetime cross-field validation ———————————————————————————————————————
    if (earliestDesiredAt && latestDesiredAt) {
        if (latestDesiredAt.getTime() <= earliestDesiredAt.getTime()) {
            errors.push({ field: "latestDesiredAt", message: "latestDesiredAt must be strictly after earliestDesiredAt." });
        } else {
            const windowMs = latestDesiredAt.getTime() - earliestDesiredAt.getTime();
            if (windowMs > MAX_DESIRED_WINDOW_MS) {
                errors.push({ field: "latestDesiredAt", message: "Desired window must be 48 hours or less." });
            }
        }
    }

    if (earliestDesiredAt) {
        const graceThreshold = Date.now() - CLOCK_SKEW_GRACE_MS;
        if (earliestDesiredAt.getTime() < graceThreshold) {
            errors.push({ field: "earliestDesiredAt", message: "earliestDesiredAt must not be in the past (10-minute grace allowed)." });
        }
    }

    // — distanceCategory ——————————————————————————————————————————————————————
    const distRaw = body.distanceCategory;
    if (typeof distRaw !== "string" || !VALID_DISTANCE_CATEGORIES.has(distRaw)) {
        errors.push({ field: "distanceCategory", message: "distanceCategory must be one of SHORT, MEDIUM, or LONG." });
    }

    // — seatsNeeded ———————————————————————————————————————————————————————————
    const seatsRaw = body.seatsNeeded;
    if (typeof seatsRaw !== "number" || !Number.isInteger(seatsRaw) || seatsRaw < 1 || seatsRaw > 8) {
        errors.push({ field: "seatsNeeded", message: "seatsNeeded must be an integer between 1 and 8." });
    }

    if (errors.length > 0) {
        return { errors, parsed: null };
    }

    return {
        errors: [],
        parsed: {
            originText,
            destinationText,
            earliestDesiredAt: earliestDesiredAt!,
            latestDesiredAt: latestDesiredAt!,
            distanceCategory: distRaw as DistanceCategory,
            seatsNeeded: seatsRaw as number,
        },
    };
}

// ── POST /api/trip-requests ──────────────────────────────────────────────────

/**
 * POST /api/trip-requests
 *
 * Creates a new trip request. Requires:
 * - Valid Clerk session with verified @stetson.edu email
 * - Idempotency-Key header
 * - Valid trip request details in the request body
 *
 * Returns 201 on first create, 200 on idempotent replay.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Auth guard — derive riderUserId from authenticated user
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;

        const riderUserId = auth.user.clerkUserId;

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

        // Reject any client attempt to provide riderUserId (ignore it)
        delete body.riderUserId;

        const validation = validateTripRequestBody(body);
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

        // 4. Idempotency check — return existing trip request if key was already used
        const existingMapping = await prisma.idempotencyKey.findUnique({
            where: {
                userId_idempotencyKey_entityType: {
                    userId: riderUserId,
                    idempotencyKey,
                    entityType: "TRIP_REQUEST",
                },
            },
            include: { tripRequest: true },
        });

        if (existingMapping) {
            if (!existingMapping.tripRequest) {
                // Corruption: idempotency key exists but linked trip request is missing.
                // Use deleteMany (not delete) so concurrent cleanup is a no-op, not a P2025 throw.
                console.warn(
                    `[POST /api/trip-requests] Stale idempotency key ${idempotencyKey}: tripRequest is null. Deleting and re-creating.`
                );
                await prisma.idempotencyKey.deleteMany({ where: { id: existingMapping.id } });
            } else {
                return NextResponse.json(existingMapping.tripRequest, { status: 200 });
            }
        }

        // 5. Ensure local User record exists (FK: trip_requests.rider_user_id → users.clerk_user_id)
        await prisma.user.upsert({
            where: { clerkUserId: riderUserId },
            update: { email: auth.user.primaryStetsonEmail },
            create: { clerkUserId: riderUserId, email: auth.user.primaryStetsonEmail },
        });

        // 6. Create trip request + idempotency mapping in a single atomic transaction.
        //    If the idempotency key insert hits a P2002 (race condition),
        //    the entire transaction rolls back — preventing orphan trip requests.
        let tripRequest;
        try {
            tripRequest = await prisma.$transaction(async (tx) => {
                const newTripRequest = await tx.tripRequest.create({
                    data: {
                        riderUserId,
                        originText: parsed.originText,
                        destinationText: parsed.destinationText,
                        earliestDesiredAt: parsed.earliestDesiredAt,
                        latestDesiredAt: parsed.latestDesiredAt,
                        distanceCategory: parsed.distanceCategory,
                        seatsNeeded: parsed.seatsNeeded,
                        status: "ACTIVE",
                    },
                });

                await tx.idempotencyKey.create({
                    data: {
                        userId: riderUserId,
                        idempotencyKey,
                        entityType: "TRIP_REQUEST",
                        tripRequestId: newTripRequest.id,
                    },
                });

                return newTripRequest;
            });
        } catch (err: unknown) {
            // Race condition: another concurrent request already stored the key.
            // The transaction rolled back, so no orphan trip request was persisted.
            // Fetch the existing mapping and return that trip request instead.
            if (isPrismaUniqueConstraintError(err)) {
                const existing = await prisma.idempotencyKey.findUnique({
                    where: {
                        userId_idempotencyKey_entityType: {
                            userId: riderUserId,
                            idempotencyKey,
                            entityType: "TRIP_REQUEST",
                        },
                    },
                    include: { tripRequest: true },
                });

                if (existing) {
                    if (!existing.tripRequest) {
                        // Corruption in race-condition path: stale idempotency key.
                        console.warn(
                            `[POST /api/trip-requests] Stale idempotency key ${idempotencyKey} (race path): tripRequest is null.`
                        );
                        return NextResponse.json(
                            {
                                error: "Gone",
                                message: "The trip request associated with this Idempotency-Key no longer exists.",
                            },
                            { status: 410 }
                        );
                    }
                    return NextResponse.json(existing.tripRequest, { status: 200 });
                }
            }

            throw err; // Re-throw unexpected errors
        }

        // 7. Return created trip request
        return NextResponse.json(tripRequest, { status: 201 });
    } catch (error) {
        console.error("[POST /api/trip-requests] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred while creating the trip request.",
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
