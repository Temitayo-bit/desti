import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
export async function requireStetsonAuth(): Promise<AuthResult> {
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

    // Step 3: Return the authenticated user object
    return {
        user: {
            clerkUserId: user.id,
            primaryStetsonEmail: stetsonEmail.emailAddress.toLowerCase(),
        },
    };
}
