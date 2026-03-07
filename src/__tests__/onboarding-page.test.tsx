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

vi.mock("@/app/onboarding/OnboardingClientPage", () => ({
    OnboardingClientPage: ({ verifiedEmail }: { verifiedEmail: string }) => (
        <div data-testid="onboarding-client" data-email={verifiedEmail} />
    ),
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

describe("onboarding page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects completed users to the dashboard", async () => {
        mockCurrentUser.mockResolvedValue(makeVerifiedUser());
        mockFindUnique.mockResolvedValue({ onboardingComplete: true });

        vi.resetModules();
        const OnboardingPage = (await import("@/app/onboarding/page")).default;

        await expect(OnboardingPage()).rejects.toThrow("REDIRECT:/dashboard");
    });

    it("renders the onboarding client page for incomplete users", async () => {
        mockCurrentUser.mockResolvedValue(makeVerifiedUser());
        mockFindUnique.mockResolvedValue({ onboardingComplete: false });

        vi.resetModules();
        const OnboardingPage = (await import("@/app/onboarding/page")).default;

        const output = await OnboardingPage();

        expect(output.props.verifiedEmail).toBe("student@stetson.edu");
    });
});
