import { z } from "zod";

/**
 * Common pagination query parameters schemas.
 * Reusable for both rides and trip-request endpoints.
 */

// Basic shape of the decoded cursor (timestamp + id)
export const CursorSchema = z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime(), // ISO string for the sort key (earliestDepartAt or earliestDesiredAt)
});

export type Cursor = z.infer<typeof CursorSchema>;

/**
 * Encodes a cursor object to a Base64 string.
 */
export function encodeCursor(cursor: Cursor): string {
    const json = JSON.stringify(cursor);
    return Buffer.from(json).toString("base64");
}

/**
 * Result type for cursor decoding.
 */
export type CursorResult =
    | { status: "missing" }
    | { status: "invalid"; reason: string }
    | { status: "valid"; cursor: Cursor };

/**
 * Decodes and validates a Base64 cursor string.
 * Returns a discriminated union to handle missing vs invalid states.
 */
export function decodeCursor(cursorString: string | undefined | null): CursorResult {
    if (!cursorString) return { status: "missing" };
    try {
        const json = Buffer.from(cursorString, "base64").toString("utf-8");
        const parsed = JSON.parse(json);
        const result = CursorSchema.safeParse(parsed);
        if (result.success) {
            return { status: "valid", cursor: result.data };
        }
        return { status: "invalid", reason: "Cursor schema validation failed" };
    } catch {
        return { status: "invalid", reason: "Malformed cursor encoding" };
    }
}

/**
 * Validates the common `limit` parameter.
 * Defaults to 20 if undefined.
 * Throws error or returns error result if invalid (to be handled by route).
 */
export function parseLimit(limitParam: string | null | undefined): number {
    if (!limitParam) return 20;
    const parsed = parseInt(limitParam, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        throw new Error("Limit must be an integer between 1 and 50");
    }
    return parsed;
}

/**
 * Standard interface for paginated responses.
 */
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        nextCursor: string | null;
    };
}
