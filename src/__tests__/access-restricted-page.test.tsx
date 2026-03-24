import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth } = vi.hoisted(() => ({
    mockAuth: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
    auth: mockAuth,
}));

vi.mock("@clerk/nextjs", () => ({
    SignOutButton: ({
        children,
        redirectUrl,
    }: {
        children: ReactNode;
        redirectUrl?: string;
    }) => <div data-sign-out-redirect={redirectUrl}>{children}</div>,
    UserButton: () => <div data-user-button />,
    ClerkProvider: ({
        children,
        afterSignOutUrl,
    }: {
        children: ReactNode;
        afterSignOutUrl?: string;
    }) => <div data-clerk-after-sign-out={afterSignOutUrl}>{children}</div>,
}));

vi.mock("next/font/google", () => ({
    Geist: () => ({ variable: "geist-sans" }),
    Geist_Mono: () => ({ variable: "geist-mono" }),
}));

vi.mock("@/components/AiChatWidget", () => ({
    AiChatWidget: () => <div data-chat-widget />,
}));

vi.mock("next/link", () => ({
    default: ({
        children,
        href,
        className,
    }: {
        children: ReactNode;
        href: string;
        className?: string;
    }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

describe("access restricted page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses the marketing page as the sign-out destination for signed-in users", async () => {
        mockAuth.mockResolvedValue({ userId: "user_123" });

        vi.resetModules();
        const AccessRestrictedPage = (await import("@/app/access-restricted/page")).default;
        const output = await AccessRestrictedPage({
            searchParams: Promise.resolve({ reason: "non_stetson_domain" }),
        });
        const markup = renderToStaticMarkup(output as ReactNode);

        expect(markup).toContain('data-sign-out-redirect="/"');
    });
});

describe("RootLayout", () => {
    it("sets afterSignOutUrl='/' on ClerkProvider", async () => {
        vi.resetModules();
        const RootLayout = (await import("@/app/layout")).default;
        const markup = renderToStaticMarkup(
            RootLayout({ children: <p>child</p> }) as ReactNode
        );
        expect(markup).toContain('data-clerk-after-sign-out="/"');
    });
});
