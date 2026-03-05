import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DistanceCategory, BookingStatus } from "@prisma/client";

const VALID_DISTANCE_CATEGORIES: ReadonlySet<string> = new Set(
    Object.values(DistanceCategory)
);
const MAX_DEPARTURE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const CLOCK_SKEW_GRACE_MS = 10 * 60 * 1000; // 10 minutes

const ALLOWED_UPDATE_FIELDS = new Set([
    "originText",
    "destinationText",
    "earliestDepartAt",
    "latestDepartAt",
    "preferredDepartAt",
    "distanceCategory",
    "priceCents",
    "seatsTotal",
    "pickupInstructions",
    "dropoffInstructions"
]);

interface ValidationError {
    field: string;
    message: string;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ rideId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const resolvedParams = await params;
        const rideId = resolvedParams.rideId;

        const ride = await prisma.ride.findUnique({
            where: { id: rideId },
            include: { bookings: { where: { status: BookingStatus.CONFIRMED }, take: 1 } }
        });

        if (!ride) {
            return NextResponse.json(
                { error: "Not Found", message: "Ride not found." },
                { status: 404 }
            );
        }

        if (ride.driverUserId !== auth.user.clerkUserId) {
            return NextResponse.json(
                { error: "Forbidden", message: "You don't own this ride." },
                { status: 403 }
            );
        }

        if (ride.bookings.length > 0) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: "RIDE_EDIT_LOCKED_CONFIRMED",
                    message: "Ride can’t be edited after it has a confirmed booking. Cancel it instead."
                },
                { status: 409 }
            );
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
            if (typeof body !== "object" || body === null || Array.isArray(body)) {
                throw new Error("Invalid format");
            }
        } catch {
            return NextResponse.json(
                { error: "Bad Request", message: "Request body must be a JSON object." },
                { status: 400 }
            );
        }

        const unknownKeys = Object.keys(body).filter(key => !ALLOWED_UPDATE_FIELDS.has(key));
        if (unknownKeys.length > 0) {
            return NextResponse.json(
                { error: "Bad Request", message: `Unknown fields are not allowed: ${unknownKeys.join(", ")}` },
                { status: 400 }
            );
        }

        const errors: ValidationError[] = [];

        let finalOriginText = ride.originText;
        if (body.originText !== undefined) {
            const val = body.originText;
            if (typeof val !== "string") {
                errors.push({ field: "originText", message: "Must be a string." });
            } else {
                finalOriginText = val.trim();
                if (finalOriginText.length < 3 || finalOriginText.length > 200) {
                    errors.push({ field: "originText", message: "Must be between 3 and 200 characters after trimming." });
                }
            }
        }

        let finalDestinationText = ride.destinationText;
        if (body.destinationText !== undefined) {
            const val = body.destinationText;
            if (typeof val !== "string") {
                errors.push({ field: "destinationText", message: "Must be a string." });
            } else {
                finalDestinationText = val.trim();
                if (finalDestinationText.length < 3 || finalDestinationText.length > 200) {
                    errors.push({ field: "destinationText", message: "Must be between 3 and 200 characters after trimming." });
                }
            }
        }

        let finalEarliestDepartAt = ride.earliestDepartAt;
        if (body.earliestDepartAt !== undefined) {
            const val = body.earliestDepartAt;
            if (typeof val !== "string" || !val) {
                errors.push({ field: "earliestDepartAt", message: "Must be an ISO datetime string." });
            } else {
                const date = new Date(val);
                if (isNaN(date.getTime())) {
                    errors.push({ field: "earliestDepartAt", message: "Must be a valid ISO datetime." });
                } else {
                    finalEarliestDepartAt = date;
                }
            }
        }

        let finalLatestDepartAt = ride.latestDepartAt;
        if (body.latestDepartAt !== undefined) {
            const val = body.latestDepartAt;
            if (typeof val !== "string" || !val) {
                errors.push({ field: "latestDepartAt", message: "Must be an ISO datetime string." });
            } else {
                const date = new Date(val);
                if (isNaN(date.getTime())) {
                    errors.push({ field: "latestDepartAt", message: "Must be a valid ISO datetime." });
                } else {
                    finalLatestDepartAt = date;
                }
            }
        }

        if (finalEarliestDepartAt && finalLatestDepartAt) {
            if (finalLatestDepartAt.getTime() <= finalEarliestDepartAt.getTime()) {
                errors.push({ field: "latestDepartAt", message: "latestDepartAt must be strictly after earliestDepartAt." });
            } else {
                const windowMs = finalLatestDepartAt.getTime() - finalEarliestDepartAt.getTime();
                if (windowMs > MAX_DEPARTURE_WINDOW_MS) {
                    errors.push({ field: "latestDepartAt", message: "Departure window must be 48 hours or less." });
                }
            }
        }

        if (body.earliestDepartAt !== undefined && finalEarliestDepartAt) {
            const graceThreshold = Date.now() - CLOCK_SKEW_GRACE_MS;
            if (finalEarliestDepartAt.getTime() < graceThreshold) {
                errors.push({ field: "earliestDepartAt", message: "earliestDepartAt must not be in the past (10-minute grace allowed)." });
            }
        }

        let finalPreferredDepartAt = ride.preferredDepartAt;
        if (body.preferredDepartAt !== undefined) {
            const val = body.preferredDepartAt;
            if (val === null) {
                finalPreferredDepartAt = null;
            } else if (typeof val !== "string") {
                errors.push({ field: "preferredDepartAt", message: "Must be an ISO datetime string or null." });
            } else {
                const date = new Date(val);
                if (isNaN(date.getTime())) {
                    errors.push({ field: "preferredDepartAt", message: "Must be a valid ISO datetime." });
                } else {
                    finalPreferredDepartAt = date;
                }
            }
        }

        if (finalPreferredDepartAt && finalEarliestDepartAt && finalLatestDepartAt) {
            if (finalPreferredDepartAt.getTime() < finalEarliestDepartAt.getTime()) {
                errors.push({ field: "preferredDepartAt", message: "preferredDepartAt must not be before earliestDepartAt." });
            } else if (finalPreferredDepartAt.getTime() > finalLatestDepartAt.getTime()) {
                errors.push({ field: "preferredDepartAt", message: "preferredDepartAt must not be after latestDepartAt." });
            }
        }

        let finalDistanceCategory = ride.distanceCategory;
        if (body.distanceCategory !== undefined) {
            const val = body.distanceCategory;
            if (typeof val !== "string" || !VALID_DISTANCE_CATEGORIES.has(val)) {
                errors.push({ field: "distanceCategory", message: "distanceCategory must be one of SHORT, MEDIUM, or LONG." });
            } else {
                finalDistanceCategory = val as DistanceCategory;
            }
        }

        let finalPriceCents = ride.priceCents;
        if (body.priceCents !== undefined) {
            const val = body.priceCents;
            if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
                errors.push({ field: "priceCents", message: "priceCents must be a non-negative integer." });
            } else {
                finalPriceCents = val;
            }
        }

        let finalSeatsTotal = ride.seatsTotal;
        if (body.seatsTotal !== undefined) {
            const val = body.seatsTotal;
            if (typeof val !== "number" || !Number.isInteger(val) || val < 1 || val > 8) {
                errors.push({ field: "seatsTotal", message: "seatsTotal must be an integer between 1 and 8." });
            } else {
                finalSeatsTotal = val;
            }
        }

        let finalPickupInstructions = ride.pickupInstructions;
        if (body.pickupInstructions !== undefined) {
            const val = body.pickupInstructions;
            if (val === null) {
                finalPickupInstructions = null;
            } else if (typeof val !== "string") {
                errors.push({ field: "pickupInstructions", message: "Must be a string or null." });
            } else {
                const trimmed = val.trim();
                if (trimmed.length === 0) {
                    errors.push({ field: "pickupInstructions", message: "Must not be empty after trimming." });
                } else if (trimmed.length > 500) {
                    errors.push({ field: "pickupInstructions", message: "Must be 500 characters or fewer." });
                } else {
                    finalPickupInstructions = trimmed;
                }
            }
        }

        let finalDropoffInstructions = ride.dropoffInstructions;
        if (body.dropoffInstructions !== undefined) {
            const val = body.dropoffInstructions;
            if (val === null) {
                finalDropoffInstructions = null;
            } else if (typeof val !== "string") {
                errors.push({ field: "dropoffInstructions", message: "Must be a string or null." });
            } else {
                const trimmed = val.trim();
                if (trimmed.length === 0) {
                    errors.push({ field: "dropoffInstructions", message: "Must not be empty after trimming." });
                } else if (trimmed.length > 500) {
                    errors.push({ field: "dropoffInstructions", message: "Must be 500 characters or fewer." });
                } else {
                    finalDropoffInstructions = trimmed;
                }
            }
        }

        if (errors.length > 0) {
            return NextResponse.json(
                {
                    error: "Validation Error",
                    message: "One or more fields are invalid.",
                    details: errors
                },
                { status: 400 }
            );
        }

        let finalSeatsAvailable = ride.seatsAvailable;
        if (body.seatsTotal !== undefined && body.seatsTotal !== ride.seatsTotal) {
            finalSeatsAvailable = finalSeatsTotal;
        }

        try {
            const [updateResult, transUpdatedRide] = await prisma.$transaction([
                prisma.ride.updateMany({
                    where: {
                        id: rideId,
                        bookings: { none: { status: BookingStatus.CONFIRMED } }
                    },
                    data: {
                        originText: finalOriginText,
                        destinationText: finalDestinationText,
                        earliestDepartAt: finalEarliestDepartAt,
                        latestDepartAt: finalLatestDepartAt,
                        preferredDepartAt: finalPreferredDepartAt,
                        distanceCategory: finalDistanceCategory,
                        priceCents: finalPriceCents,
                        seatsTotal: finalSeatsTotal,
                        seatsAvailable: finalSeatsAvailable,
                        pickupInstructions: finalPickupInstructions,
                        dropoffInstructions: finalDropoffInstructions
                    }
                }),
                prisma.ride.findUnique({
                    where: { id: rideId }
                })
            ]);

            if (updateResult.count === 0) {
                if (!transUpdatedRide) {
                    return NextResponse.json(
                        { error: "Not Found", message: "Ride not found." },
                        { status: 404 }
                    );
                }
                return NextResponse.json(
                    {
                        error: "Conflict",
                        code: "RIDE_EDIT_LOCKED_CONFIRMED",
                        message: "Ride can’t be edited after it has a confirmed booking. Cancel it instead."
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json(transUpdatedRide, { status: 200 });
        } catch (updateError: any) {
            console.error("[PATCH /api/rides/:rideId] Unexpected error during update:", updateError);
            throw updateError;
        }

    } catch (error) {
        console.error("[PATCH /api/rides/:rideId] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred while updating the ride." },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ rideId: string }> }
) {
    // TODO: Implement the ride cancellation logic
    // - Ensure the user is the driver
    // - Check for active bookings
    // - Mark the ride as cancelled or delete it
    // - Notify riders

    return NextResponse.json(
        { message: "TODO: Ride cancellation endpoint is not yet implemented." },
        { status: 501 }
    );
}
