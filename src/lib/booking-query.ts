import { BookingStatus } from "@/generated/prisma/client";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BookingCursor {
    id: string;
    createdAt: Date;
}

export class BookingQueryValidationError extends Error {
    field: string;

    constructor(field: string, message: string) {
        super(message);
        this.field = field;
    }
}

export function parseBookingLimit(value: string | null): number {
    if (value === null) return 20;
    if (!/^\d+$/.test(value)) {
        throw new BookingQueryValidationError(
            "limit",
            "limit must be a positive integer."
        );
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        throw new BookingQueryValidationError(
            "limit",
            "limit must be between 1 and 50."
        );
    }

    return parsed;
}

export function parseBookingStatus(
    value: string | null
): BookingStatus {
    if (value === null) return "CONFIRMED";

    if (value === "CONFIRMED" || value === "CANCELLED") {
        return value;
    }

    throw new BookingQueryValidationError(
        "status",
        "status must be either CONFIRMED or CANCELLED."
    );
}

export function decodeBookingCursor(
    value: string | null
): BookingCursor | undefined {
    if (value === null) return undefined;

    try {
        const json = Buffer.from(value, "base64").toString("utf-8");
        const parsed = JSON.parse(json) as { id?: unknown; createdAt?: unknown };

        if (typeof parsed.id !== "string" || !UUID_REGEX.test(parsed.id)) {
            throw new BookingQueryValidationError(
                "cursor",
                "cursor.id must be a valid UUID string."
            );
        }

        if (typeof parsed.createdAt !== "string") {
            throw new BookingQueryValidationError(
                "cursor",
                "cursor.createdAt must be a valid ISO datetime string."
            );
        }

        const createdAt = new Date(parsed.createdAt);
        if (isNaN(createdAt.getTime())) {
            throw new BookingQueryValidationError(
                "cursor",
                "cursor.createdAt must be a valid ISO datetime string."
            );
        }

        return { id: parsed.id, createdAt };
    } catch (error) {
        if (error instanceof BookingQueryValidationError) {
            throw error;
        }

        throw new BookingQueryValidationError(
            "cursor",
            "cursor must be valid base64 JSON."
        );
    }
}

export function encodeBookingCursor(id: string, createdAt: Date): string {
    return Buffer.from(
        JSON.stringify({
            id,
            createdAt: createdAt.toISOString(),
        })
    ).toString("base64");
}
