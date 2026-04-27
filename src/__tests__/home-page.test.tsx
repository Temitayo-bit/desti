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

function makeRestrictedUser() {
    return {
        id: "user_456",
        emailAddresses: [
            {
                emailAddress: "student@gmail.com",
                verification: {
                    status: "verified",
                },
            },
        ],
    };
}

describe("home page route gating", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the marketing page for signed-out users", async () => {
        mockCurrentUser.mockResolvedValue(null);

        vi.resetModules();
        const HomePage = (await import("@/app/page")).default;
        const output = await HomePage();
        const markup = renderToStaticMarkup(output as ReactNode);

        expect(markup).toContain("Share rides with verified Stetson students.");
        expect(markup).toContain('href="/sign-up"');
        expect(markup).toContain("How Desti Works");
    });

    it("redirects fully onboarded users to the dashboard", async () => {
        mockCurrentUser.mockResolvedValue(makeVerifiedUser());
        mockFindUnique.mockResolvedValue({ onboardingComplete: true });

        vi.resetModules();
        const HomePage = (await import("@/app/page")).default;

        await expect(HomePage()).rejects.toThrow("REDIRECT:/dashboard");
    });

    it("redirects verified users without onboarding to onboarding", async () => {
        mockCurrentUser.mockResolvedValue(makeVerifiedUser());
        mockFindUnique.mockResolvedValue({ onboardingComplete: false });

        vi.resetModules();
        const HomePage = (await import("@/app/page")).default;

        await expect(HomePage()).rejects.toThrow("REDIRECT:/onboarding");
    });

    it("redirects restricted signed-in users to access restricted", async () => {
        mockCurrentUser.mockResolvedValue(makeRestrictedUser());

        vi.resetModules();
        const HomePage = (await import("@/app/page")).default;

        await expect(HomePage()).rejects.toThrow(
            "REDIRECT:/access-restricted?reason=non_stetson_domain"
        );
    });
});
