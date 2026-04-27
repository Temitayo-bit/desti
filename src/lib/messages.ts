export const MESSAGE_MAX_LENGTH = 1000;

export interface ConversationMessageItem {
    id: string;
    conversationId: string;
    senderUserId: string;
    body: string;
    createdAt: string;
}

interface ConversationWithId {
    id: string;
}

function encodeBase64(value: string): string {
    if (typeof globalThis.btoa === "function") {
        return globalThis.btoa(value);
    }

    return Buffer.from(value, "utf-8").toString("base64");
}

export function encodeMessageCursorFromItem(
    message: Pick<ConversationMessageItem, "id" | "createdAt">
): string {
    return encodeBase64(
        JSON.stringify({
            createdAt: message.createdAt,
            id: message.id,
        })
    );
}

function toEpoch(dateIso: string): number {
    const value = new Date(dateIso).getTime();
    return Number.isNaN(value) ? 0 : value;
}

/**
 * Appends incoming messages while removing duplicates by message id.
 * Output is always stable chronological ascending by (createdAt, id).
 */
export function appendUniqueMessages(
    existing: ConversationMessageItem[],
    incoming: ConversationMessageItem[]
): ConversationMessageItem[] {
    const byId = new Map<string, ConversationMessageItem>();

    for (const message of existing) {
        byId.set(message.id, message);
    }

    for (const message of incoming) {
        byId.set(message.id, message);
    }

    return Array.from(byId.values()).sort((a, b) => {
        const aEpoch = toEpoch(a.createdAt);
        const bEpoch = toEpoch(b.createdAt);
        if (aEpoch !== bEpoch) {
            return aEpoch - bEpoch;
        }

        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
    });
}

export function resolveSelectedConversationId<T extends ConversationWithId>({
    conversations,
    previousSelectedConversationId,
    requestedConversationId,
}: {
    conversations: T[];
    previousSelectedConversationId: string | null;
    requestedConversationId: string | null;
}): string | null {
    if (
        requestedConversationId &&
        conversations.some(
            (conversation) => conversation.id === requestedConversationId
        )
    ) {
        return requestedConversationId;
    }

    if (
        previousSelectedConversationId &&
        conversations.some(
            (conversation) => conversation.id === previousSelectedConversationId
        )
    ) {
        return previousSelectedConversationId;
    }

    return conversations[0]?.id ?? null;
}
