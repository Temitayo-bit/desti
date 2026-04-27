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
import { useAuth } from "@clerk/nextjs";
import {
    ArrowLeft,
    Car,
    Info,
    Loader2,
    SendHorizontal,
    Shield,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UserAvatar } from "@/components/UserAvatar";
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

function formatRideRequestLine(
    destinationText: string | null,
    startsAt: string | null
): string {
    const destination = destinationText?.trim() || "Trip";
    const datePart = formatRelativeTripDate(startsAt);
    if (datePart) {
        return `${destination} · ${datePart}`;
    }
    return destination;
}

function conversationStatusMeta(
    conversation: ConversationListItem
): { label: string; tone: "ride" | "offer" | "done" } {
    if (conversation.type === "OFFER") {
        return { label: "Offer Pending", tone: "offer" };
    }

    const start = conversation.tripStartsAt
        ? new Date(conversation.tripStartsAt)
        : null;
    if (start && !Number.isNaN(start.getTime())) {
        if (start.getTime() > Date.now()) {
            return { label: "Active Ride", tone: "ride" };
        }
        return { label: "Completed", tone: "done" };
    }

    return { label: "Confirmed Trip", tone: "ride" };
}

function conversationDetailHref(
    conversation: ConversationListItem
): { href: string; label: string } | null {
    if (conversation.bookingId) {
        return {
            href: `/confirmed/${conversation.bookingId}`,
            label: "View Trip",
        };
    }
    if (conversation.offerId) {
        return { href: "/offers", label: "View Offer" };
    }
    return null;
}

function formatListTime(iso: string): string {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "";
    if (isToday(parsed)) {
        return format(parsed, "h:mm a");
    }
    if (isYesterday(parsed)) {
        return "Yesterday";
    }
    return formatDistanceToNow(parsed, { addSuffix: true });
}

function messageDayLabel(iso: string): string {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "";
    if (isToday(parsed)) return "Today";
    if (isYesterday(parsed)) return "Yesterday";
    return format(parsed, "EEEE, MMM d");
}

type ThreadRow =
    | { kind: "divider"; label: string; key: string }
    | { kind: "message"; message: ConversationMessageItem; key: string };

function buildThreadRows(messages: ConversationMessageItem[]): ThreadRow[] {
    const rows: ThreadRow[] = [];
    let lastDay: string | null = null;
    for (const message of messages) {
        const day = format(new Date(message.createdAt), "yyyy-MM-dd");
        if (day !== lastDay) {
            lastDay = day;
            rows.push({
                kind: "divider",
                label: messageDayLabel(message.createdAt),
                key: `d-${day}`,
            });
        }
        rows.push({ kind: "message", message, key: message.id });
    }
    return rows;
}

export default function MessagesPage() {
    const { userId } = useAuth();
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

    const activeTripConversations = useMemo(
        () => conversations.filter((c) => c.type === "BOOKING"),
        [conversations]
    );
    const offerConversations = useMemo(
        () => conversations.filter((c) => c.type === "OFFER"),
        [conversations]
    );

    const threadRows = useMemo(() => buildThreadRows(messages), [messages]);

    const selectedStatus = useMemo(
        () =>
            selectedConversation
                ? conversationStatusMeta(selectedConversation)
                : null,
        [selectedConversation]
    );

    const selectedDetailLink = useMemo(
        () =>
            selectedConversation
                ? conversationDetailHref(selectedConversation)
                : null,
        [selectedConversation]
    );

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

    const composerDisabled =
        sendingMessage ||
        !selectedConversationId ||
        !composerText.trim();

    function renderConversationButton(conversation: ConversationListItem) {
        const isActive = conversation.id === selectedConversationId;
        const tripContext = formatTripContext(
            conversation.tripDestinationText,
            conversation.tripStartsAt
        );
        const previewTimeIso =
            conversation.latestMessage?.createdAt ?? conversation.updatedAt;
        const showUnreadDot =
            Boolean(userId) &&
            Boolean(conversation.latestMessage) &&
            conversation.latestMessage!.senderUserId !== userId;

        return (
            <li key={conversation.id}>
                <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        isActive
                            ? "bg-emerald-50 ring-1 ring-emerald-200/80"
                            : "hover:bg-zinc-50"
                    }`}
                >
                    <UserAvatar
                        name={conversation.counterpartDisplayName}
                        size="md"
                        className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-semibold text-zinc-900">
                                {conversation.counterpartDisplayName}
                            </p>
                            <span className="shrink-0 text-[0.7rem] text-zinc-400 tabular-nums">
                                {formatListTime(previewTimeIso)}
                            </span>
                        </div>
                        {tripContext ? (
                            <p className="mt-0.5 truncate text-xs text-zinc-500">
                                {tripContext}
                            </p>
                        ) : null}
                        <p
                            className={`line-clamp-2 text-sm text-zinc-600 ${
                                tripContext ? "mt-1" : "mt-1.5"
                            }`}
                        >
                            {conversation.latestMessage?.body ?? "No messages yet."}
                        </p>
                    </div>
                    {showUnreadDot ? (
                        <span
                            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600"
                            aria-label="Unread"
                        />
                    ) : (
                        <span className="w-2 shrink-0" aria-hidden />
                    )}
                </button>
            </li>
        );
    }

    return (
        <ProtectedShell
            activeNav="messages"
            layout="topnav"
            topNavActive="messages"
        >
            <section className="space-y-4">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
                        Messages
                    </h1>
                    <p className="mt-1 text-sm text-zinc-600">
                        Chat with people you are matched with on rides and trip requests.
                    </p>
                </header>

                <div
                    className="flex gap-2 rounded-xl border border-emerald-100/90 bg-white/80 px-3 py-2.5 text-sm text-zinc-600 shadow-sm md:px-4 md:py-3"
                    role="note"
                >
                    <Shield
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700/90"
                        strokeWidth={2}
                        aria-hidden
                    />
                    <p className="leading-snug">
                        Only communicate with verified students. Do not share sensitive
                        information like passwords or bank details.
                    </p>
                </div>

                <div className="h-[min(72vh,calc(100vh-12rem))] min-h-[420px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <div className="flex h-full min-h-0">
                        <aside
                            className={`${
                                showListOnMobile ? "flex" : "hidden"
                            } w-full min-h-0 flex-col border-r border-zinc-100 md:flex md:w-[min(100%,380px)] md:max-w-[380px]`}
                        >
                            <div className="border-b border-zinc-100 px-4 py-3">
                                <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                                    Chats
                                </h2>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {loadingConversations ? (
                                    <div className="space-y-3 p-4">
                                        <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
                                        <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
                                        <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
                                    </div>
                                ) : conversationsError ? (
                                    <div className="p-4">
                                        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            {conversationsError}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => void refreshConversations(false)}
                                            className="mt-3 rounded-lg bg-[#0d3d2e] px-3 py-2 text-sm font-medium text-white hover:bg-[#0a3026]"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : conversations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                                        <p className="text-sm font-medium text-zinc-800">
                                            No conversations yet
                                        </p>
                                        <p className="max-w-xs text-sm text-zinc-500">
                                            When you confirm a booking or message someone about
                                            an offer, the thread will show up here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="pb-3">
                                        {activeTripConversations.length > 0 ? (
                                            <div className="px-3 pt-2">
                                                <p className="px-1 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
                                                    Active trips
                                                </p>
                                                <ul className="space-y-0.5">
                                                    {activeTripConversations.map(
                                                        renderConversationButton
                                                    )}
                                                </ul>
                                            </div>
                                        ) : null}
                                        {offerConversations.length > 0 ? (
                                            <div className="px-3 pt-3">
                                                <p className="px-1 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
                                                    Offers / inquiries
                                                </p>
                                                <ul className="space-y-0.5">
                                                    {offerConversations.map(
                                                        renderConversationButton
                                                    )}
                                                </ul>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </aside>

                        <section
                            className={`${
                                showThreadOnMobile ? "flex" : "hidden"
                            } min-h-0 flex-1 flex-col bg-zinc-50/80 md:flex`}
                        >
                            {!selectedConversation ? (
                                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                                    <p className="text-sm font-medium text-zinc-700">
                                        Select a conversation
                                    </p>
                                    <p className="max-w-sm text-sm text-zinc-500">
                                        Choose a chat on the left to view your message history.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <header className="flex items-start gap-3 border-b border-zinc-100 bg-white px-3 py-3 md:px-4">
                                        <button
                                            type="button"
                                            onClick={() => setMobileView("list")}
                                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 md:hidden"
                                            aria-label="Back to conversations"
                                        >
                                            <ArrowLeft size={18} />
                                        </button>
                                        <UserAvatar
                                            name={selectedConversation.counterpartDisplayName}
                                            size="md"
                                            className="shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate font-semibold text-zinc-900">
                                                    {selectedConversation.counterpartDisplayName}
                                                </p>
                                                {selectedStatus ? (
                                                    <span
                                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                                                            selectedStatus.tone === "offer"
                                                                ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80"
                                                                : selectedStatus.tone === "done"
                                                                  ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                                                                  : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80"
                                                        }`}
                                                    >
                                                        {selectedStatus.label}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {selectedTripContext ? (
                                                <p className="mt-0.5 truncate text-sm text-zinc-500">
                                                    {selectedTripContext}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="hidden shrink-0 items-center gap-1 sm:flex">
                                            {selectedDetailLink ? (
                                                <Link
                                                    href={selectedDetailLink.href}
                                                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0d3d2e] hover:bg-emerald-50"
                                                >
                                                    {selectedDetailLink.label}
                                                </Link>
                                            ) : null}
                                            <button
                                                type="button"
                                                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                                                title={
                                                    selectedTripContext
                                                        ? selectedTripContext
                                                        : "Conversation details"
                                                }
                                                aria-label="Conversation details"
                                            >
                                                <Info size={18} />
                                            </button>
                                        </div>
                                    </header>

                                    {selectedConversation.type === "BOOKING" &&
                                    selectedTripContext ? (
                                        <div className="border-b border-emerald-100/80 bg-emerald-50/35 px-4 py-3">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                                                    <Car size={18} strokeWidth={2} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-800/90">
                                                        Trip summary
                                                    </p>
                                                    <p className="mt-0.5 text-sm text-zinc-800">
                                                        {formatRideRequestLine(
                                                            selectedConversation.tripDestinationText,
                                                            selectedConversation.tripStartsAt
                                                        )}
                                                    </p>
                                                    {selectedDetailLink ? (
                                                        <Link
                                                            href={selectedDetailLink.href}
                                                            className="mt-2 inline-flex text-xs font-semibold text-emerald-900 underline decoration-emerald-900/30 underline-offset-2 hover:decoration-emerald-900"
                                                        >
                                                            {selectedDetailLink.label}
                                                        </Link>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                    {selectedConversation.type === "OFFER" ? (
                                        <div className="border-b border-amber-100/80 bg-amber-50/40 px-4 py-3">
                                            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-900/90">
                                                Offer status
                                            </p>
                                            <p className="mt-1 text-sm text-zinc-800">
                                                {formatRideRequestLine(
                                                    selectedConversation.tripDestinationText,
                                                    selectedConversation.tripStartsAt
                                                )}
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-600">
                                                Messages are tied to this trip request offer.
                                            </p>
                                            {selectedDetailLink ? (
                                                <Link
                                                    href={selectedDetailLink.href}
                                                    className="mt-2 inline-flex text-xs font-semibold text-amber-950 underline decoration-amber-950/30 underline-offset-2 hover:decoration-amber-950"
                                                >
                                                    {selectedDetailLink.label}
                                                </Link>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-4">
                                        {loadingThread ? (
                                            <div className="space-y-3">
                                                <div className="h-9 w-40 animate-pulse rounded-2xl bg-zinc-200/90" />
                                                <div className="ml-auto h-9 w-48 animate-pulse rounded-2xl bg-zinc-200/90" />
                                            </div>
                                        ) : threadError ? (
                                            <div className="space-y-3">
                                                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                                    {threadError}
                                                </p>
                                                <p className="text-xs text-zinc-500">
                                                    We couldn&apos;t load messages for this chat.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setThreadReloadToken((c) => c + 1)
                                                    }
                                                    className="rounded-lg bg-[#0d3d2e] px-3 py-2 text-sm font-medium text-white hover:bg-[#0a3026]"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <p className="text-center text-sm text-zinc-500">
                                                No messages yet. Send the first message.
                                            </p>
                                        ) : (
                                            <ul className="space-y-4">
                                                {threadRows.map((row) => {
                                                    if (row.kind === "divider") {
                                                        return (
                                                            <li
                                                                key={row.key}
                                                                className="flex justify-center"
                                                            >
                                                                <span className="rounded-full bg-zinc-200/70 px-3 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-600">
                                                                    {row.label}
                                                                </span>
                                                            </li>
                                                        );
                                                    }

                                                    const message = row.message;
                                                    const isCurrentUserMessage =
                                                        message.senderUserId === currentUserId;

                                                    return (
                                                        <li
                                                            key={row.key}
                                                            className={`flex gap-2 ${
                                                                isCurrentUserMessage
                                                                    ? "justify-end"
                                                                    : "justify-start"
                                                            }`}
                                                        >
                                                            {!isCurrentUserMessage ? (
                                                                <UserAvatar
                                                                    name={
                                                                        selectedConversation.counterpartDisplayName
                                                                    }
                                                                    size="sm"
                                                                    className="mt-0.5 shrink-0 self-end"
                                                                />
                                                            ) : null}
                                                            <div
                                                                className={`max-w-[min(100%,20rem)] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[75%] ${
                                                                    isCurrentUserMessage
                                                                        ? "rounded-br-md bg-[#0d3d2e] text-white"
                                                                        : "rounded-bl-md border border-zinc-100 bg-white text-zinc-900"
                                                                }`}
                                                            >
                                                                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                                                    {message.body}
                                                                </p>
                                                                <p
                                                                    className={`mt-1.5 text-[0.65rem] tabular-nums ${
                                                                        isCurrentUserMessage
                                                                            ? "text-emerald-100/90"
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

                                    <footer className="border-t border-zinc-100 bg-white px-3 py-3 md:px-4">
                                        <form className="space-y-2" onSubmit={onSendMessage}>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={composerText}
                                                    onChange={(event) =>
                                                        setComposerText(event.target.value)
                                                    }
                                                    placeholder="Type a message…"
                                                    className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                                                    maxLength={MESSAGE_MAX_LENGTH}
                                                    disabled={sendingMessage}
                                                    aria-invalid={Boolean(sendError)}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={composerDisabled}
                                                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#0d3d2e] px-4 text-sm font-semibold text-white transition hover:bg-[#0a3026] disabled:cursor-not-allowed disabled:opacity-45"
                                                >
                                                    {sendingMessage ? (
                                                        <Loader2
                                                            className="h-4 w-4 animate-spin"
                                                            aria-hidden
                                                        />
                                                    ) : (
                                                        <SendHorizontal
                                                            size={17}
                                                            aria-hidden
                                                        />
                                                    )}
                                                    <span className="hidden sm:inline">
                                                        {sendingMessage ? "Sending" : "Send"}
                                                    </span>
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-[0.65rem] text-zinc-400 tabular-nums">
                                                    {composerText.trim().length}/{MESSAGE_MAX_LENGTH}
                                                </p>
                                                {sendError ? (
                                                    <p className="text-xs font-medium text-red-600">
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
