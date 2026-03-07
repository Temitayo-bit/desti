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

describe("protected layout onboarding gate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects incomplete users to onboarding", async () => {
        mockCurrentUser.mockResolvedValue(makeVerifiedUser());
        mockFindUnique.mockResolvedValue({ onboardingComplete: false });

        vi.resetModules();
        const ProtectedLayout = (await import("@/app/(protected)/layout")).default;

        await expect(
            ProtectedLayout({
                children: <div>Protected content</div>,
            })
        ).rejects.toThrow("REDIRECT:/onboarding");
    });

    it("renders protected content for completed users", async () => {
        mockCurrentUser.mockResolvedValue(makeVerifiedUser());
        mockFindUnique.mockResolvedValue({ onboardingComplete: true });

        vi.resetModules();
        const ProtectedLayout = (await import("@/app/(protected)/layout")).default;

        const output = await ProtectedLayout({
            children: <main>Protected content</main>,
        });
        const markup = renderToStaticMarkup(output as ReactNode);

        expect(markup).toContain("Protected content");
    });
});
