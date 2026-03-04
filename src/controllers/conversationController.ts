import type { Conversation } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertConversationParticipant } from "@/helpers/conversationAuth";
import {
    ConversationServiceError,
    getOrCreateBookingConversation,
    getOrCreateOfferConversation,
    listUserConversations,
} from "@/services/conversationService";

const latestMessageSelect = {
    id: true,
    conversationId: true,
    senderUserId: true,
    body: true,
    createdAt: true,
} as const;

export interface ConversationListItem {
    id: string;
    type: Conversation["type"];
    bookingId: string | null;
    offerId: string | null;
    riderUserId: string;
    driverUserId: string;
    updatedAt: Date;
    latestMessage: {
        id: string;
        conversationId: string;
        senderUserId: string;
        body: string;
        createdAt: Date;
    } | null;
}

/**
 * Returns conversations for a user with latest-message preview.
 */
export async function listConversationsController(
    userId: string
): Promise<ConversationListItem[]> {
    const conversations = await listUserConversations(userId);

    const latestMessages = await Promise.all(
        conversations.map((conversation) =>
            prisma.message.findFirst({
                where: { conversationId: conversation.id },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: latestMessageSelect,
            })
        )
    );

    return conversations.map((conversation, index) => ({
        id: conversation.id,
        type: conversation.type,
        bookingId: conversation.bookingId,
        offerId: conversation.offerId,
        riderUserId: conversation.riderUserId,
        driverUserId: conversation.driverUserId,
        updatedAt: conversation.updatedAt,
        latestMessage: latestMessages[index],
    }));
}

/**
 * Creates or returns an existing booking conversation, then enforces participant access.
 */
export async function createOrGetBookingConversationController(
    userId: string,
    bookingId: string
): Promise<Conversation> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true,
            riderUserId: true,
            driverUserId: true,
            ride: {
                select: {
                    driverUserId: true,
                },
            },
        },
    });

    if (!booking) {
        throw new ConversationServiceError(
            "Booking not found.",
            "BOOKING_NOT_FOUND",
            404
        );
    }

    const driverUserId = booking.driverUserId ?? booking.ride?.driverUserId ?? null;
    const isParticipant =
        booking.riderUserId === userId ||
        (driverUserId !== null && driverUserId === userId);

    if (!isParticipant) {
        throw new ConversationServiceError(
            "Booking not found.",
            "BOOKING_NOT_FOUND",
            404
        );
    }

    const conversation = await getOrCreateBookingConversation(bookingId);
    await assertConversationParticipant(conversation.id, userId);
    return conversation;
}

/**
 * Creates or returns an existing offer conversation, then enforces participant access.
 */
export async function createOrGetOfferConversationController(
    userId: string,
    offerId: string
): Promise<Conversation> {
    const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        select: {
            id: true,
            riderUserId: true,
            driverUserId: true,
        },
    });

    if (!offer) {
        throw new ConversationServiceError(
            "Offer not found.",
            "OFFER_NOT_FOUND",
            404
        );
    }

    if (offer.riderUserId !== userId && offer.driverUserId !== userId) {
        throw new ConversationServiceError(
            "Offer not found.",
            "OFFER_NOT_FOUND",
            404
        );
    }

    const conversation = await getOrCreateOfferConversation(offerId);
    await assertConversationParticipant(conversation.id, userId);
    return conversation;
}
