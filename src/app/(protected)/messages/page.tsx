"use client";

import {
    type FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    format,
    formatDistanceToNow,
    isToday,
    isTomorrow,
    isYesterday,
} from "date-fns";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ProtectedShell } from "../_components/ProtectedShell";
import {
    appendUniqueMessages,
    encodeMessageCursorFromItem,
    MESSAGE_MAX_LENGTH,
    resolveSelectedConversationId,
    type ConversationMessageItem,
} from "@/lib/messages";
import { useAdaptivePolling } from "@/lib/use-adaptive-polling";

interface ConversationListItem {
    id: string;
    type: "BOOKING" | "OFFER";
    bookingId: string | null;
    offerId: string | null;
    riderUserId: string;
    driverUserId: string;
    updatedAt: string;
    counterpartUserId: string;
    counterpartDisplayName: string;
    tripDestinationText: string | null;
    tripStartsAt: string | null;
    latestMessage: {
        id: string;
        conversationId: string;
        senderUserId: string;
        body: string;
        createdAt: string;
    } | null;
}

interface ConversationsResponse {
    items?: ConversationListItem[];
}

interface ConversationMessagesResponse {
    items?: ConversationMessageItem[];
    nextCursor?: string | null;
}

const MAX_HISTORY_PAGES = 100;

function toEpoch(value: string): number {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function sortConversationsByUpdatedAt(
    items: ConversationListItem[]
): ConversationListItem[] {
    return [...items].sort((a, b) => toEpoch(b.updatedAt) - toEpoch(a.updatedAt));
}

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

function formatUpdatedAt(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Just now";
    return formatDistanceToNow(parsed, { addSuffix: true });
}

function formatMessageTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return format(parsed, "h:mm a");
}

function formatRelativeTripDate(value: string | null): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    if (isToday(parsed)) {
        return `Today, ${format(parsed, "MMM d")}`;
    }

    if (isTomorrow(parsed)) {
        return `Tomorrow, ${format(parsed, "MMM d")}`;
    }

    if (isYesterday(parsed)) {
        return `Yesterday, ${format(parsed, "MMM d")}`;
    }

    return format(parsed, "EEE, MMM d");
}

function formatTripContext(
    destinationText: string | null,
    startsAt: string | null
): string | null {
    const destination = destinationText?.trim() || null;
    const relativeDate = formatRelativeTripDate(startsAt);

    if (destination && relativeDate) {
        return `${destination} · ${relativeDate}`;
    }

    return destination ?? relativeDate;
}

export default function MessagesPage() {
    const searchParams = useSearchParams();
    const requestedConversationId = searchParams.get("conversationId");
    const [conversations, setConversations] = useState<ConversationListItem[]>(
        []
    );
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [conversationsError, setConversationsError] = useState<string | null>(
        null
    );
    const [selectedConversationId, setSelectedConversationId] = useState<
        string | null
    >(null);
    const [mobileView, setMobileView] = useState<"list" | "thread">("list");

    const [messages, setMessages] = useState<ConversationMessageItem[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [threadError, setThreadError] = useState<string | null>(null);
    const [threadReloadToken, setThreadReloadToken] = useState(0);
    const [sendError, setSendError] = useState<string | null>(null);
    const [composerText, setComposerText] = useState("");
    const [sendingMessage, setSendingMessage] = useState(false);

    const messagesRef = useRef<ConversationMessageItem[]>([]);
    const threadRequestIdRef = useRef(0);
    const selectedConversationIdRef = useRef<string | null>(null);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);
    useEffect(() => {
        selectedConversationIdRef.current = selectedConversationId;
    }, [selectedConversationId]);

    const selectedConversation = useMemo(
        () =>
            conversations.find(
                (conversation) => conversation.id === selectedConversationId
            ) ?? null,
        [conversations, selectedConversationId]
    );
    const selectedTripContext = useMemo(() => {
        if (!selectedConversation) return null;
        return formatTripContext(
            selectedConversation.tripDestinationText,
            selectedConversation.tripStartsAt
        );
    }, [selectedConversation]);

    const currentUserId = useMemo(() => {
        if (!selectedConversation) return null;

        if (
            selectedConversation.counterpartUserId === selectedConversation.riderUserId
        ) {
            return selectedConversation.driverUserId;
        }

        return selectedConversation.riderUserId;
    }, [selectedConversation]);

    const refreshConversations = useCallback(
        async (silent: boolean) => {
            if (!silent) {
                setLoadingConversations(true);
            }

            try {
                const response = await fetch("/api/conversations");
                if (!response.ok) {
                    throw new Error(
                        await readApiErrorMessage(
                            response,
                            "Failed to load conversations."
                        )
                    );
                }

                const payload = (await response.json()) as ConversationsResponse;
                const sorted = sortConversationsByUpdatedAt(payload.items ?? []);

                setConversations(sorted);
                setConversationsError(null);
                setSelectedConversationId((previous) =>
                    resolveSelectedConversationId({
                        conversations: sorted,
                        previousSelectedConversationId: previous,
                        requestedConversationId,
                    })
                );
            } catch (error: unknown) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to load conversations.";
                setConversationsError(message);
            } finally {
                if (!silent) {
                    setLoadingConversations(false);
                }
            }
        },
        [requestedConversationId]
    );

    const updateConversationPreview = useCallback(
        (conversationId: string, message: ConversationMessageItem) => {
            setConversations((previous) => {
                const next = previous.map((conversation) => {
                    if (conversation.id !== conversationId) {
                        return conversation;
                    }

                    return {
                        ...conversation,
                        updatedAt: message.createdAt,
                        latestMessage: {
                            id: message.id,
                            conversationId: message.conversationId,
                            senderUserId: message.senderUserId,
                            body: message.body,
                            createdAt: message.createdAt,
                        },
                    };
                });

                return sortConversationsByUpdatedAt(next);
            });
        },
        []
    );

    useEffect(() => {
        void refreshConversations(false);
    }, [refreshConversations]);

    const conversationListFetcher = useCallback(async () => {
        const response = await fetch("/api/conversations");
        if (!response.ok) throw new Error("poll failed");
        return (await response.json()) as ConversationsResponse;
    }, []);

    const conversationListFingerprint = useCallback(
        (data: ConversationsResponse): string => {
            const items = data.items ?? [];
            const last = items[0];
            return `${items.length}:${last?.id ?? ""}:${last?.updatedAt ?? ""}`;
        },
        []
    );

    const onNewConversationListData = useCallback(
        (data: ConversationsResponse) => {
            const sorted = sortConversationsByUpdatedAt(data.items ?? []);
            setConversations(sorted);
            setConversationsError(null);
            setSelectedConversationId((previous) =>
                resolveSelectedConversationId({
                    conversations: sorted,
                    previousSelectedConversationId: previous,
                    requestedConversationId,
                })
            );
        },
        [requestedConversationId]
    );

    useAdaptivePolling({
        fetcher: conversationListFetcher,
        fingerprint: conversationListFingerprint,
        onNewData: onNewConversationListData,
        enabled: true,
        baseIntervalMs: 20_000,
        maxIntervalMs: 120_000,
    });

    useEffect(() => {
        if (!requestedConversationId) return;
        setMobileView("thread");
    }, [requestedConversationId]);

    const loadFullConversationHistory = useCallback(
        async (conversationId: string): Promise<ConversationMessageItem[]> => {
            let cursor: string | null = null;
            let allMessages: ConversationMessageItem[] = [];
            const seenCursors = new Set<string>();

            for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
                const search = new URLSearchParams({ limit: "50" });
                if (cursor) {
                    search.set("cursor", cursor);
                }

                const response = await fetch(
                    `/api/conversations/${conversationId}/messages?${search.toString()}`
                );
                if (!response.ok) {
                    throw new Error(
                        await readApiErrorMessage(
                            response,
                            "Failed to load message history."
                        )
                    );
                }

                const payload =
                    (await response.json()) as ConversationMessagesResponse;
                allMessages = appendUniqueMessages(allMessages, payload.items ?? []);
                const nextCursor = payload.nextCursor ?? null;

                if (!nextCursor) {
                    break;
                }

                if (seenCursors.has(nextCursor)) {
                    break;
                }

                seenCursors.add(nextCursor);
                cursor = nextCursor;
            }

            return allMessages;
        },
        []
    );

    useEffect(() => {
        if (!selectedConversationId) {
            setMessages([]);
            setThreadError(null);
            return;
        }

        const requestId = threadRequestIdRef.current + 1;
        threadRequestIdRef.current = requestId;
        setLoadingThread(true);
        setThreadError(null);

        void (async () => {
            try {
                const allMessages = await loadFullConversationHistory(
                    selectedConversationId
                );
                if (threadRequestIdRef.current !== requestId) {
                    return;
                }

                setMessages(allMessages);
            } catch (error: unknown) {
                if (threadRequestIdRef.current !== requestId) {
                    return;
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to load message history.";
                setThreadError(message);
                setMessages([]);
            } finally {
                if (threadRequestIdRef.current === requestId) {
                    setLoadingThread(false);
                }
            }
        })();
    }, [loadFullConversationHistory, selectedConversationId, threadReloadToken]);

    const threadFetcher = useCallback(async () => {
        const conversationId = selectedConversationIdRef.current;
        if (!conversationId) throw new Error("no thread");

        const lastMessage = messagesRef.current.at(-1);
        const search = new URLSearchParams({ limit: "50" });
        if (lastMessage) {
            search.set("cursor", encodeMessageCursorFromItem(lastMessage));
        }

        const response = await fetch(
            `/api/conversations/${conversationId}/messages?${search.toString()}`
        );
        if (!response.ok) throw new Error("poll failed");

        const payload = (await response.json()) as ConversationMessagesResponse;
        return {
            conversationId,
            requestId: threadRequestIdRef.current,
            items: payload.items ?? [],
        };
    }, []);

    const threadFingerprint = useCallback(
        (data: { items: ConversationMessageItem[] }): string => {
            const last = data.items.at(-1);
            return `${data.items.length}:${last?.id ?? ""}:${last?.createdAt ?? ""}`;
        },
        []
    );

    const onNewThreadData = useCallback(
        (data: {
            conversationId: string;
            requestId: number;
            items: ConversationMessageItem[];
        }) => {
            if (data.items.length === 0) return;
            if (
                threadRequestIdRef.current !== data.requestId ||
                selectedConversationIdRef.current !== data.conversationId
            ) {
                return;
            }

            setMessages((previous) => appendUniqueMessages(previous, data.items));
            updateConversationPreview(
                data.conversationId,
                data.items[data.items.length - 1]
            );
        },
        [updateConversationPreview]
    );

    useAdaptivePolling({
        fetcher: threadFetcher,
        fingerprint: threadFingerprint,
        onNewData: onNewThreadData,
        enabled: !!selectedConversationId && !loadingThread,
        baseIntervalMs: 5_000,
        maxIntervalMs: 60_000,
    });

    const onSelectConversation = (conversationId: string) => {
        setSelectedConversationId(conversationId);
        setThreadError(null);
        setSendError(null);
        setMobileView("thread");
    };

    const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedConversationId || sendingMessage) return;
        const targetConversationId = selectedConversationId;
        const sendRequestId = threadRequestIdRef.current;

        const trimmed = composerText.trim();
        if (!trimmed) {
            setSendError("Message body must not be empty.");
            return;
        }

        if (trimmed.length > MESSAGE_MAX_LENGTH) {
            setSendError(`Message body must not exceed ${MESSAGE_MAX_LENGTH} characters.`);
            return;
        }

        try {
            setSendingMessage(true);
            setSendError(null);

            const response = await fetch(
                `/api/conversations/${targetConversationId}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ body: trimmed }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    await readApiErrorMessage(response, "Failed to send message.")
                );
            }

            const createdMessage =
                (await response.json()) as ConversationMessageItem;
            if (
                threadRequestIdRef.current !== sendRequestId ||
                selectedConversationIdRef.current !== targetConversationId
            ) {
                return;
            }

            setMessages((previous) =>
                appendUniqueMessages(previous, [createdMessage])
            );
            updateConversationPreview(targetConversationId, createdMessage);
            setComposerText("");
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : "Failed to send message.";
            setSendError(message);
        } finally {
            setSendingMessage(false);
        }
    };

    const showListOnMobile = mobileView === "list";
    const showThreadOnMobile = mobileView === "thread";

    return (
        <ProtectedShell activeNav="messages">
            <section className="space-y-4">
                <header>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">
                        Messages
                    </h1>
                    <p className="mt-1 text-zinc-500">
                        Chat with your riders and drivers.
                    </p>
                </header>

                <div className="h-[72vh] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <div className="flex h-full min-h-0">
                        <aside
                            className={`${
                                showListOnMobile ? "flex" : "hidden"
                            } w-full min-h-0 flex-col border-r border-zinc-200 md:flex md:w-[340px]`}
                        >
                            <div className="border-b border-zinc-100 px-4 py-4">
                                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                                    All Conversations
                                </h2>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {loadingConversations ? (
                                    <div className="space-y-3 p-4">
                                        <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
                                        <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
                                    </div>
                                ) : conversationsError ? (
                                    <div className="p-4">
                                        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            {conversationsError}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => void refreshConversations(false)}
                                            className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : conversations.length === 0 ? (
                                    <div className="p-4 text-sm text-zinc-500">
                                        No conversations yet.
                                    </div>
                                ) : (
                                    <ul className="p-2">
                                        {conversations.map((conversation) => {
                                            const isActive =
                                                conversation.id ===
                                                selectedConversationId;
                                            const tripContext = formatTripContext(
                                                conversation.tripDestinationText,
                                                conversation.tripStartsAt
                                            );
                                            return (
                                                <li key={conversation.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onSelectConversation(
                                                                conversation.id
                                                            )
                                                        }
                                                        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                                            isActive
                                                                ? "border-emerald-200 bg-emerald-50"
                                                                : "border-transparent hover:bg-zinc-50"
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate font-semibold text-zinc-900">
                                                                    {
                                                                        conversation.counterpartDisplayName
                                                                    }
                                                                </p>
                                                                {tripContext ? (
                                                                    <p className="mt-0.5 truncate text-sm text-zinc-500">
                                                                        {tripContext}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <span className="shrink-0 text-xs text-zinc-400">
                                                                {formatUpdatedAt(
                                                                    conversation.updatedAt
                                                                )}
                                                            </span>
                                                        </div>

                                                        <p
                                                            className={`truncate text-sm text-zinc-600 ${
                                                                tripContext
                                                                    ? "mt-1.5"
                                                                    : "mt-2"
                                                            }`}
                                                        >
                                                            {conversation.latestMessage?.body ??
                                                                "No messages yet."}
                                                        </p>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </aside>

                        <section
                            className={`${
                                showThreadOnMobile ? "flex" : "hidden"
                            } min-h-0 flex-1 flex-col md:flex`}
                        >
                            {!selectedConversation ? (
                                <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
                                    Select a conversation to view messages.
                                </div>
                            ) : (
                                <>
                                    <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-4">
                                        <button
                                            type="button"
                                            onClick={() => setMobileView("list")}
                                            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 md:hidden"
                                            aria-label="Back to conversations"
                                        >
                                            <ArrowLeft size={18} />
                                        </button>

                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-zinc-900">
                                                {
                                                    selectedConversation.counterpartDisplayName
                                                }
                                            </p>
                                            {selectedTripContext ? (
                                                <p className="truncate text-sm text-zinc-500">
                                                    {selectedTripContext}
                                                </p>
                                            ) : null}
                                        </div>
                                    </header>

                                    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-4">
                                        {loadingThread ? (
                                            <div className="space-y-3">
                                                <div className="h-10 w-44 animate-pulse rounded-2xl bg-zinc-200" />
                                                <div className="ml-auto h-10 w-52 animate-pulse rounded-2xl bg-zinc-200" />
                                            </div>
                                        ) : threadError ? (
                                            <div className="space-y-3">
                                                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                                    {threadError}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setThreadReloadToken(
                                                            (current) =>
                                                                current + 1
                                                        )
                                                    }
                                                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <p className="text-sm text-zinc-500">
                                                No messages yet. Send the first message.
                                            </p>
                                        ) : (
                                            <ul className="space-y-3">
                                                {messages.map((message) => {
                                                    const isCurrentUserMessage =
                                                        message.senderUserId ===
                                                        currentUserId;

                                                    return (
                                                        <li
                                                            key={message.id}
                                                            className={`flex ${
                                                                isCurrentUserMessage
                                                                    ? "justify-end"
                                                                    : "justify-start"
                                                            }`}
                                                        >
                                                            <div
                                                                className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                                                                    isCurrentUserMessage
                                                                        ? "bg-emerald-700 text-white"
                                                                        : "bg-white text-zinc-900"
                                                                }`}
                                                            >
                                                                <p className="text-sm">
                                                                    {message.body}
                                                                </p>
                                                                <p
                                                                    className={`mt-1 text-xs ${
                                                                        isCurrentUserMessage
                                                                            ? "text-emerald-100"
                                                                            : "text-zinc-400"
                                                                    }`}
                                                                >
                                                                    {formatMessageTime(
                                                                        message.createdAt
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>

                                    <footer className="border-t border-zinc-100 bg-white px-4 py-3">
                                        <form
                                            className="space-y-2"
                                            onSubmit={onSendMessage}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={composerText}
                                                    onChange={(event) =>
                                                        setComposerText(
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Type a message..."
                                                    className="h-11 flex-1 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500"
                                                    maxLength={
                                                        MESSAGE_MAX_LENGTH
                                                    }
                                                    disabled={sendingMessage}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={
                                                        sendingMessage ||
                                                        !selectedConversationId
                                                    }
                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label="Send message"
                                                >
                                                    <SendHorizontal size={18} />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs text-zinc-400">
                                                    {composerText.trim().length}/
                                                    {MESSAGE_MAX_LENGTH}
                                                </p>
                                                {sendError ? (
                                                    <p className="text-xs text-red-600">
                                                        {sendError}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </form>
                                        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs text-blue-700">
                                            Keep conversations respectful and related to your
                                            ride. Report any inappropriate behavior.
                                        </div>
                                    </footer>
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </section>
        </ProtectedShell>
    );
}
