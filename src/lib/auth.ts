import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Represents a successfully authenticated and authorized user.
 */
export interface AuthedUser {
    /** The Clerk user ID (e.g., "user_2x...") */
    clerkUserId: string;
    /** The primary verified @stetson.edu email address */
    primaryStetsonEmail: string;
}

/**
 * Result type for requireStetsonAuth():
 * - On success: { user: AuthedUser }
 * - On failure: { error: NextResponse }
 */
export type AuthResult =
    | { user: AuthedUser; error?: never }
    | { error: NextResponse; user?: never };

interface AuthRequestContext {
    request?: Request;
    method?: string;
    pathname?: string;
}

interface RouteMethodPath {
    method: string;
    pathname: string;
}

const ONBOARDING_EXEMPT_ROUTES: readonly RouteMethodPath[] = [
    { method: "GET", pathname: "/api/me" },
    { method: "POST", pathname: "/api/user/onboarding" },
];

function normalizePathname(pathname: string): string {
    if (pathname.length > 1 && pathname.endsWith("/")) {
        return pathname.slice(0, -1);
    }
    return pathname;
}

function resolveMethodAndPath(
    context?: AuthRequestContext
): { method: string | null; pathname: string | null } {
    if (context?.request) {
        try {
            const url = new URL(context.request.url);
            return {
                method: context.request.method.toUpperCase(),
                pathname: normalizePathname(url.pathname),
            };
        } catch {
            return {
                method: context.request.method.toUpperCase(),
                pathname: null,
            };
        }
    }

    return {
        method: context?.method ? context.method.toUpperCase() : null,
        pathname: context?.pathname
            ? normalizePathname(context.pathname)
            : null,
    };
}

function isOnboardingExempt(method: string | null, pathname: string | null): boolean {
    if (!method || !pathname) return false;

    return ONBOARDING_EXEMPT_ROUTES.some(
        (route) => route.method === method && route.pathname === pathname
    );
}

/**
 * Reusable backend auth guard.
 *
 * 1. Checks that the request has a valid Clerk session (401 if not).
 * 2. Checks that the user has at least one VERIFIED email ending
 *    with "@stetson.edu" (case-insensitive). Returns 403 if not.
 * 3. Returns an AuthedUser object with the Clerk user ID and
 *    primary Stetson email.
 *
 * Usage in a route handler:
 * ```ts
 * const auth = await requireStetsonAuth();
 * if (auth.error) return auth.error;
 * const { clerkUserId, primaryStetsonEmail } = auth.user;
 * ```
 */
export async function requireStetsonAuth(
    context?: Request | AuthRequestContext
): Promise<AuthResult> {
    // Step 1: Check for authenticated Clerk session
    const user = await currentUser();

    if (!user) {
        return {
            error: NextResponse.json(
                { error: "Unauthorized", message: "Authentication required." },
                { status: 401 }
            ),
        };
    }

    // Step 2: Find a verified @stetson.edu email
    const stetsonEmail = user.emailAddresses.find((emailObj) => {
        const isVerified = emailObj.verification?.status === "verified";
        const isStetson = emailObj.emailAddress
            .toLowerCase()
            .endsWith("@stetson.edu");
        return isVerified && isStetson;
    });

    if (!stetsonEmail) {
        return {
            error: NextResponse.json(
                {
                    error: "Forbidden",
                    message:
                        "Access restricted to verified @stetson.edu email addresses.",
                },
                { status: 403 }
            ),
        };
    }

    const authContext: AuthRequestContext =
        context instanceof Request ? { request: context } : context ?? {};
    const { method, pathname } = resolveMethodAndPath(authContext);
    const onboardingExempt = isOnboardingExempt(method, pathname);

    const localUser = await prisma.user.findUnique({
        where: { clerkUserId: user.id },
        select: { onboardingComplete: true },
    });

    if (!onboardingExempt && localUser?.onboardingComplete !== true) {
        return {
            error: NextResponse.json(
                {
                    error: "Forbidden",
                    code: "ONBOARDING_REQUIRED",
                    message:
                        "Complete onboarding before accessing this endpoint.",
                },
                { status: 403 }
            ),
        };
    }

    // Step 3: Return the authenticated user object
    return {
        user: {
            clerkUserId: user.id,
            primaryStetsonEmail: stetsonEmail.emailAddress.toLowerCase(),
        },
    };
}
