import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockCurrentUser,
    mockFindUnique,
    mockRedirect,
} = vi.hoisted(() => ({
    mockCurrentUser: vi.fn(),
    mockFindUnique: vi.fn(),
    mockRedirect: vi.fn((path: string) => {
        throw new Error(`REDIRECT:${path}`);
    }),
}));

vi.mock("@clerk/nextjs/server", () => ({
    currentUser: mockCurrentUser,
}));

vi.mock("@clerk/nextjs", () => ({
    SignOutButton: ({
        children,
        redirectUrl,
    }: {
        children: ReactNode;
        redirectUrl?: string;
    }) => <div data-redirect-url={redirectUrl}>{children}</div>,
}));

vi.mock("next/navigation", () => ({
    redirect: mockRedirect,
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

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findUnique: mockFindUnique,
        },
    },
}));

function makeVerifiedUser() {
    return {
        id: "user_123",
        emailAddresses: [
            {
                emailAddress: "student@stetson.edu",
                verification: {
                    status: "verified",
                },
            },
        ],
    };
}

describe("protected profile page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the onboarded user profile, real links, and marketing-page logout redirect", async () => {
        mockCurrentUser.mockResolvedValue(makeVerifiedUser());
        mockFindUnique.mockResolvedValue({
            email: "alex.johnson@stetson.edu",
            name: "Alex Johnson",
            yearAtStetson: "SOPHOMORE",
            gender: "MALE",
            age: 20,
            onboardingComplete: true,
        });

        vi.resetModules();
        const ProfilePage = (await import("@/app/(protected)/profile/page")).default;
        const output = await ProfilePage();
        const markup = renderToStaticMarkup(output as ReactNode);

        expect(markup).toContain("Alex Johnson");
        expect(markup).toContain("Sophomore at Stetson");
        expect(markup).toContain("alex.johnson@stetson.edu");
        expect(markup).toContain('href="/user-profile"');
        expect(markup).toContain('href="/#faq"');
        expect(markup).toContain('href="mailto:support@desti.app"');
        expect(markup).toContain('data-redirect-url="/"');
        expect(markup).toContain('href="/profile"');
    });
});
