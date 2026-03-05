/**
 * Conversation authorization helper.
 *
 * Non-participants always receive a 404 ("not found") response.
 * This prevents information leakage — an attacker cannot distinguish
 * between "conversation exists but I'm not allowed" and "conversation
 * does not exist".
 */

import { prisma } from "@/lib/prisma";
import { ConversationServiceError } from "@/services/conversationService";
import type { Conversation } from "@prisma/client";

/**
 * Asserts that the given user is a participant (rider or driver) of the
 * conversation. Returns the conversation row on success.
 *
 * @throws {ConversationServiceError} with statusCode 404 if the
 *   conversation does not exist or the user is not a participant.
 */
export async function assertConversationParticipant(
    conversationId: string,
    userId: string
): Promise<Conversation> {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
    });

    if (
        !conversation ||
        (conversation.riderUserId !== userId &&
            conversation.driverUserId !== userId)
    ) {
        throw new ConversationServiceError(
            "Conversation not found.",
            "CONVERSATION_NOT_FOUND",
            404
        );
    }

    return conversation;
}
