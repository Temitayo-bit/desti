import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * POST /api/bookings
 *
 * Creates a new booking with strict transactional seat management.
 * Requires:
 * - Valid Clerk session
 * - Idempotency-Key header
 * - body: { rideId: string, seatsBooked: number }
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Auth Guard
        const auth = await requireStetsonAuth();
        if (auth.error) return auth.error;
        const riderUserId = auth.user.clerkUserId;

        // 2. Idempotency Header
        const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
        if (!idempotencyKey) {
            return NextResponse.json(
                { error: "Bad Request", message: "Idempotency-Key header is required." },
                { status: 400 }
            );
        }

        // 3. Parse Body
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Bad Request", message: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const { rideId, seatsBooked } = body;

        // 4. Validation
        if (typeof rideId !== "string" || !rideId) {
            return NextResponse.json(
                { error: "Bad Request", message: "rideId must be a string." },
                { status: 400 }
            );
        }
        if (
            typeof seatsBooked !== "number" ||
            !Number.isInteger(seatsBooked) ||
            seatsBooked < 1 ||
            seatsBooked > 8
        ) {
            return NextResponse.json(
                { error: "Bad Request", message: "seatsBooked must be an integer between 1 and 8." },
                { status: 400 }
            );
        }

        // 5. Idempotency Check (Fast Path)
        const existingMapping = await prisma.idempotencyKey.findUnique({
            where: {
                userId_idempotencyKey_entityType: {
                    userId: riderUserId,
                    idempotencyKey,
                    entityType: "BOOKING",
                },
            },
            include: { booking: true },
        });

        if (existingMapping?.booking) {
            return NextResponse.json(existingMapping.booking, { status: 200 });
        }

        // 6. Ensure Rider Exists locally
        await prisma.user.upsert({
            where: { clerkUserId: riderUserId },
            update: { email: auth.user.primaryStetsonEmail },
            create: { clerkUserId: riderUserId, email: auth.user.primaryStetsonEmail },
        });

        // 7. Transactional Booking
        try {
            const result = await prisma.$transaction(async (tx) => {
                // A. Decrement Seats (Atomic Condition)
                // ride must be ACTIVE, future, and have enough seats.
                const now = new Date();
                const updateResult = await tx.ride.updateMany({
                    where: {
                        id: rideId,
                        status: "ACTIVE",
                        latestDepartAt: { gt: now },
                        seatsAvailable: { gte: seatsBooked },
                    },
                    data: {
                        seatsAvailable: { decrement: seatsBooked },
                    },
                });

                if (updateResult.count === 0) {
                    // Check why it failed for better error message
                    const ride = await tx.ride.findUnique({ where: { id: rideId } });
                    if (!ride) throw new Error("Ride not found.");
                    if (ride.status !== "ACTIVE") throw new Error("Ride is not active.");
                    if (ride.latestDepartAt <= now) throw new Error("Ride has departed.");
                    if (ride.seatsAvailable < seatsBooked) throw new Error("Not enough seats available.");
                    throw new Error("Unable to book ride.");
                }

                // B. Create Booking
                // This might fail if (rideId, riderUserId) unique constraint is violated (status=CONFIRMED)
                const booking = await tx.booking.create({
                    data: {
                        rideId,
                        riderUserId,
                        seatsBooked,
                        status: "CONFIRMED",
                    },
                });

                // C. Idempotency Key
                await tx.idempotencyKey.create({
                    data: {
                        userId: riderUserId,
                        idempotencyKey,
                        entityType: "BOOKING",
                        bookingId: booking.id,
                    },
                });

                return booking;
            });

            return NextResponse.json(result, { status: 201 });
        } catch (err: any) {
            // Handle known errors
            if (err.message === "Not enough seats available.") {
                return NextResponse.json({ error: "Conflict", message: err.message }, { status: 409 });
            }
            if (err.message === "Ride is not active." || err.message === "Ride has departed.") {
                return NextResponse.json({ error: "Conflict", message: err.message }, { status: 409 });
            }
            if (err.message === "Ride not found.") {
                return NextResponse.json({ error: "Not Found", message: "Ride not found." }, { status: 404 });
            }

            // Handle Prisma Unique Constraint (Double Booking Prevention or Idempotency Race)
            if (err.code === "P2002") {
                // If it's the idempotency key race
                if (err.meta?.target?.includes("idempotency_keys")) {
                    const existing = await prisma.idempotencyKey.findUnique({
                        where: {
                            userId_idempotencyKey_entityType: {
                                userId: riderUserId,
                                idempotencyKey,
                                entityType: "BOOKING",
                            },
                        },
                        include: { booking: true },
                    });
                    if (existing?.booking) {
                        return NextResponse.json(existing.booking, { status: 200 });
                    }
                }

                // If it's the booking unique constraint (rideId + riderUserId + status=CONFIRMED)
                // The error target might be dynamic due to partial index, but P2002 usually triggers.
                return NextResponse.json(
                    { error: "Conflict", message: "You already have a confirmed booking for this ride." },
                    { status: 409 }
                );
            }

            console.error("[POST /api/bookings] Transaction error:", err);
            return NextResponse.json(
                { error: "Internal Server Error", message: "Booking failed." },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("[POST /api/bookings] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
