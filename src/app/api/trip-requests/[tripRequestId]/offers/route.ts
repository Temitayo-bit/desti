import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Validation Helpers ───────────────────────────────────────────────────────

interface ValidationError {
    field: string;
    message: string;
}

function validateOfferBody(body: Record<string, unknown>): {
    errors: ValidationError[];
    parsed: {
        seatsOffered: number;
        priceCents: number;
        message: string | null;
    } | null;
} {
    const errors: ValidationError[] = [];

    // — seatsOffered —
    const seatsRaw = body.seatsOffered;
    if (typeof seatsRaw !== "number" || !Number.isInteger(seatsRaw) || seatsRaw < 1 || seatsRaw > 8) {
        errors.push({ field: "seatsOffered", message: "seatsOffered must be a positive integer between 1 and 8." });
    }

    // — priceCents —
    const priceRaw = body.priceCents;
    if (typeof priceRaw !== "number" || !Number.isInteger(priceRaw) || priceRaw < 0) {
        errors.push({ field: "priceCents", message: "priceCents must be a non-negative integer." });
    }

    // — message (optional) —
    let message: string | null = null;
    if (body.message !== undefined && body.message !== null) {
        if (typeof body.message !== "string") {
            errors.push({ field: "message", message: "message must be a string." });
        } else {
            const trimmed = body.message.trim();
            if (trimmed.length > 500) {
                errors.push({ field: "message", message: "message must be 500 characters or fewer." });
            }
            message = trimmed || null;
        }
    }

    if (errors.length > 0) {
        return { errors, parsed: null };
    }

    return {
        errors: [],
        parsed: {
            seatsOffered: seatsRaw as number,
            priceCents: priceRaw as number,
            message,
        },
    };
}

// ── POST /api/trip-requests/:tripRequestId/offers ─────────────────────────────

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ tripRequestId: string }> }
) {
    try {
        const { tripRequestId } = await params;

        // 1. Auth guard
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;
        const driverUserId = auth.user.clerkUserId;

        // 2. Idempotency Key
        const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
        if (!idempotencyKey) {
            return NextResponse.json(
                { error: "Bad Request", message: "Idempotency-Key header is required." },
                { status: 400 }
            );
        }

        // 3. Parse Body
        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Bad Request", message: "Request body must be valid JSON." },
                { status: 400 }
            );
        }

        if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
            return NextResponse.json(
                { error: "Bad Request", message: "Request body must be a JSON object." },
                { status: 400 }
            );
        }

        const validation = validateOfferBody(rawBody as Record<string, unknown>);
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

        // 4. Idempotency Check (Fast Path)
        const existingMapping = await prisma.idempotencyKey.findUnique({
            where: {
                userId_idempotencyKey_entityType: {
                    userId: driverUserId,
                    idempotencyKey,
                    entityType: "OFFER",
                },
            },
            include: { offer: true },
        });

        if (existingMapping) {
            if (!existingMapping.offer) {
                // Corruption cleanup
                console.warn(`[POST /offers] Stale idempotency key ${idempotencyKey}. Cleaning up.`);
                await prisma.idempotencyKey.delete({ where: { id: existingMapping.id } });
            } else {
                return NextResponse.json(existingMapping.offer, { status: 200 });
            }
        }

        // 5. Business Logic Validation (TripRequest Existence & State)
        const tripRequest = await prisma.tripRequest.findUnique({
            where: { id: tripRequestId },
        });

        if (!tripRequest) {
            return NextResponse.json(
                { error: "Not Found", message: "Trip request not found." },
                { status: 404 }
            );
        }

        if (tripRequest.status !== "ACTIVE") {
            return NextResponse.json(
                { error: "Conflict", message: "Trip request is no longer active." },
                { status: 409 }
            );
        }

        // Guard: Self-offer
        if (tripRequest.riderUserId === driverUserId) {
            return NextResponse.json(
                { error: "Conflict", message: "You cannot offer a ride for your own request." },
                { status: 409 }
            );
        }

        // Guard: One active offer per driver per request
        const existingOffer = await prisma.offer.findFirst({
            where: {
                tripRequestId,
                driverUserId,
                status: {
                    in: ["PENDING", "ACCEPTED"],
                },
            },
        });

        if (existingOffer) {
            return NextResponse.json(
                { error: "Conflict", message: "You already have an active offer for this trip request." },
                { status: 409 }
            );
        }

        // 6. Ensure Local User Exists (Driver)
        await prisma.user.upsert({
            where: { clerkUserId: driverUserId },
            update: { email: auth.user.primaryStetsonEmail },
            create: { clerkUserId: driverUserId, email: auth.user.primaryStetsonEmail },
        });

        // 7. Transactional Creation
        try {
            const offer = await prisma.$transaction(async (tx) => {
                // The existingOffer check above is the optimistic guard.
                // The DB also enforces uniqueness via the partial unique index
                // "offer_active_per_driver_request" (migration 20260218000234_unique_active_offer)
                // on (trip_request_id, driver_user_id) WHERE status IN ('PENDING','ACCEPTED').
                // If a race slips past the application check, the DB constraint catches it
                // and the outer catch block maps the P2002 error to a 409 response.

                const newOffer = await tx.offer.create({
                    data: {
                        tripRequestId,
                        driverUserId,
                        riderUserId: tripRequest.riderUserId, // Denormalized for indexing
                        seatsOffered: parsed.seatsOffered,
                        priceCents: parsed.priceCents,
                        message: parsed.message,
                        status: "PENDING",
                    },
                });

                await tx.idempotencyKey.create({
                    data: {
                        userId: driverUserId,
                        idempotencyKey,
                        entityType: "OFFER",
                        offerId: newOffer.id,
                    },
                });

                return newOffer;
            });

            return NextResponse.json(offer, { status: 201 });

        } catch (err: unknown) {
            // Handle P2002 Race Condition
            if (
                typeof err === "object" &&
                err !== null &&
                "code" in err &&
                (err as { code: string }).code === "P2002"
            ) {
                const meta = (err as any).meta;
                // 1. Partial Unique Index Violation (Active Offer)
                if (meta?.target && (
                    meta.target === "offer_active_per_driver_request" ||
                    (Array.isArray(meta.target) && meta.target.includes("offer_active_per_driver_request"))
                )) {
                    return NextResponse.json(
                        { error: "Conflict", message: "You already have an active offer for this trip request." },
                        { status: 409 }
                    );
                }

                // 2. Idempotency Key Violation
                const retryExisting = await prisma.idempotencyKey.findUnique({
                    where: {
                        userId_idempotencyKey_entityType: {
                            userId: driverUserId,
                            idempotencyKey,
                            entityType: "OFFER",
                        },
                    },
                    include: { offer: true },
                });

                if (retryExisting?.offer) {
                    return NextResponse.json(retryExisting.offer, { status: 200 });
                }
            }
            throw err;
        }

    } catch (error) {
        console.error("[POST /api/trip-requests/:id/offers] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
