import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk proxy for session management (formerly middleware.ts).
 * This makes Clerk auth state available to all matched routes
 * via currentUser() and auth() helpers.
 *
 * The actual authorization logic (verified @stetson.edu check)
 * is handled per-route by requireStetsonAuth() in src/lib/auth.ts.
 *
 * Matcher covers app pages and API routes, while skipping static assets
 * and Next.js internals.
 */
export const proxy = clerkMiddleware();

export const config = {
    matcher: [
        // Run on all routes except Next internals and static files.
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|mjs|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run on API routes.
        "/(api|trpc)(.*)",
    ],
};
