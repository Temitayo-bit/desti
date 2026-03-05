import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const YEAR_VALUES = ["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR"] as const;
const GENDER_VALUES = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;

type YearAtStetsonValue = (typeof YEAR_VALUES)[number];
type GenderValue = (typeof GENDER_VALUES)[number];

interface ValidationIssue {
    field: string;
    message: string;
}

interface ParsedOnboardingBody {
    name: string;
    age: number;
    yearAtStetson: YearAtStetsonValue;
    gender: GenderValue;
}

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
        rawAge < 16 ||
        rawAge > 100
    ) {
        issues.push({
            field: "age",
            message: "age must be an integer between 16 and 100.",
        });
    }

    const rawYearAtStetson = body.yearAtStetson;
    if (
        typeof rawYearAtStetson !== "string" ||
        !YEAR_VALUES.includes(rawYearAtStetson as YearAtStetsonValue)
    ) {
        issues.push({
            field: "yearAtStetson",
            message: `yearAtStetson must be one of: ${YEAR_VALUES.join(", ")}.`,
        });
    }

    const rawGender = body.gender;
    if (
        typeof rawGender !== "string" ||
        !GENDER_VALUES.includes(rawGender as GenderValue)
    ) {
        issues.push({
            field: "gender",
            message: `gender must be one of: ${GENDER_VALUES.join(", ")}.`,
        });
    }

    if (issues.length > 0) {
        return { parsed: null, issues };
    }

    return {
        parsed: {
            name,
            age: rawAge as number,
            yearAtStetson: rawYearAtStetson as YearAtStetsonValue,
            gender: rawGender as GenderValue,
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
}
