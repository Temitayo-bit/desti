import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk middleware for session management.
 * This makes Clerk auth state available to all matched routes
 * via currentUser() and auth() helpers.
 *
 * The actual authorization logic (verified @stetson.edu check)
 * is handled per-route by requireStetsonAuth() in src/lib/auth.ts.
 */
export default clerkMiddleware();

export const config = {
    matcher: [
        // Match all API routes
        "/api/(.*)",
        // Skip Next.js internals and static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    ],
};
