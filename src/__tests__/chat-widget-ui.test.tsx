import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
    AiChatWidget,
    AiChatWidgetPanel,
} from "@/components/AiChatWidget";
import type { ChatWidgetMessage } from "@/lib/chat-widget";

vi.mock("@clerk/nextjs", () => ({
    useAuth: () => ({
        userId: null,
    }),
}));

describe("AI chat widget UI", () => {
    it("renders the floating launcher by default", () => {
        const markup = renderToStaticMarkup(<AiChatWidget />);

        expect(markup).toContain("Open Desti assistant");
    });

    it("renders welcome copy and suggested prompts when opened with no messages", () => {
        const markup = renderToStaticMarkup(
            <AiChatWidgetPanel
                composerRef={{ current: null }}
                draft=""
                errorMessage={null}
                isSending={false}
                messages={[]}
                onClose={() => undefined}
                onDraftChange={() => undefined}
                onKeyDown={() => undefined}
                onRetry={() => undefined}
                scrollContainerRef={{ current: null }}
                onSubmit={(event) => event.preventDefault()}
                onSuggestedPrompt={() => undefined}
            />
        );

        expect(markup).toContain("Need help using Desti?");
        expect(markup).toContain("How do I post a ride?");
        expect(markup).toContain("Chat resets when you refresh the page.");
        expect(markup).toContain("bottom-4");
        expect(markup).toContain("md:w-[24rem]");
    });

    it("renders message history, retry state, and disabled send controls", () => {
        const messages: ChatWidgetMessage[] = [
            {
                id: "user-1",
                role: "user",
                content: "How do bookings work?",
            },
            {
                id: "assistant-1",
                role: "assistant",
                content: "Bookings appear after an offer is accepted.",
            },
        ];

        const markup = renderToStaticMarkup(
            <AiChatWidgetPanel
                composerRef={{ current: null }}
                draft=""
                errorMessage="Model unavailable. Ensure Ollama is running."
                isSending={true}
                messages={messages}
                onClose={() => undefined}
                onDraftChange={() => undefined}
                onKeyDown={() => undefined}
                onRetry={() => undefined}
                scrollContainerRef={{ current: null }}
                onSubmit={(event) => event.preventDefault()}
                onSuggestedPrompt={() => undefined}
            />
        );

        expect(markup).toContain("How do bookings work?");
        expect(markup).toContain("Bookings appear after an offer is accepted.");
        expect(markup).toContain("Model unavailable. Ensure Ollama is running.");
        expect(markup).toContain("Retry");
        expect(markup).toContain("Desti Assistant is thinking...");
        expect(markup).toContain("disabled");
    });
});
