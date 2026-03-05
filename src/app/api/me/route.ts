import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/me
 *
 * Returns the current authenticated user's profile.
 * - Enforces Clerk auth + verified @stetson.edu email
 * - Looks up or creates a local user record (idempotent via upsert)
 * - Returns: { clerkUserId, primaryVerifiedEmail, created, localUser }
 */
export async function GET(request?: NextRequest) {
    // 1. Enforce auth + authorization
    const auth = await requireStetsonAuth(
        request ?? { method: "GET", pathname: "/api/me" }
    );
    if (auth.error) return auth.error;

    const { clerkUserId, primaryStetsonEmail } = auth.user;

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { clerkUserId },
    });

    // 3. Upsert local user record (idempotent — no duplicates)
    const localUser = await prisma.user.upsert({
        where: { clerkUserId },
        update: {
            email: primaryStetsonEmail, // keep email in sync
        },
        create: {
            clerkUserId,
            email: primaryStetsonEmail,
        },
    });

    // 4. Determine if user was just created
    const created = !existingUser;

    // 5. Return safe user fields
    return NextResponse.json({
        clerkUserId: localUser.clerkUserId,
        primaryVerifiedEmail: localUser.email,
        created,
        localUser: {
            id: localUser.id,
            clerkUserId: localUser.clerkUserId,
            email: localUser.email,
            name: localUser.name,
            yearAtStetson: localUser.yearAtStetson,
            gender: localUser.gender,
            age: localUser.age,
            onboardingComplete: localUser.onboardingComplete,
            createdAt: localUser.createdAt,
            updatedAt: localUser.updatedAt,
        },
    });
}
