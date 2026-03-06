import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
    ClerkProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("next/font/google", () => ({
    Geist: () => ({
        variable: "font-geist-sans",
    }),
    Geist_Mono: () => ({
        variable: "font-geist-mono",
    }),
}));

vi.mock("@/components/AiChatWidget", () => ({
    AiChatWidget: () => <div data-testid="ai-chat-widget" />,
}));

describe("root layout chat widget mount", () => {
    it("includes the AI chat widget globally", async () => {
        const RootLayout = (await import("@/app/layout")).default;
        const markup = renderToStaticMarkup(
            <RootLayout>
                <main>Page content</main>
            </RootLayout>
        );

        expect(markup).toContain("data-testid=\"ai-chat-widget\"");
        expect(markup).toContain("Page content");
    });
});
