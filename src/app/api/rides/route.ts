import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DistanceCategory } from "@/generated/prisma/client";

// ── Constants ────────────────────────────────────────────────────────────────
const VALID_DISTANCE_CATEGORIES: ReadonlySet<string> = new Set(
    Object.values(DistanceCategory)
);
const MAX_DEPARTURE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const CLOCK_SKEW_GRACE_MS = 10 * 60 * 1000; // 10 minutes

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
                driverUserId_idempotencyKey: {
                    driverUserId,
                    idempotencyKey,
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
                        status: "ACTIVE",
                    },
                });

                await tx.idempotencyKey.create({
                    data: {
                        driverUserId,
                        idempotencyKey,
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
                        driverUserId_idempotencyKey: {
                            driverUserId,
                            idempotencyKey,
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
