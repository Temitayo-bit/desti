import { DistanceCategory } from "@/generated/prisma/client";

const VALID_DISTANCE_CATEGORIES: ReadonlySet<string> = new Set(
    Object.values(DistanceCategory)
);

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DecodedCursor {
    id: string;
    timestamp: Date;
}

export class QueryValidationError extends Error {
    field: string;

    constructor(field: string, message: string) {
        super(message);
        this.field = field;
    }
}

function parsePositiveInt(
    value: string,
    field: string,
    max?: number
): number {
    if (!/^\d+$/.test(value)) {
        throw new QueryValidationError(field, `${field} must be a positive integer.`);
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new QueryValidationError(field, `${field} must be a positive integer.`);
    }

    if (max !== undefined && parsed > max) {
        throw new QueryValidationError(
            field,
            `${field} must be between 1 and ${max}.`
        );
    }

    return parsed;
}

export function parseLimit(value: string | null): number {
    if (value === null) return 20;
    return parsePositiveInt(value, "limit", 50);
}

export function parseDistanceCategory(
    value: string | null
): DistanceCategory | undefined {
    if (value === null) return undefined;
    if (!VALID_DISTANCE_CATEGORIES.has(value)) {
        throw new QueryValidationError(
            "distanceCategory",
            "distanceCategory must be one of SHORT, MEDIUM, or LONG."
        );
    }
    return value as DistanceCategory;
}

export function parseISODateParam(
    value: string | null,
    field: string
): Date | undefined {
    if (value === null) return undefined;
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
        throw new QueryValidationError(field, `${field} must be a valid ISO datetime.`);
    }
    return parsed;
}

export function parseBooleanParam(
    value: string | null,
    field: string,
    defaultValue: boolean
): boolean {
    if (value === null) return defaultValue;
    if (value === "true") return true;
    if (value === "false") return false;

    throw new QueryValidationError(field, `${field} must be either true or false.`);
}

export function parseSeatsParam(
    value: string | null,
    field: "seatsMin" | "seatsMax"
): number | undefined {
    if (value === null) return undefined;
    return parsePositiveInt(value, field);
}

export function decodeCursor(value: string | null): DecodedCursor | undefined {
    if (value === null) return undefined;

    try {
        const json = Buffer.from(value, "base64").toString("utf-8");
        const parsed = JSON.parse(json) as { id?: unknown; timestamp?: unknown };

        if (typeof parsed.id !== "string" || !UUID_REGEX.test(parsed.id)) {
            throw new QueryValidationError(
                "cursor",
                "cursor.id must be a valid UUID string."
            );
        }

        if (typeof parsed.timestamp !== "string") {
            throw new QueryValidationError(
                "cursor",
                "cursor.timestamp must be a valid ISO datetime string."
            );
        }

        const timestamp = new Date(parsed.timestamp);
        if (isNaN(timestamp.getTime())) {
            throw new QueryValidationError(
                "cursor",
                "cursor.timestamp must be a valid ISO datetime string."
            );
        }

        return { id: parsed.id, timestamp };
    } catch (error) {
        if (error instanceof QueryValidationError) {
            throw error;
        }
        throw new QueryValidationError("cursor", "cursor must be valid base64 JSON.");
    }
}

export function encodeCursor(id: string, timestamp: Date): string {
    return Buffer.from(
        JSON.stringify({ id, timestamp: timestamp.toISOString() })
    ).toString("base64");
}
