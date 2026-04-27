export type ChatWidgetRole = "user" | "assistant";

export interface ChatWidgetMessage {
    id: string;
    role: ChatWidgetRole;
    content: string;
}

export interface ChatWidgetHistoryMessage {
    role: ChatWidgetRole;
    content: string;
}

export interface RequestChatAnswerOptions {
    message: string;
    history: ChatWidgetHistoryMessage[];
    signal?: AbortSignal;
}

export const CHAT_WIDGET_HISTORY_LIMIT = 10;

export const CHAT_WIDGET_SUGGESTIONS = [
    "How do I post a ride?",
    "How do bookings work in Desti?",
    "Where can I see my messages?",
] as const;

export const CHAT_WIDGET_GREETING =
    "Ask about rides, trip requests, bookings, offers, or messaging in Desti.";

export function toChatHistory(
    messages: ChatWidgetMessage[]
): ChatWidgetHistoryMessage[] {
    return messages.map(({ role, content }) => ({ role, content }));
}

export function trimChatHistory(
    history: ChatWidgetHistoryMessage[]
): ChatWidgetHistoryMessage[] {
    return history.slice(-CHAT_WIDGET_HISTORY_LIMIT);
}

async function readChatApiError(
    response: Response,
    fallbackMessage: string
): Promise<string> {
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
        return fallbackMessage;
    }

    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
        return maybeMessage;
    }

    const maybeError = (payload as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim()) {
        return maybeError;
    }

    return fallbackMessage;
}

export async function requestChatAnswer({
    message,
    history,
    signal,
}: RequestChatAnswerOptions): Promise<string> {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message,
            history,
        }),
        signal,
    });

    if (!response.ok) {
        throw new Error(
            await readChatApiError(response, "Failed to contact the Desti assistant.")
        );
    }

    const payload = (await response.json().catch(() => null)) as
        | { answer?: unknown }
        | null;
    if (!payload || typeof payload.answer !== "string" || !payload.answer.trim()) {
        throw new Error("Chat service returned an invalid response.");
    }

    return payload.answer;
}
