/**
 * Desti help chat: canonical answers and output guards.
 * Models can ignore long system prompts; these layers enforce product scope in code.
 */

/** Shown when we detect generic web/rideshare spam in the model output. */
export const REFUSAL_OUT_OF_SCOPE =
    "I can only help with Desti features like posting rides, requesting rides, offers, bookings, and trip tracking. What would you like to do in Desti?";

export const CANONICAL_POST_RIDE_ANSWER = `Tap **Create Ride** in the top bar (or open **Post a ride**). Enter origin and destination using the location fields, set your departure window, seats, and price, add any optional details, then tap **Create Ride** to submit.`;

/** Phrases / brands that must not appear in a valid Desti-only answer. */
const BANNED_ANSWER_PATTERNS: RegExp[] = [
    /\bblablacar\b/i,
    /\bkangaride\b/i,
    /\bpoparide\b/i,
    /\buber\b/i,
    /\blyft\b/i,
    /\bcraigslist\b/i,
    /\bkijiji\b/i,
    /\bfacebook marketplace\b/i,
    /\bfacebook groups?\b/i,
    /ride-hailing/i,
    /\bdedicated ridesharing\b/i,
    /\bcarpooling apps?\b/i,
    /* Common opening for generic web copy the model should never produce */
    /posting a ride typically means/i,
    /###\s*where to post your ride/i,
];

export function answerContainsBannedGenericContent(text: string): boolean {
    const t = text.trim();
    if (t.length === 0) return false;
    for (const pattern of BANNED_ANSWER_PATTERNS) {
        if (pattern.test(t)) return true;
    }
    /* Long essay + company names = almost always off-app spam */
    if (t.length > 1200 && /\b(uber|lyft)\b/i.test(t) && /###/.test(t)) {
        return true;
    }
    return false;
}

/**
 * Redacted short preview of the *user* message for server logs (never log model text).
 */
export function previewForDestiChatLog(s: string, maxLen = 100): string {
    const t = s
        .replace(/\S+@\S+\.\S+/g, "[redacted-email]")
        .replace(/\b\+?\d[\d\s().-]{8,}\b/g, "[redacted-digits]");
    const u = t.trim();
    if (u.length <= maxLen) return u;
    return `${u.slice(0, maxLen)}…`;
}

/**
 * Returns a short-circuit answer so we never call the model for common in-app FAQs.
 */
export function tryCanonicalDestiAnswer(userMessage: string): string | null {
    const q = userMessage.trim();
    if (!q) return null;

    if (matchesPostRideFaq(q)) {
        return CANONICAL_POST_RIDE_ANSWER;
    }
    return null;
}

/**
 * "post a ride" but not "post a ride request" (trip request wording).
 */
export function matchesPostRideFaq(message: string): boolean {
    const m = message.trim();
    if (!m) return false;
    return (
        /how\s+(do\s+i|to|can\s+i)\s+post(\s+a)?\s*ride(?!\s*request)\b\??/i.test(m) ||
        /^post(\s+a)?\s*ride\??$/i.test(m) ||
        /^how\s+to\s+post(\s+a)?\s*ride(?!\s*request)\b\??/i.test(m)
    );
}

export type DestiChatGuardBranch = "pass" | "canonical" | "refusal";

export type DestiChatGuardResult = {
    text: string;
    branch: DestiChatGuardBranch;
    originalLength: number;
    guardedLength: number;
};

/**
 * If the model returned generic web junk, replace with a safe Desti-only reply.
 */
export function guardDestiChatOutput(
    modelAnswer: string,
    userMessage: string
): DestiChatGuardResult {
    const originalLength = modelAnswer.length;

    if (!answerContainsBannedGenericContent(modelAnswer)) {
        return {
            text: modelAnswer,
            branch: "pass",
            originalLength,
            guardedLength: originalLength,
        };
    }

    if (matchesPostRideFaq(userMessage)) {
        return {
            text: CANONICAL_POST_RIDE_ANSWER,
            branch: "canonical",
            originalLength,
            guardedLength: CANONICAL_POST_RIDE_ANSWER.length,
        };
    }

    return {
        text: REFUSAL_OUT_OF_SCOPE,
        branch: "refusal",
        originalLength,
        guardedLength: REFUSAL_OUT_OF_SCOPE.length,
    };
}
