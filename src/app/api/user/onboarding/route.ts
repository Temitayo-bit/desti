import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    ONBOARDING_GENDER_VALUES,
    ONBOARDING_MAX_AGE,
    ONBOARDING_MIN_AGE,
    ONBOARDING_YEAR_VALUES,
    type OnboardingGenderValue,
    type OnboardingYearValue,
} from "@/lib/onboarding-schema";
import { prisma } from "@/lib/prisma";

interface ValidationIssue {
    field: string;
    message: string;
}

interface ParsedOnboardingBody {
    name: string;
    age: number;
    yearAtStetson: OnboardingYearValue;
    gender: OnboardingGenderValue;
}

const ALLOWED_ONBOARDING_FIELDS = new Set([
    "name",
    "age",
    "yearAtStetson",
    "gender",
]);

function validateOnboardingBody(rawBody: unknown): {
    parsed: ParsedOnboardingBody | null;
    issues: ValidationIssue[];
} {
    if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
        return {
            parsed: null,
            issues: [
                {
                    field: "body",
                    message: "Request body must be a JSON object.",
                },
            ],
        };
    }

    const body = rawBody as Record<string, unknown>;
    const issues: ValidationIssue[] = [];

    for (const key of Object.keys(body)) {
        if (!ALLOWED_ONBOARDING_FIELDS.has(key)) {
            issues.push({
                field: key,
                message: `Unexpected field: ${key}.`,
            });
        }
    }

    const rawName = body.name;
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (typeof rawName !== "string") {
        issues.push({ field: "name", message: "name must be a string." });
    } else if (name.length < 2 || name.length > 80) {
        issues.push({
            field: "name",
            message: "name must be between 2 and 80 characters after trimming.",
        });
    }

    const rawAge = body.age;
    if (
        typeof rawAge !== "number" ||
        !Number.isInteger(rawAge) ||
        rawAge < ONBOARDING_MIN_AGE ||
        rawAge > ONBOARDING_MAX_AGE
    ) {
        issues.push({
            field: "age",
            message: "age must be an integer between 16 and 100.",
        });
    }

    const rawYearAtStetson = body.yearAtStetson;
    if (
        typeof rawYearAtStetson !== "string" ||
        !ONBOARDING_YEAR_VALUES.includes(rawYearAtStetson as OnboardingYearValue)
    ) {
        issues.push({
            field: "yearAtStetson",
            message: `yearAtStetson must be one of: ${ONBOARDING_YEAR_VALUES.join(", ")}.`,
        });
    }

    const rawGender = body.gender;
    if (
        typeof rawGender !== "string" ||
        !ONBOARDING_GENDER_VALUES.includes(rawGender as OnboardingGenderValue)
    ) {
        issues.push({
            field: "gender",
            message: `gender must be one of: ${ONBOARDING_GENDER_VALUES.join(", ")}.`,
        });
    }

    if (issues.length > 0) {
        return { parsed: null, issues };
    }

    return {
        parsed: {
            name,
            age: rawAge as number,
            yearAtStetson: rawYearAtStetson as OnboardingYearValue,
            gender: rawGender as OnboardingGenderValue,
        },
        issues,
    };
}

/**
 * POST /api/user/onboarding
 *
 * Write-once onboarding profile endpoint for first-time users.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

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

        const validation = validateOnboardingBody(rawBody);
        if (!validation.parsed) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    message: "Validation failed.",
                    fieldErrors: validation.issues,
                },
                { status: 400 }
            );
        }

        const { clerkUserId, primaryStetsonEmail } = auth.user;

        const bootstrappedUser = await prisma.user.upsert({
            where: { clerkUserId },
            update: {
                email: primaryStetsonEmail,
            },
            create: {
                clerkUserId,
                email: primaryStetsonEmail,
                onboardingComplete: false,
            },
            select: {
                onboardingComplete: true,
                profilePictureUrl: true,
            },
        });

        if (bootstrappedUser.onboardingComplete) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: "ONBOARDING_ALREADY_COMPLETED",
                    message: "Onboarding has already been completed.",
                },
                { status: 409 }
            );
        }

        const updateResult = await prisma.user.updateMany({
            where: {
                clerkUserId,
                onboardingComplete: false,
            },
            data: {
                name: validation.parsed.name,
                age: validation.parsed.age,
                yearAtStetson: validation.parsed.yearAtStetson,
                gender: validation.parsed.gender,
                onboardingComplete: true,
                email: primaryStetsonEmail,
            },
        });

        if (updateResult.count === 0) {
            return NextResponse.json(
                {
                    error: "Conflict",
                    code: "ONBOARDING_ALREADY_COMPLETED",
                    message: "Onboarding has already been completed.",
                },
                { status: 409 }
            );
        }

        const localUser = await prisma.user.findUniqueOrThrow({
            where: { clerkUserId },
            select: {
                id: true,
                clerkUserId: true,
                email: true,
                name: true,
                yearAtStetson: true,
                gender: true,
                age: true,
                onboardingComplete: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({
            clerkUserId: localUser.clerkUserId,
            primaryVerifiedEmail: localUser.email,
            localUser,
        });
    } catch (error) {
        console.error("[POST /api/user/onboarding] Unexpected error:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: "An unexpected error occurred.",
            },
            { status: 500 }
        );
    }
}
