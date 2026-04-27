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
import { ArrowLeft, Loader2, MessageSquare, SendHorizontal } from "lucide-react";
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

function formatDateDivider(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    if (isToday(parsed)) return "Today";
    if (isYesterday(parsed)) return "Yesterday";
    return format(parsed, "EEEE, MMM d");
}

function getInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
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
    const threadEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);
    useEffect(() => {
        selectedConversationIdRef.current = selectedConversationId;
    }, [selectedConversationId]);

    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
                                    Conversations
                                </h2>
                                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    Only verified students. Never share passwords or bank info.
                                </p>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {loadingConversations ? (
                                    <div className="space-y-3 p-4">
                                        {[1,2,3].map(i => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-100" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                                                    <div className="h-3 w-36 animate-pulse rounded bg-zinc-100" />
                                                </div>
                                            </div>
                                        ))}
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
                                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                                            <MessageSquare size={20} className="text-zinc-400" />
                                        </div>
                                        <p className="text-sm font-medium text-zinc-500">No conversations yet</p>
                                        <p className="text-xs text-zinc-400">Messages from rides and offers will appear here.</p>
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
                                            const initial = getInitial(conversation.counterpartDisplayName);
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
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                                                isActive ? "bg-emerald-200 text-emerald-800" : "bg-zinc-100 text-zinc-600"
                                                            }`}>
                                                                {initial}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="truncate text-sm font-semibold text-zinc-900">
                                                                        {conversation.counterpartDisplayName}
                                                                    </p>
                                                                    <span className="shrink-0 text-[11px] text-zinc-400">
                                                                        {formatUpdatedAt(conversation.updatedAt)}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                                                        conversation.type === "BOOKING"
                                                                            ? "bg-emerald-100 text-emerald-700"
                                                                            : "bg-amber-100 text-amber-700"
                                                                    }`}>
                                                                        {conversation.type === "BOOKING" ? "Trip" : "Offer"}
                                                                    </span>
                                                                    {tripContext && (
                                                                        <span className="truncate text-[11px] text-zinc-400">{tripContext}</span>
                                                                    )}
                                                                </div>
                                                                <p className="mt-1 truncate text-sm text-zinc-500">
                                                                    {conversation.latestMessage?.body ?? "No messages yet."}
                                                                </p>
                                                            </div>
                                                        </div>
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
                                <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
                                        <MessageSquare size={28} className="text-zinc-300" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-zinc-500">Select a conversation</p>
                                        <p className="mt-1 text-xs text-zinc-400">Pick one from the sidebar to start chatting.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => setMobileView("list")}
                                            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 md:hidden"
                                            aria-label="Back to conversations"
                                        >
                                            <ArrowLeft size={18} />
                                        </button>

                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold bg-emerald-100 text-emerald-700`}>
                                            {getInitial(selectedConversation.counterpartDisplayName)}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-semibold text-zinc-900">
                                                    {selectedConversation.counterpartDisplayName}
                                                </p>
                                                <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    selectedConversation.type === "BOOKING"
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-amber-100 text-amber-700"
                                                }`}>
                                                    {selectedConversation.type === "BOOKING" ? "Active Trip" : "Offer"}
                                                </span>
                                            </div>
                                            {selectedTripContext && (
                                                <p className="truncate text-xs text-zinc-400">
                                                    {selectedTripContext}
                                                </p>
                                            )}
                                        </div>
                                    </header>

                                    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-4">
                                        {loadingThread ? (
                                            <div className="space-y-3">
                                                <div className="h-10 w-44 animate-pulse rounded-2xl bg-zinc-200" />
                                                <div className="ml-auto h-10 w-52 animate-pulse rounded-2xl bg-zinc-200" />
                                                <div className="h-10 w-36 animate-pulse rounded-2xl bg-zinc-200" />
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
                                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                                <p className="text-sm font-medium text-zinc-500">No messages yet</p>
                                                <p className="text-xs text-zinc-400">Send the first message to start the conversation.</p>
                                            </div>
                                        ) : (
                                            <ul className="space-y-3">
                                                {messages.map((message, idx) => {
                                                    const isCurrentUserMessage =
                                                        message.senderUserId ===
                                                        currentUserId;

                                                    const currentDate = formatDateDivider(message.createdAt);
                                                    const prevDate = idx > 0 ? formatDateDivider(messages[idx - 1].createdAt) : null;
                                                    const showDivider = currentDate && currentDate !== prevDate;

                                                    return (
                                                        <li key={message.id}>
                                                            {showDivider && (
                                                                <div className="mb-3 flex items-center gap-3 py-1">
                                                                    <div className="h-px flex-1 bg-zinc-200" />
                                                                    <span className="text-[11px] font-medium text-zinc-400">{currentDate}</span>
                                                                    <div className="h-px flex-1 bg-zinc-200" />
                                                                </div>
                                                            )}
                                                            <div
                                                                className={`flex ${
                                                                    isCurrentUserMessage
                                                                        ? "justify-end"
                                                                        : "justify-start"
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                                                        isCurrentUserMessage
                                                                            ? "bg-emerald-700 text-white"
                                                                            : "bg-white text-zinc-900"
                                                                    }`}
                                                                >
                                                                    <p className="text-sm leading-relaxed">
                                                                        {message.body}
                                                                    </p>
                                                                    <p
                                                                        className={`mt-1 text-[11px] ${
                                                                            isCurrentUserMessage
                                                                                ? "text-emerald-200"
                                                                                : "text-zinc-400"
                                                                        }`}
                                                                    >
                                                                        {formatMessageTime(
                                                                            message.createdAt
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                                <div ref={threadEndRef} />
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
                                                        !composerText.trim() ||
                                                        !selectedConversationId
                                                    }
                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label="Send message"
                                                >
                                                    {sendingMessage ? (
                                                        <Loader2 size={18} className="animate-spin" />
                                                    ) : (
                                                        <SendHorizontal size={18} />
                                                    )}
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
