/**
 * Message body validation helper.
 *
 * Rules:
 *   1. Must be a string.
 *   2. Trim leading/trailing whitespace.
 *   3. Reject empty strings after trimming.
 *   4. Maximum length of 1000 characters after trimming.
 */

const MAX_MESSAGE_LENGTH = 1000;

export type MessageValidationResult =
    | { valid: true; trimmed: string }
    | { valid: false; error: string };

/**
 * Validates and sanitises a message body.
 *
 * @param body - The raw value from the request (may be any type).
 * @returns Either `{ valid: true, trimmed }` or `{ valid: false, error }`.
 */
export function validateMessageBody(body: unknown): MessageValidationResult {
    if (typeof body !== "string") {
        return { valid: false, error: "Message body must be a string." };
    }

    const trimmed = body.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: "Message body must not be empty." };
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
        return {
            valid: false,
            error: `Message body must not exceed ${MAX_MESSAGE_LENGTH} characters.`,
        };
    }

    return { valid: true, trimmed };
}
