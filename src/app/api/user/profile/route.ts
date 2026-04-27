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

/** Max length for profile bio / tagline (matches common product limits). */
const PROFILE_BIO_MAX_LENGTH = 500;

interface ValidationIssue {
    field: string;
    message: string;
}

interface ParsedProfileBody {
    name: string;
    age: number;
    yearAtStetson: OnboardingYearValue;
    gender: OnboardingGenderValue;
    /** When present in the request body, replace stored bio (empty string clears). */
    bio?: string | null;
}

const ALLOWED_FIELDS = new Set(["name", "age", "yearAtStetson", "gender", "bio"]);

function validateProfilePatchBody(rawBody: unknown): {
    parsed: ParsedProfileBody | null;
    issues: ValidationIssue[];
} {
    if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
        return {
            parsed: null,
            issues: [{ field: "body", message: "Request body must be a JSON object." }],
        };
    }

    const body = rawBody as Record<string, unknown>;
    const issues: ValidationIssue[] = [];

    for (const key of Object.keys(body)) {
        if (!ALLOWED_FIELDS.has(key)) {
            issues.push({ field: key, message: `Unexpected field: ${key}.` });
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
            message: `age must be an integer between ${ONBOARDING_MIN_AGE} and ${ONBOARDING_MAX_AGE}.`,
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

    let bio: string | null | undefined;
    if (Object.prototype.hasOwnProperty.call(body, "bio")) {
        const rawBio = body.bio;
        if (rawBio === null) {
            bio = null;
        } else if (typeof rawBio !== "string") {
            issues.push({ field: "bio", message: "bio must be a string or null." });
        } else {
            const trimmed = rawBio.trim();
            if (trimmed.length > PROFILE_BIO_MAX_LENGTH) {
                issues.push({
                    field: "bio",
                    message: `bio must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`,
                });
            } else {
                bio = trimmed.length > 0 ? trimmed : null;
            }
        }
    }

    if (issues.length > 0) {
        return { parsed: null, issues };
    }

    const parsed: ParsedProfileBody = {
        name,
        age: rawAge as number,
        yearAtStetson: rawYearAtStetson as OnboardingYearValue,
        gender: rawGender as OnboardingGenderValue,
    };
    if (bio !== undefined) {
        parsed.bio = bio;
    }

    return {
        parsed,
        issues,
    };
}

/**
 * PATCH /api/user/profile
 *
 * Updates onboarding profile fields for users who already completed onboarding.
 */
export async function PATCH(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Bad Request", message: "Request body must be valid JSON." },
                { status: 400 }
            );
        }

        const validation = validateProfilePatchBody(rawBody);
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

        const existing = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { onboardingComplete: true },
        });

        if (!existing?.onboardingComplete) {
            return NextResponse.json(
                {
                    error: "Forbidden",
                    code: "ONBOARDING_INCOMPLETE",
                    message: "Complete onboarding before editing your profile.",
                },
                { status: 403 }
            );
        }

        const updated = await prisma.user.update({
            where: { clerkUserId },
            data: {
                name: validation.parsed.name,
                age: validation.parsed.age,
                yearAtStetson: validation.parsed.yearAtStetson,
                gender: validation.parsed.gender,
                email: primaryStetsonEmail,
                ...(validation.parsed.bio !== undefined
                    ? { bio: validation.parsed.bio }
                    : {}),
            },
            select: {
                clerkUserId: true,
                email: true,
                name: true,
                yearAtStetson: true,
                gender: true,
                age: true,
                bio: true,
                profilePictureUrl: true,
                onboardingComplete: true,
            },
        });

        return NextResponse.json(updated, { status: 200 });
    } catch (error) {
        console.error("[PATCH /api/user/profile] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
