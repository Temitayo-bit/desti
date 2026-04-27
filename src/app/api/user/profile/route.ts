import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    ONBOARDING_GENDER_VALUES,
    ONBOARDING_MAX_AGE,
    ONBOARDING_MIN_AGE,
    ONBOARDING_YEAR_VALUES,
    type OnboardingGenderValue,
    type OnboardingYearValue,
} from "@/lib/onboarding-schema";

export async function GET(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { clerkUserId } = auth.user;

        const localUser = await prisma.user.findUnique({
            where: { clerkUserId },
        });

        if (!localUser) {
            return NextResponse.json(
                { error: "Not Found", message: "User not found." },
                { status: 404 }
            );
        }

        // Stats: rides given
        const ridesGiven = await prisma.booking.count({
            where: {
                driverUserId: clerkUserId,
                status: "COMPLETED",
            },
        });

        // Stats: rides taken
        const ridesTaken = await prisma.booking.count({
            where: {
                riderUserId: clerkUserId,
                status: "COMPLETED",
            },
        });

        // Stats: ratings
        const ratingsResult = await prisma.rating.aggregate({
            _avg: {
                score: true,
            },
            _count: {
                id: true,
            },
            where: {
                rateeUserId: clerkUserId,
            },
        });

        const ratingCount = ratingsResult._count.id;
        const ratingAvg = ratingsResult._avg.score ? Number(ratingsResult._avg.score.toFixed(1)) : 0;

        // Vehicle info: Most recent ride posted by this user
        const latestRide = await prisma.ride.findFirst({
            where: {
                driverUserId: clerkUserId,
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                vehicleType: true,
                hasAc: true,
                hasTrunkSpace: true,
                musicPreference: true,
            },
        });

        return NextResponse.json({
            user: {
                id: localUser.id,
                clerkUserId: localUser.clerkUserId,
                email: localUser.email,
                name: localUser.name,
                yearAtStetson: localUser.yearAtStetson,
                gender: localUser.gender,
                age: localUser.age,
                bio: localUser.bio,
                profilePictureUrl: localUser.profilePictureUrl,
                onboardingComplete: localUser.onboardingComplete,
                createdAt: localUser.createdAt,
            },
            stats: {
                ridesGiven,
                ridesTaken,
                ratingAvg,
                ratingCount,
            },
            vehicle: latestRide || null,
        });
    } catch (error) {
        console.error("[GET /api/user/profile] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        const { clerkUserId } = auth.user;
        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Bad Request", message: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const dataToUpdate: any = {};
        const fieldErrors: { field: string; message: string }[] = [];

        if (body.name !== undefined) {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            if (name.length < 2 || name.length > 80) {
                fieldErrors.push({ field: "name", message: "name must be between 2 and 80 characters." });
            } else {
                dataToUpdate.name = name;
            }
        }

        if (body.age !== undefined) {
            if (typeof body.age !== "number" || !Number.isInteger(body.age) || body.age < ONBOARDING_MIN_AGE || body.age > ONBOARDING_MAX_AGE) {
                fieldErrors.push({ field: "age", message: "age must be an integer between 16 and 100." });
            } else {
                dataToUpdate.age = body.age;
            }
        }

        if (body.yearAtStetson !== undefined) {
            if (!ONBOARDING_YEAR_VALUES.includes(body.yearAtStetson as OnboardingYearValue)) {
                fieldErrors.push({ field: "yearAtStetson", message: `yearAtStetson must be valid.` });
            } else {
                dataToUpdate.yearAtStetson = body.yearAtStetson;
            }
        }

        if (body.gender !== undefined) {
            if (!ONBOARDING_GENDER_VALUES.includes(body.gender as OnboardingGenderValue)) {
                fieldErrors.push({ field: "gender", message: `gender must be valid.` });
            } else {
                dataToUpdate.gender = body.gender;
            }
        }

        if (body.bio !== undefined) {
            const bio = typeof body.bio === "string" ? body.bio.trim() : null;
            if (bio && bio.length > 500) {
                fieldErrors.push({ field: "bio", message: "bio must be 500 characters or less." });
            } else {
                dataToUpdate.bio = bio;
            }
        }

        if (body.profilePictureUrl !== undefined) {
            if (body.profilePictureUrl !== null && typeof body.profilePictureUrl !== "string") {
                fieldErrors.push({ field: "profilePictureUrl", message: "profilePictureUrl must be a string or null." });
            } else {
                dataToUpdate.profilePictureUrl = body.profilePictureUrl;
            }
        }

        if (fieldErrors.length > 0) {
            return NextResponse.json(
                { error: "Bad Request", message: "Validation failed.", fieldErrors },
                { status: 400 }
            );
        }

        const updatedUser = await prisma.user.update({
            where: { clerkUserId },
            data: dataToUpdate,
            select: {
                id: true,
                name: true,
                age: true,
                yearAtStetson: true,
                gender: true,
                bio: true,
                profilePictureUrl: true,
            },
        });

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        console.error("[PATCH /api/user/profile] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
