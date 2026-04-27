import { NextRequest, NextResponse } from "next/server";
import {
    BookingStatus,
    DistanceCategory,
} from "@prisma/client";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    assertDistinctResolvedLocationsOrThrow,
    GeocodingError,
    resolveLocationOrThrow,
} from "@/lib/geocoding";

const VALID_DISTANCE_CATEGORIES: ReadonlySet<string> = new Set(
    Object.values(DistanceCategory)
);
const MAX_DESIRED_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const CLOCK_SKEW_GRACE_MS = 10 * 60 * 1000; // 10 minutes

const TRIP_REQUEST_EDIT_LOCKED_CONFIRMED_CODE =
    "TRIP_REQUEST_EDIT_LOCKED_CONFIRMED";
const TRIP_REQUEST_EDIT_LOCKED_CONFIRMED_MESSAGE =
    "Trip request can’t be edited after it has a confirmed booking. Cancel instead.";
const TRIP_REQUEST_CLOSED_CODE = "TRIP_REQUEST_CLOSED";
const TRIP_REQUEST_CLOSED_MESSAGE =
    "Trip request cannot be edited because it is no longer active.";
const EDITABLE_STATUS = "ACTIVE";

const ALLOWED_UPDATE_FIELDS = new Set([
    "originText",
    "destinationText",
    "earliestDesiredAt",
    "latestDesiredAt",
    "preferredDepartAt",
    "distanceCategory",
    "seatsNeeded",
    "pickupInstructions",
    "dropoffInstructions",
]);

interface ValidationError {
    field: string;
    message: string;
}

function geocodingErrorResponse(
    field: "originText" | "destinationText",
    error: unknown
) {
    if (error instanceof GeocodingError) {
        if (
            error.code === "PROVIDER_FAILURE" ||
            error.code === "PROVIDER_TIMEOUT"
        ) {
            console.error(
                `[PATCH /api/trip-requests/:tripRequestId] Geocoding provider failure for ${field}:`,
                error
            );
            return NextResponse.json(
                {
                    error: "Service Unavailable",
                    message:
                        "Location lookup is temporarily unavailable. Please try again.",
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            {
                error: "Validation Error",
                message: "One or more fields are invalid.",
                details: [{ field, message: error.message }],
            },
            { status: 400 }
        );
    }

    console.error(
        `[PATCH /api/trip-requests/:tripRequestId] Unexpected geocoding error for ${field}:`,
        error
    );
    return NextResponse.json(
        {
            error: "Service Unavailable",
            message: "Location lookup is temporarily unavailable. Please try again.",
        },
        { status: 503 }
    );
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ tripRequestId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { tripRequestId } = await params;
        const riderUserId = auth.user.clerkUserId;

        const tripRequest = await prisma.tripRequest.findUnique({
            where: { id: tripRequestId },
            include: {
                bookings: {
                    where: { status: BookingStatus.CONFIRMED },
                    take: 1,
                },
            },
        });

        if (!tripRequest) {
            return NextResponse.json(
                { error: "Not Found", message: "Trip request not found." },
                { status: 404 }
            );
        }

        if (tripRequest.riderUserId !== riderUserId) {
            return NextResponse.json(
                { error: "Forbidden", message: "You don't own this trip request." },
                { status: 403 }
            );
        }

        const currentStatus = tripRequest.status as string;
        if (currentStatus !== EDITABLE_STATUS) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: TRIP_REQUEST_CLOSED_CODE,
                    message: TRIP_REQUEST_CLOSED_MESSAGE,
                },
                { status: 409 }
            );
        }

        if (tripRequest.bookings.length > 0) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: TRIP_REQUEST_EDIT_LOCKED_CONFIRMED_CODE,
                    message: TRIP_REQUEST_EDIT_LOCKED_CONFIRMED_MESSAGE,
                },
                { status: 409 }
            );
        }

        const previousUpdatedAt = tripRequest.updatedAt;

        let body: Record<string, unknown>;
        try {
            const parsed = await request.json();
            if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
            ) {
                throw new Error("invalid-format");
            }
            body = parsed as Record<string, unknown>;
        } catch {
            return NextResponse.json(
                { error: "Bad Request", message: "Request body must be a JSON object." },
                { status: 400 }
            );
        }

        const unknownKeys = Object.keys(body).filter(
            (key) => !ALLOWED_UPDATE_FIELDS.has(key)
        );
        if (unknownKeys.length > 0) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    message: `Unknown fields are not allowed: ${unknownKeys.join(", ")}`,
                },
                { status: 400 }
            );
        }

        const errors: ValidationError[] = [];

        let finalOriginText = tripRequest.originText;
        if (body.originText !== undefined) {
            const value = body.originText;
            if (typeof value !== "string") {
                errors.push({ field: "originText", message: "Must be a string." });
            } else {
                finalOriginText = value.trim();
                if (finalOriginText.length < 3 || finalOriginText.length > 200) {
                    errors.push({
                        field: "originText",
                        message:
                            "Must be between 3 and 200 characters after trimming.",
                    });
                }
            }
        }

        let finalDestinationText = tripRequest.destinationText;
        if (body.destinationText !== undefined) {
            const value = body.destinationText;
            if (typeof value !== "string") {
                errors.push({ field: "destinationText", message: "Must be a string." });
            } else {
                finalDestinationText = value.trim();
                if (
                    finalDestinationText.length < 3 ||
                    finalDestinationText.length > 200
                ) {
                    errors.push({
                        field: "destinationText",
                        message:
                            "Must be between 3 and 200 characters after trimming.",
                    });
                }
            }
        }

        let finalEarliestDesiredAt = tripRequest.earliestDesiredAt;
        if (body.earliestDesiredAt !== undefined) {
            const value = body.earliestDesiredAt;
            if (typeof value !== "string" || !value) {
                errors.push({
                    field: "earliestDesiredAt",
                    message: "Must be an ISO datetime string.",
                });
            } else {
                const parsedDate = new Date(value);
                if (isNaN(parsedDate.getTime())) {
                    errors.push({
                        field: "earliestDesiredAt",
                        message: "Must be a valid ISO datetime.",
                    });
                } else {
                    finalEarliestDesiredAt = parsedDate;
                }
            }
        }

        let finalLatestDesiredAt = tripRequest.latestDesiredAt;
        if (body.latestDesiredAt !== undefined) {
            const value = body.latestDesiredAt;
            if (typeof value !== "string" || !value) {
                errors.push({
                    field: "latestDesiredAt",
                    message: "Must be an ISO datetime string.",
                });
            } else {
                const parsedDate = new Date(value);
                if (isNaN(parsedDate.getTime())) {
                    errors.push({
                        field: "latestDesiredAt",
                        message: "Must be a valid ISO datetime.",
                    });
                } else {
                    finalLatestDesiredAt = parsedDate;
                }
            }
        }

        let finalPreferredDepartAt = tripRequest.preferredDepartAt;
        if (body.preferredDepartAt !== undefined) {
            const value = body.preferredDepartAt;
            if (value === null) {
                finalPreferredDepartAt = null;
            } else if (typeof value !== "string") {
                errors.push({
                    field: "preferredDepartAt",
                    message: "Must be an ISO datetime string or null.",
                });
            } else {
                const parsedDate = new Date(value);
                if (isNaN(parsedDate.getTime())) {
                    errors.push({
                        field: "preferredDepartAt",
                        message: "Must be a valid ISO datetime.",
                    });
                } else {
                    finalPreferredDepartAt = parsedDate;
                }
            }
        }

        let finalDistanceCategory = tripRequest.distanceCategory;
        if (body.distanceCategory !== undefined) {
            const value = body.distanceCategory;
            if (
                typeof value !== "string" ||
                !VALID_DISTANCE_CATEGORIES.has(value)
            ) {
                errors.push({
                    field: "distanceCategory",
                    message:
                        "distanceCategory must be one of SHORT, MEDIUM, or LONG.",
                });
            } else {
                finalDistanceCategory = value as DistanceCategory;
            }
        }

        let finalSeatsNeeded = tripRequest.seatsNeeded;
        if (body.seatsNeeded !== undefined) {
            const value = body.seatsNeeded;
            if (
                typeof value !== "number" ||
                !Number.isInteger(value) ||
                value < 1 ||
                value > 8
            ) {
                errors.push({
                    field: "seatsNeeded",
                    message: "seatsNeeded must be an integer between 1 and 8.",
                });
            } else {
                finalSeatsNeeded = value;
            }
        }

        let finalPickupInstructions = tripRequest.pickupInstructions;
        if (body.pickupInstructions !== undefined) {
            const value = body.pickupInstructions;
            if (value === null) {
                finalPickupInstructions = null;
            } else if (typeof value !== "string") {
                errors.push({
                    field: "pickupInstructions",
                    message: "pickupInstructions must be a string.",
                });
            } else {
                const trimmed = value.trim();
                if (trimmed.length === 0) {
                    errors.push({
                        field: "pickupInstructions",
                        message:
                            "pickupInstructions must not be empty after trimming.",
                    });
                } else if (trimmed.length > 500) {
                    errors.push({
                        field: "pickupInstructions",
                        message:
                            "pickupInstructions must be 500 characters or fewer.",
                    });
                } else {
                    finalPickupInstructions = trimmed;
                }
            }
        }

        let finalDropoffInstructions = tripRequest.dropoffInstructions;
        if (body.dropoffInstructions !== undefined) {
            const value = body.dropoffInstructions;
            if (value === null) {
                finalDropoffInstructions = null;
            } else if (typeof value !== "string") {
                errors.push({
                    field: "dropoffInstructions",
                    message: "dropoffInstructions must be a string.",
                });
            } else {
                const trimmed = value.trim();
                if (trimmed.length === 0) {
                    errors.push({
                        field: "dropoffInstructions",
                        message:
                            "dropoffInstructions must not be empty after trimming.",
                    });
                } else if (trimmed.length > 500) {
                    errors.push({
                        field: "dropoffInstructions",
                        message:
                            "dropoffInstructions must be 500 characters or fewer.",
                    });
                } else {
                    finalDropoffInstructions = trimmed;
                }
            }
        }

        if (finalLatestDesiredAt.getTime() <= finalEarliestDesiredAt.getTime()) {
            errors.push({
                field: "latestDesiredAt",
                message:
                    "latestDesiredAt must be strictly after earliestDesiredAt.",
            });
        } else {
            const desiredWindowMs =
                finalLatestDesiredAt.getTime() - finalEarliestDesiredAt.getTime();
            if (desiredWindowMs > MAX_DESIRED_WINDOW_MS) {
                errors.push({
                    field: "latestDesiredAt",
                    message: "Desired window must be 48 hours or less.",
                });
            }
        }

        const graceThresholdMs = Date.now() - CLOCK_SKEW_GRACE_MS;
        if (finalEarliestDesiredAt.getTime() < graceThresholdMs) {
            errors.push({
                field: "earliestDesiredAt",
                message:
                    "earliestDesiredAt must not be in the past (10-minute grace allowed).",
            });
        }

        if (finalPreferredDepartAt) {
            if (finalPreferredDepartAt.getTime() < finalEarliestDesiredAt.getTime()) {
                errors.push({
                    field: "preferredDepartAt",
                    message:
                        "preferredDepartAt must not be before earliestDesiredAt.",
                });
            } else if (
                finalPreferredDepartAt.getTime() > finalLatestDesiredAt.getTime()
            ) {
                errors.push({
                    field: "preferredDepartAt",
                    message: "preferredDepartAt must not be after latestDesiredAt.",
                });
            }
        }

        if (errors.length > 0) {
            return NextResponse.json(
                {
                    error: "Validation Error",
                    message: "One or more fields are invalid.",
                    details: errors,
                },
                { status: 400 }
            );
        }

        const originTextChanged =
            body.originText !== undefined &&
            finalOriginText !== tripRequest.originText;
        const destinationTextChanged =
            body.destinationText !== undefined &&
            finalDestinationText !== tripRequest.destinationText;

        let finalOriginResolvedAddress = tripRequest.originResolvedAddress ?? null;
        let finalOriginLatitude = tripRequest.originLatitude ?? null;
        let finalOriginLongitude = tripRequest.originLongitude ?? null;
        let finalDestinationResolvedAddress =
            tripRequest.destinationResolvedAddress ?? null;
        let finalDestinationLatitude = tripRequest.destinationLatitude ?? null;
        let finalDestinationLongitude = tripRequest.destinationLongitude ?? null;

        if (originTextChanged) {
            let originLocation: Awaited<ReturnType<typeof resolveLocationOrThrow>>;
            try {
                originLocation = await resolveLocationOrThrow(finalOriginText);
            } catch (error) {
                return geocodingErrorResponse("originText", error);
            }

            finalOriginText = originLocation.inputText;
            finalOriginResolvedAddress = originLocation.resolvedAddress;
            finalOriginLatitude = originLocation.latitude;
            finalOriginLongitude = originLocation.longitude;
        }

        if (destinationTextChanged) {
            let destinationLocation: Awaited<
                ReturnType<typeof resolveLocationOrThrow>
            >;
            try {
                destinationLocation = await resolveLocationOrThrow(
                    finalDestinationText
                );
            } catch (error) {
                return geocodingErrorResponse("destinationText", error);
            }

            finalDestinationText = destinationLocation.inputText;
            finalDestinationResolvedAddress = destinationLocation.resolvedAddress;
            finalDestinationLatitude = destinationLocation.latitude;
            finalDestinationLongitude = destinationLocation.longitude;
        }

        if (
            finalOriginLatitude !== null &&
            finalOriginLongitude !== null &&
            finalDestinationLatitude !== null &&
            finalDestinationLongitude !== null
        ) {
            try {
                assertDistinctResolvedLocationsOrThrow(
                    {
                        latitude: finalOriginLatitude,
                        longitude: finalOriginLongitude,
                    },
                    {
                        latitude: finalDestinationLatitude,
                        longitude: finalDestinationLongitude,
                    }
                );
            } catch (error) {
                return geocodingErrorResponse("destinationText", error);
            }
        }

        const [updateResult, maybeUpdatedTripRequest] = await prisma.$transaction([
            prisma.tripRequest.updateMany({
                where: {
                    id: tripRequestId,
                    riderUserId,
                    status: EDITABLE_STATUS,
                    updatedAt: previousUpdatedAt,
                    bookings: { none: { status: BookingStatus.CONFIRMED } },
                },
                data: {
                    originText: finalOriginText,
                    originResolvedAddress: finalOriginResolvedAddress,
                    originLatitude: finalOriginLatitude,
                    originLongitude: finalOriginLongitude,
                    destinationText: finalDestinationText,
                    destinationResolvedAddress:
                        finalDestinationResolvedAddress,
                    destinationLatitude: finalDestinationLatitude,
                    destinationLongitude: finalDestinationLongitude,
                    earliestDesiredAt: finalEarliestDesiredAt,
                    latestDesiredAt: finalLatestDesiredAt,
                    preferredDepartAt: finalPreferredDepartAt,
                    distanceCategory: finalDistanceCategory,
                    seatsNeeded: finalSeatsNeeded,
                    pickupInstructions: finalPickupInstructions,
                    dropoffInstructions: finalDropoffInstructions,
                },
            }),
            prisma.tripRequest.findUnique({
                where: { id: tripRequestId },
                include: {
                    bookings: {
                        where: { status: BookingStatus.CONFIRMED },
                        take: 1,
                    },
                },
            }),
        ]);

        if (updateResult.count === 0) {
            if (!maybeUpdatedTripRequest) {
                return NextResponse.json(
                    { error: "Not Found", message: "Trip request not found." },
                    { status: 404 }
                );
            }

            if (maybeUpdatedTripRequest.riderUserId !== riderUserId) {
                return NextResponse.json(
                    { error: "Forbidden", message: "You don't own this trip request." },
                    { status: 403 }
                );
            }

            const latestStatus = maybeUpdatedTripRequest.status as string;
            if (latestStatus !== EDITABLE_STATUS) {
                return NextResponse.json(
                    {
                        error: "Conflict",
                        code: TRIP_REQUEST_CLOSED_CODE,
                        message: TRIP_REQUEST_CLOSED_MESSAGE,
                    },
                    { status: 409 }
                );
            }

            if (maybeUpdatedTripRequest.bookings.length > 0) {
                return NextResponse.json(
                    {
                        error: "Conflict",
                        code: TRIP_REQUEST_EDIT_LOCKED_CONFIRMED_CODE,
                        message: TRIP_REQUEST_EDIT_LOCKED_CONFIRMED_MESSAGE,
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                {
                    error: "Conflict",
                    message: "Trip request update could not be completed.",
                },
                { status: 409 }
            );
        }

        if (!maybeUpdatedTripRequest) {
            return NextResponse.json(
                { error: "Not Found", message: "Trip request not found." },
                { status: 404 }
            );
        }

        const responseTripRequest = { ...maybeUpdatedTripRequest } as {
            bookings?: unknown;
        };
        delete responseTripRequest.bookings;
        return NextResponse.json(responseTripRequest, { status: 200 });
    } catch (error) {
        console.error(
            "[PATCH /api/trip-requests/:tripRequestId] Unexpected error:",
            error
        );
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message:
                    "An unexpected error occurred while updating the trip request.",
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ tripRequestId: string }> }
) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { tripRequestId } = await params;
        const riderUserId = auth.user.clerkUserId;

        const tripRequest = await prisma.tripRequest.findUnique({
            where: { id: tripRequestId },
        });

        if (!tripRequest) {
            return NextResponse.json(
                { error: "Not Found", message: "Trip request not found." },
                { status: 404 }
            );
        }

        if (tripRequest.riderUserId !== riderUserId) {
            return NextResponse.json(
                { error: "Forbidden", message: "You don't own this trip request." },
                { status: 403 }
            );
        }

        const currentStatus = tripRequest.status as string;
        if (currentStatus !== EDITABLE_STATUS) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: TRIP_REQUEST_CLOSED_CODE,
                    message: TRIP_REQUEST_CLOSED_MESSAGE,
                },
                { status: 409 }
            );
        }

        const updateResult = await prisma.tripRequest.updateMany({
            where: {
                id: tripRequestId,
                riderUserId,
                status: EDITABLE_STATUS,
            },
            data: { status: "CANCELLED" },
        });

        if (updateResult.count === 0) {
            const maybeUpdatedTripRequest = await prisma.tripRequest.findUnique({
                where: { id: tripRequestId },
            });

            if (!maybeUpdatedTripRequest) {
                return NextResponse.json(
                    { error: "Not Found", message: "Trip request not found." },
                    { status: 404 }
                );
            }

            if (maybeUpdatedTripRequest.riderUserId !== riderUserId) {
                return NextResponse.json(
                    { error: "Forbidden", message: "You don't own this trip request." },
                    { status: 403 }
                );
            }

            const latestStatus = maybeUpdatedTripRequest.status as string;
            if (latestStatus !== EDITABLE_STATUS) {
                return NextResponse.json(
                    {
                        error: "Conflict",
                        code: TRIP_REQUEST_CLOSED_CODE,
                        message: TRIP_REQUEST_CLOSED_MESSAGE,
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                {
                    error: "Conflict",
                    message: "Trip request cancellation could not be completed.",
                },
                { status: 409 }
            );
        }

        const updatedTripRequest = await prisma.tripRequest.findUnique({
            where: { id: tripRequestId },
        });

        if (!updatedTripRequest) {
            return NextResponse.json(
                { error: "Not Found", message: "Trip request not found." },
                { status: 404 }
            );
        }

        const responseTripRequest = { ...updatedTripRequest } as {
            bookings?: unknown;
        };
        delete responseTripRequest.bookings;

        return NextResponse.json(responseTripRequest, { status: 200 });
    } catch (error) {
        console.error(
            "[DELETE /api/trip-requests/:tripRequestId] Unexpected error:",
            error
        );
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message:
                    "An unexpected error occurred while cancelling the trip request.",
            },
            { status: 500 }
        );
    }
}
