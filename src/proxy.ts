import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk proxy for session management (formerly middleware.ts).
 * This makes Clerk auth state available to all matched routes
 * via currentUser() and auth() helpers.
 *
 * The actual authorization logic (verified @stetson.edu check)
 * is handled per-route by requireStetsonAuth() in src/lib/auth.ts.
 *
 * Matcher is scoped to /api routes only — frontend pages are not
 * intercepted, so users can freely load the app and sign in.
 */
export const proxy = clerkMiddleware();

export const config = {
    matcher: ["/api/(.*)"],
};
