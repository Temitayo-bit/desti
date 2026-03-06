export interface OpenBookingConversationSuccess {
    ok: true;
    conversationId: string;
    href: string;
}

export interface OpenBookingConversationFailure {
    ok: false;
    message: string;
}

export type OpenBookingConversationResult =
    | OpenBookingConversationSuccess
    | OpenBookingConversationFailure;

type FetchLike = typeof fetch;

async function readApiErrorMessage(
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

export async function openBookingConversationThread(
    bookingId: string,
    fetcher: FetchLike = fetch
): Promise<OpenBookingConversationResult> {
    try {
        const response = await fetcher(
            `/api/conversations/for-booking/${bookingId}`,
            {
                method: "POST",
            }
        );

        if (!response.ok) {
            return {
                ok: false,
                message: await readApiErrorMessage(
                    response,
                    "Unable to open messages for this booking."
                ),
            };
        }

        const payload = (await response.json()) as { id?: unknown };
        if (typeof payload.id !== "string" || payload.id.length === 0) {
            return {
                ok: false,
                message: "Unable to open messages for this booking.",
            };
        }

        return {
            ok: true,
            conversationId: payload.id,
            href: `/messages?conversationId=${encodeURIComponent(payload.id)}`,
        };
    } catch {
        return {
            ok: false,
            message: "Unable to open messages for this booking.",
        };
    }
}
