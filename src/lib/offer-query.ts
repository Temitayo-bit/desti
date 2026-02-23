import { OfferStatus } from "@/generated/prisma/client";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OfferRole = "rider" | "driver";

export interface OfferCursor {
    id: string;
    createdAt: Date;
}

export class OfferQueryValidationError extends Error {
    field: string;

    constructor(field: string, message: string) {
        super(message);
        this.field = field;
    }
}

export function parseOfferRole(value: string | null): OfferRole {
    if (value === null) {
        throw new OfferQueryValidationError(
            "role",
            "role is required and must be either rider or driver."
        );
    }

    if (value === "rider" || value === "driver") {
        return value;
    }

    throw new OfferQueryValidationError(
        "role",
        "role must be either rider or driver."
    );
}

export function parseOfferStatus(
    value: string | null
): OfferStatus | undefined {
    if (value === null) return undefined;

    if (value === "PENDING" || value === "ACCEPTED" || value === "CANCELLED") {
        return value;
    }

    throw new OfferQueryValidationError(
        "status",
        "status must be one of PENDING, ACCEPTED, or CANCELLED."
    );
}

export function parseOfferLimit(value: string | null): number {
    if (value === null) return 20;

    if (!/^\d+$/.test(value)) {
        throw new OfferQueryValidationError(
            "limit",
            "limit must be a positive integer."
        );
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        throw new OfferQueryValidationError(
            "limit",
            "limit must be between 1 and 50."
        );
    }

    return parsed;
}

export function decodeOfferCursor(
    value: string | null
): OfferCursor | undefined {
    if (value === null) return undefined;

    try {
        const json = Buffer.from(value, "base64").toString("utf-8");
        const parsed = JSON.parse(json) as { id?: unknown; createdAt?: unknown };

        if (typeof parsed.id !== "string" || !UUID_REGEX.test(parsed.id)) {
            throw new OfferQueryValidationError(
                "cursor",
                "cursor.id must be a valid UUID string."
            );
        }

        if (typeof parsed.createdAt !== "string") {
            throw new OfferQueryValidationError(
                "cursor",
                "cursor.createdAt must be a valid ISO datetime string."
            );
        }

        const createdAt = new Date(parsed.createdAt);
        if (isNaN(createdAt.getTime())) {
            throw new OfferQueryValidationError(
                "cursor",
                "cursor.createdAt must be a valid ISO datetime string."
            );
        }

        return { id: parsed.id, createdAt };
    } catch (error) {
        if (error instanceof OfferQueryValidationError) {
            throw error;
        }

        throw new OfferQueryValidationError(
            "cursor",
            "cursor must be valid base64 JSON."
        );
    }
}

export function encodeOfferCursor(id: string, createdAt: Date): string {
    return Buffer.from(
        JSON.stringify({
            id,
            createdAt: createdAt.toISOString(),
        })
    ).toString("base64");
}
