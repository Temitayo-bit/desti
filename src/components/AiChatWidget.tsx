"use client";

import { useAuth } from "@clerk/nextjs";
import {
    type FormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type RefObject,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Bot,
    MessageCircle,
    RotateCcw,
    SendHorizontal,
    Sparkles,
    X,
} from "lucide-react";
import {
    CHAT_WIDGET_GREETING,
    CHAT_WIDGET_SUGGESTIONS,
    requestChatAnswer,
    trimChatHistory,
    toChatHistory,
    type ChatWidgetHistoryMessage,
    type ChatWidgetMessage,
} from "@/lib/chat-widget";

interface PendingSubmission {
    content: string;
    history: ChatWidgetHistoryMessage[];
}

interface AiChatWidgetPanelProps {
    composerRef: RefObject<HTMLTextAreaElement | null>;
    draft: string;
    errorMessage: string | null;
    isSending: boolean;
    messages: ChatWidgetMessage[];
    onClose: () => void;
    onDraftChange: (value: string) => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
    onRetry: () => void;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onSuggestedPrompt: (prompt: string) => void;
}

function ChatBubble({ message }: { message: ChatWidgetMessage }) {
    const isUser = message.role === "user";

    return (
        <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            data-role={message.role}
        >
            <div
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    isUser
                        ? "rounded-br-lg bg-emerald-600 text-white"
                        : "rounded-bl-lg border border-zinc-200 bg-white text-zinc-700"
                }`}
            >
                {message.content}
            </div>
        </div>
    );
}

export function AiChatWidgetPanel({
    composerRef,
    draft,
    errorMessage,
    isSending,
    messages,
    onClose,
    onDraftChange,
    onKeyDown,
    onRetry,
    scrollContainerRef,
    onSubmit,
    onSuggestedPrompt,
}: AiChatWidgetPanelProps) {
    const isEmpty = messages.length === 0;
    const submitDisabled = isSending || draft.trim().length === 0;

    return (
        <section
            aria-labelledby="ai-chat-widget-title"
            aria-modal="true"
            className="fixed inset-x-4 bottom-4 z-50 flex max-h-[min(42rem,calc(100vh-1rem))] flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-zinc-50 shadow-2xl md:inset-x-auto md:bottom-24 md:right-4 md:w-[24rem] md:rounded-[1.75rem]"
            role="dialog"
        >
            <header className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                            <Bot size={18} />
                        </div>
                        <div>
                            <h2
                                id="ai-chat-widget-title"
                                className="text-sm font-semibold text-zinc-900"
                            >
                                Desti Assistant
                            </h2>
                            <p className="text-xs text-zinc-500">
                                In-app help for Desti features
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    aria-label="Close Desti assistant"
                    className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                    onClick={onClose}
                    type="button"
                >
                    <X size={18} />
                </button>
            </header>

            <div
                className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
                ref={scrollContainerRef}
            >
                {isEmpty ? (
                    <div className="rounded-[1.5rem] border border-dashed border-emerald-200 bg-emerald-50/70 p-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-2xl bg-white p-2 text-emerald-700 shadow-sm">
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-zinc-900">
                                    Need help using Desti?
                                </p>
                                <p className="mt-1 text-sm leading-6 text-zinc-600">
                                    {CHAT_WIDGET_GREETING}
                                </p>
                                <p className="mt-2 text-xs text-zinc-500">
                                    Chat resets when you refresh the page.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {CHAT_WIDGET_SUGGESTIONS.map((prompt) => (
                                <button
                                    key={prompt}
                                    className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-left text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100/60 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isSending}
                                    onClick={() => onSuggestedPrompt(prompt)}
                                    type="button"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {messages.map((message) => (
                            <ChatBubble key={message.id} message={message} />
                        ))}
                        {isSending ? (
                            <div className="flex justify-start">
                                <div className="rounded-3xl rounded-bl-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm">
                                    Desti Assistant is thinking...
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            <div className="border-t border-zinc-200 bg-white px-4 py-4">
                {errorMessage ? (
                    <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                        <p>{errorMessage}</p>
                        <button
                            className="mt-2 inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                            onClick={onRetry}
                            type="button"
                        >
                            <RotateCcw size={14} />
                            Retry
                        </button>
                    </div>
                ) : null}

                <form className="space-y-3" onSubmit={onSubmit}>
                    <label className="sr-only" htmlFor="ai-chat-widget-composer">
                        Message Desti Assistant
                    </label>
                    <textarea
                        aria-label="Message Desti Assistant"
                        className="min-h-[96px] w-full resize-none rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white"
                        disabled={isSending}
                        id="ai-chat-widget-composer"
                        ref={composerRef}
                        onChange={(event) => onDraftChange(event.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Ask how to use rides, trip requests, bookings, or messages..."
                        rows={4}
                        value={draft}
                    />
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-zinc-500">
                            Press Enter to send. Use Shift+Enter for a new line.
                        </p>
                        <button
                            aria-label="Send message to Desti assistant"
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            <SendHorizontal size={18} />
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}

export function AiChatWidget() {
    const { userId } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatWidgetMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pendingSubmission, setPendingSubmission] =
        useState<PendingSubmission | null>(null);

    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const nextMessageIdRef = useRef(0);
    const previousUserIdRef = useRef<string | null | undefined>(userId);
    const requestAbortControllerRef = useRef<AbortController | null>(null);

    function buildMessage(
        role: ChatWidgetMessage["role"],
        content: string
    ): ChatWidgetMessage {
        nextMessageIdRef.current += 1;
        return {
            id: `chat-widget-message-${nextMessageIdRef.current}`,
            role,
            content,
        };
    }

    async function sendMessage(
        message: string,
        history: ChatWidgetHistoryMessage[]
    ) {
        const controller = new AbortController();
        requestAbortControllerRef.current = controller;
        setIsSending(true);
        setErrorMessage(null);
        setPendingSubmission({
            content: message,
            history,
        });

        try {
            const answer = await requestChatAnswer({
                message,
                history,
                signal: controller.signal,
            });
            setMessages((previous) => [
                ...previous,
                buildMessage("assistant", answer),
            ]);
            setPendingSubmission(null);
        } catch (error: unknown) {
            if (controller.signal.aborted) {
                return;
            }

            const nextMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to contact the Desti assistant.";
            setErrorMessage(nextMessage);
        } finally {
            if (requestAbortControllerRef.current === controller) {
                requestAbortControllerRef.current = null;
            }
            setIsSending(false);
        }
    }

    function submitMessage(content: string) {
        const trimmed = content.trim();
        if (!trimmed || isSending) {
            return;
        }

        const history = toChatHistory(messages);
        const trimmedHistory = trimChatHistory(history);
        setMessages((previous) => [...previous, buildMessage("user", trimmed)]);
        setDraft("");
        void sendMessage(trimmed, trimmedHistory);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        submitMessage(draft);
    }

    function handleSuggestedPrompt(prompt: string) {
        if (isSending) {
            return;
        }
        submitMessage(prompt);
    }

    function handleRetry() {
        if (!pendingSubmission || isSending) {
            return;
        }
        setErrorMessage(null);
        void sendMessage(pendingSubmission.content, pendingSubmission.history);
    }

    function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== "Enter" || event.shiftKey) {
            return;
        }

        if (event.nativeEvent.isComposing) {
            return;
        }

        event.preventDefault();
        submitMessage(draft);
    }

    useEffect(() => {
        if (previousUserIdRef.current === userId) {
            return;
        }

        previousUserIdRef.current = userId;
        requestAbortControllerRef.current?.abort();
        requestAbortControllerRef.current = null;
        nextMessageIdRef.current = 0;
        setIsOpen(false);
        setIsSending(false);
        setMessages([]);
        setDraft("");
        setErrorMessage(null);
        setPendingSubmission(null);
    }, [userId]);

    useEffect(() => {
        if (!isOpen || isSending) {
            return;
        }

        const timer = window.setTimeout(() => {
            composerRef.current?.focus();
        }, 40);

        return () => {
            window.clearTimeout(timer);
        };
    }, [isOpen, isSending]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const container = scrollContainerRef.current;
        if (!container) {
            return;
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
        });
    }, [isOpen, isSending, messages.length]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handleKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        return () => {
            requestAbortControllerRef.current?.abort();
        };
    }, []);

    return (
        <>
            {isOpen ? (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-[1px] md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            ) : null}

            {isOpen ? (
                <AiChatWidgetPanel
                    composerRef={composerRef}
                    draft={draft}
                    errorMessage={errorMessage}
                    isSending={isSending}
                    messages={messages}
                    onClose={() => setIsOpen(false)}
                    onDraftChange={setDraft}
                    onKeyDown={handleComposerKeyDown}
                    onRetry={handleRetry}
                    scrollContainerRef={scrollContainerRef}
                    onSubmit={handleSubmit}
                    onSuggestedPrompt={handleSuggestedPrompt}
                />
            ) : null}

            <div className={`fixed bottom-4 right-4 z-50 ${isOpen ? "hidden md:block" : "block"}`}>
                <button
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Close Desti assistant" : "Open Desti assistant"}
                    className="group flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_18px_40px_-18px_rgba(5,150,105,0.9)] transition-all hover:-translate-y-0.5 hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                    onClick={() => setIsOpen((previous) => !previous)}
                    type="button"
                >
                    {isOpen ? (
                        <X size={26} />
                    ) : (
                        <MessageCircle size={28} className="transition-transform group-hover:scale-105" />
                    )}
                </button>
            </div>

        </>
    );
}
