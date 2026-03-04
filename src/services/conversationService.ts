/**
 * Core conversation service.
 *
 * Exposes every function the REST layer (SWE II) needs to build
 * messaging endpoints.  This module owns:
 *
 *   - get-or-create semantics with relationship validation
 *   - participant verification
 *   - message creation with send-blocking on cancelled relationships
 *   - cursor-based message pagination
 *   - rate-limit counting
 *
 * All functions throw `ConversationServiceError` on business-rule
 * violations so the route layer can map them to HTTP responses.
 */

import { prisma } from "@/lib/prisma";
import type { Conversation, Message } from "@/generated/prisma/client";

// ── Custom error class ──────────────────────────────────────────────────────

/**
 * Typed service error with a machine-readable `code` and an HTTP-friendly
 * `statusCode` so the REST layer can forward it without interpretation.
 */
export class ConversationServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(message: string, code: string, statusCode: number) {
        super(message);
        this.name = "ConversationServiceError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

// ── Get or create (booking) ─────────────────────────────────────────────────

/**
 * Returns the conversation for the given booking, creating one if it
 * does not yet exist.
 *
 * Relationship validation:
 *   - The booking must exist.
 *   - The booking status must be CONFIRMED.
 *
 * The rider and driver are derived from the booking row itself so the
 * caller does not need to supply them.
 */
export async function getOrCreateBookingConversation(
    bookingId: string
): Promise<Conversation> {
    // Fast path: conversation already exists.
    const existing = await prisma.conversation.findUnique({
        where: { bookingId },
    });
    if (existing) return existing;

    // Validate the booking.
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
    });

    if (!booking) {
        throw new ConversationServiceError(
            "Booking not found.",
            "BOOKING_NOT_FOUND",
            404
        );
    }

    if (booking.status !== "CONFIRMED") {
        throw new ConversationServiceError(
            "Cannot start a conversation for a non-confirmed booking.",
            "BOOKING_NOT_CONFIRMED",
            409
        );
    }

    // Determine the driver.  For ride-based bookings the driver owns the
    // ride; for offer-based bookings the driverUserId is stored directly.
    let driverUserId = booking.driverUserId;

    if (!driverUserId && booking.rideId) {
        const ride = await prisma.ride.findUnique({
            where: { id: booking.rideId },
            select: { driverUserId: true },
        });

        if (!ride) {
            throw new ConversationServiceError(
                "Associated ride not found.",
                "RIDE_NOT_FOUND",
                404
            );
        }

        driverUserId = ride.driverUserId;
    }

    if (!driverUserId) {
        throw new ConversationServiceError(
            "Cannot determine driver for this booking.",
            "DRIVER_NOT_FOUND",
            500
        );
    }

    // Create the conversation (upsert-style to handle race conditions).
    try {
        return await prisma.conversation.create({
            data: {
                type: "BOOKING",
                bookingId,
                riderUserId: booking.riderUserId,
                driverUserId,
            },
        });
    } catch (error: unknown) {
        // If a unique constraint violation occurs another request won the
        // race — just return the existing conversation.
        if (isPrismaUniqueConstraintError(error)) {
            const raced = await prisma.conversation.findUnique({
                where: { bookingId },
            });
            if (raced) return raced;
        }
        throw error;
    }
}

// ── Get or create (offer) ───────────────────────────────────────────────────

/**
 * Returns the conversation for the given offer, creating one if it does
 * not yet exist.
 *
 * Relationship validation:
 *   - The offer must exist.
 *   - The offer status must be PENDING or ACCEPTED.
 */
export async function getOrCreateOfferConversation(
    offerId: string
): Promise<Conversation> {
    const existing = await prisma.conversation.findUnique({
        where: { offerId },
    });
    if (existing) return existing;

    const offer = await prisma.offer.findUnique({
        where: { id: offerId },
    });

    if (!offer) {
        throw new ConversationServiceError(
            "Offer not found.",
            "OFFER_NOT_FOUND",
            404
        );
    }

    if (offer.status !== "PENDING" && offer.status !== "ACCEPTED") {
        throw new ConversationServiceError(
            "Cannot start a conversation for a cancelled offer.",
            "OFFER_CANCELLED",
            409
        );
    }

    try {
        return await prisma.conversation.create({
            data: {
                type: "OFFER",
                offerId,
                riderUserId: offer.riderUserId,
                driverUserId: offer.driverUserId,
            },
        });
    } catch (error: unknown) {
        if (isPrismaUniqueConstraintError(error)) {
            const raced = await prisma.conversation.findUnique({
                where: { offerId },
            });
            if (raced) return raced;
        }
        throw error;
    }
}

// ── List conversations ──────────────────────────────────────────────────────

/**
 * Returns every conversation the user participates in, newest-updated
 * first.
 */
export async function listUserConversations(
    userId: string
): Promise<Conversation[]> {
    return prisma.conversation.findMany({
        where: {
            OR: [{ riderUserId: userId }, { driverUserId: userId }],
        },
        orderBy: { updatedAt: "desc" },
    });
}

// ── Get conversation by ID ──────────────────────────────────────────────────

/**
 * Returns a single conversation by primary key, or `null` if not found.
 */
export async function getConversationById(
    conversationId: string
): Promise<Conversation | null> {
    return prisma.conversation.findUnique({
        where: { id: conversationId },
    });
}

// ── Participant verification ────────────────────────────────────────────────

/**
 * Returns the conversation if the user is a participant, otherwise
 * returns `null`.  The route layer should map `null` to a 404 response.
 */
export async function verifyConversationParticipant(
    conversationId: string,
    userId: string
): Promise<Conversation | null> {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
    });

    if (
        !conversation ||
        (conversation.riderUserId !== userId &&
            conversation.driverUserId !== userId)
    ) {
        return null;
    }

    return conversation;
}

// ── Create message ──────────────────────────────────────────────────────────

/**
 * Creates a message within a conversation.
 *
 * Sending is blocked when the underlying relationship is cancelled:
 *   - Booking conversation → booking.status = CANCELLED
 *   - Offer conversation   → offer.status   = CANCELLED
 *
 * Reading messages is always allowed (enforced by the route layer).
 */
export async function createMessage(
    conversationId: string,
    senderUserId: string,
    body: string
): Promise<Message> {
    // Fetch the conversation with its relationship to check status.
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            booking: { select: { status: true } },
            offer: { select: { status: true } },
        },
    });

    if (!conversation) {
        throw new ConversationServiceError(
            "Conversation not found.",
            "CONVERSATION_NOT_FOUND",
            404
        );
    }

    // Verify sender is a participant.
    if (
        conversation.riderUserId !== senderUserId &&
        conversation.driverUserId !== senderUserId
    ) {
        throw new ConversationServiceError(
            "Conversation not found.",
            "CONVERSATION_NOT_FOUND",
            404
        );
    }

    // Block sending when the relationship is cancelled.
    if (
        conversation.type === "BOOKING" &&
        conversation.booking?.status === "CANCELLED"
    ) {
        throw new ConversationServiceError(
            "Cannot send messages in a cancelled booking conversation.",
            "BOOKING_CANCELLED",
            409
        );
    }

    if (
        conversation.type === "OFFER" &&
        conversation.offer?.status === "CANCELLED"
    ) {
        throw new ConversationServiceError(
            "Cannot send messages in a cancelled offer conversation.",
            "OFFER_CANCELLED",
            409
        );
    }

    // Validate and sanitise the message body.
    const MESSAGE_MAX_LENGTH = 1000;
    const trimmedBody = body.trim();

    if (trimmedBody.length === 0) {
        throw new ConversationServiceError(
            "Message body must not be empty.",
            "INVALID_MESSAGE",
            400
        );
    }

    if (trimmedBody.length > MESSAGE_MAX_LENGTH) {
        throw new ConversationServiceError(
            `Message body must not exceed ${MESSAGE_MAX_LENGTH} characters.`,
            "INVALID_MESSAGE",
            400
        );
    }

    // Create the message and touch the conversation's updatedAt so that
    // list ordering reflects recent activity.
    const [message] = await prisma.$transaction([
        prisma.message.create({
            data: {
                conversationId,
                senderUserId,
                body: trimmedBody,
            },
        }),
        prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        }),
    ]);

    return message;
}

// ── Get messages (paginated) ────────────────────────────────────────────────

export interface MessagePage {
    messages: Message[];
    nextCursor: string | null;
}

/**
 * Returns messages for a conversation using cursor-based pagination.
 *
 * Messages are returned newest-first (DESC by createdAt, then id).
 * The cursor is the `id` of the last message returned.
 */
export async function getMessages(
    conversationId: string,
    cursor?: string | null,
    limit: number = 20
): Promise<MessagePage> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: safeLimit + 1, // fetch one extra to determine if there's a next page
        ...(cursor
            ? {
                cursor: { id: cursor },
                skip: 1, // skip the cursor item itself
            }
            : {}),
    });

    const hasMore = messages.length > safeLimit;
    const page = hasMore ? messages.slice(0, safeLimit) : messages;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return { messages: page, nextCursor };
}

// ── Rate-limit counting ─────────────────────────────────────────────────────

/**
 * Counts the number of messages sent by `userId` in the given
 * conversation within the last `minutes` minutes.
 *
 * SWE II will use this count to enforce a per-user rate limit.
 */
export async function countRecentMessages(
    userId: string,
    conversationId: string,
    minutes: number = 5
): Promise<number> {
    const since = new Date(Date.now() - minutes * 60_000);

    return prisma.message.count({
        where: {
            conversationId,
            senderUserId: userId,
            createdAt: { gte: since },
        },
    });
}

// ── Atomic rate-limited send ───────────────────────────────────────────────

/**
 * Atomically enforces per-user message rate limits and inserts a message.
 *
 * Concurrency strategy:
 *   1. Lock the conversation row (`FOR UPDATE`) to serialize competing sends.
 *   2. Recompute count in-window inside the same transaction.
 *   3. Insert message + touch conversation.updatedAt only if under limit.
 *
 * This prevents race conditions where parallel requests could both pass
 * a separate count check and then exceed the configured limit.
 */
export async function createMessageWithRateLimit(
    conversationId: string,
    senderUserId: string,
    body: string,
    options?: {
        windowMinutes?: number;
        maxMessages?: number;
    }
): Promise<Message> {
    const windowMinutes = options?.windowMinutes ?? 5;
    const maxMessages = options?.maxMessages ?? 20;

    return prisma.$transaction(async (tx) => {
        // Serialize sends for this conversation to make check+insert atomic.
        await tx.$queryRaw`
            SELECT id
            FROM conversations
            WHERE id = ${conversationId}
            FOR UPDATE
        `;

        // Fetch the conversation with relationship status for send guards.
        const conversation = await tx.conversation.findUnique({
            where: { id: conversationId },
            include: {
                booking: { select: { status: true } },
                offer: { select: { status: true } },
            },
        });

        if (!conversation) {
            throw new ConversationServiceError(
                "Conversation not found.",
                "CONVERSATION_NOT_FOUND",
                404
            );
        }

        if (
            conversation.riderUserId !== senderUserId &&
            conversation.driverUserId !== senderUserId
        ) {
            throw new ConversationServiceError(
                "Conversation not found.",
                "CONVERSATION_NOT_FOUND",
                404
            );
        }

        if (
            conversation.type === "BOOKING" &&
            conversation.booking?.status === "CANCELLED"
        ) {
            throw new ConversationServiceError(
                "Cannot send messages in a cancelled booking conversation.",
                "BOOKING_CANCELLED",
                409
            );
        }

        if (
            conversation.type === "OFFER" &&
            conversation.offer?.status === "CANCELLED"
        ) {
            throw new ConversationServiceError(
                "Cannot send messages in a cancelled offer conversation.",
                "OFFER_CANCELLED",
                409
            );
        }

        const trimmedBody = body.trim();
        if (trimmedBody.length === 0) {
            throw new ConversationServiceError(
                "Message body must not be empty.",
                "INVALID_MESSAGE",
                400
            );
        }

        if (trimmedBody.length > 1000) {
            throw new ConversationServiceError(
                "Message body must not exceed 1000 characters.",
                "INVALID_MESSAGE",
                400
            );
        }

        const since = new Date(Date.now() - windowMinutes * 60_000);
        const sentInWindow = await tx.message.count({
            where: {
                conversationId,
                senderUserId,
                createdAt: { gte: since },
            },
        });

        if (sentInWindow >= maxMessages) {
            throw new ConversationServiceError(
                `Rate limit exceeded. Maximum ${maxMessages} messages per ${windowMinutes} minutes.`,
                "RATE_LIMIT_EXCEEDED",
                429
            );
        }

        const message = await tx.message.create({
            data: {
                conversationId,
                senderUserId,
                body: trimmedBody,
            },
        });

        await tx.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        });

        return message;
    });
}

// ── Utility ─────────────────────────────────────────────────────────────────

function isPrismaUniqueConstraintError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
    );
}
