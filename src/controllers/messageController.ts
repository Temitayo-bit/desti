import { Prisma } from "@/generated/prisma/client";
import { assertConversationParticipant } from "@/helpers/conversationAuth";
import { validateMessageBody } from "@/helpers/messageValidation";
import { prisma } from "@/lib/prisma";
import {
    ConversationServiceError,
    createMessageWithRateLimit,
} from "@/services/conversationService";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const messageSelect = {
    id: true,
    conversationId: true,
    senderUserId: true,
    body: true,
    createdAt: true,
} satisfies Prisma.MessageSelect;

interface DecodedMessageCursor {
    createdAt: Date;
    id: string;
}

function parseMessageLimit(limitParam: string | null): number {
    if (limitParam === null) return 20;

    if (!/^\d+$/.test(limitParam)) {
        throw new ConversationServiceError(
            "limit must be a positive integer between 1 and 50.",
            "INVALID_LIMIT",
            400
        );
    }

    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        throw new ConversationServiceError(
            "limit must be a positive integer between 1 and 50.",
            "INVALID_LIMIT",
            400
        );
    }

    return parsed;
}

function decodeMessageCursor(cursorParam: string | null): DecodedMessageCursor | undefined {
    if (cursorParam === null) return undefined;

    try {
        const decoded = Buffer.from(cursorParam, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded) as { createdAt?: unknown; id?: unknown };

        if (typeof parsed.createdAt !== "string") {
            throw new ConversationServiceError(
                "cursor.createdAt must be a valid ISO datetime string.",
                "INVALID_CURSOR",
                400
            );
        }

        if (typeof parsed.id !== "string" || !UUID_REGEX.test(parsed.id)) {
            throw new ConversationServiceError(
                "cursor.id must be a valid UUID string.",
                "INVALID_CURSOR",
                400
            );
        }

        const createdAt = new Date(parsed.createdAt);
        if (isNaN(createdAt.getTime())) {
            throw new ConversationServiceError(
                "cursor.createdAt must be a valid ISO datetime string.",
                "INVALID_CURSOR",
                400
            );
        }

        return {
            createdAt,
            id: parsed.id,
        };
    } catch (error) {
        if (error instanceof ConversationServiceError) {
            throw error;
        }

        throw new ConversationServiceError(
            "cursor must be valid base64 JSON.",
            "INVALID_CURSOR",
            400
        );
    }
}

function encodeMessageCursor(createdAt: Date, id: string): string {
    return Buffer.from(
        JSON.stringify({
            createdAt: createdAt.toISOString(),
            id,
        })
    ).toString("base64");
}

export interface MessageListResult {
    items: {
        id: string;
        conversationId: string;
        senderUserId: string;
        body: string;
        createdAt: Date;
    }[];
    nextCursor: string | null;
}

/**
 * Returns message history with ASC keyset pagination for the authenticated participant.
 */
export async function getConversationMessagesController(
    userId: string,
    conversationId: string,
    searchParams: URLSearchParams
): Promise<MessageListResult> {
    await assertConversationParticipant(conversationId, userId);

    const limit = parseMessageLimit(searchParams.get("limit"));
    const cursor = decodeMessageCursor(searchParams.get("cursor"));

    const andClauses: Prisma.MessageWhereInput[] = [{ conversationId }];
    if (cursor) {
        andClauses.push({
            OR: [
                { createdAt: { gt: cursor.createdAt } },
                {
                    createdAt: cursor.createdAt,
                    id: { gt: cursor.id },
                },
            ],
        });
    }

    const messages = await prisma.message.findMany({
        where: { AND: andClauses },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        select: messageSelect,
    });

    const hasNextPage = messages.length > limit;
    const items = hasNextPage ? messages.slice(0, limit) : messages;
    const lastItem = items.at(-1);
    const nextCursor =
        hasNextPage && lastItem
            ? encodeMessageCursor(lastItem.createdAt, lastItem.id)
            : null;

    return {
        items,
        nextCursor,
    };
}

/**
 * Sends a message for a participant after validation and rate-limit checks.
 */
export async function sendConversationMessageController(
    userId: string,
    conversationId: string,
    rawBody: unknown
) {
    await assertConversationParticipant(conversationId, userId);

    if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
        throw new ConversationServiceError(
            "Request body must be a JSON object.",
            "INVALID_REQUEST_BODY",
            400
        );
    }

    const parsedBody = rawBody as Record<string, unknown>;
    const validation = validateMessageBody(parsedBody.body);
    if (!validation.valid) {
        throw new ConversationServiceError(
            validation.error,
            "INVALID_MESSAGE",
            400
        );
    }
    return createMessageWithRateLimit(conversationId, userId, validation.trimmed, {
        windowMinutes: 5,
        maxMessages: 20,
    });
}
