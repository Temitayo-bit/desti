import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockCurrentUser,
    mockFindUnique,
    mockBookingCount,
    mockRedirect,
} = vi.hoisted(() => ({
    mockCurrentUser: vi.fn(),
    mockFindUnique: vi.fn(),
    mockBookingCount: vi.fn(),
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
    UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("next/navigation", () => ({
    redirect: mockRedirect,
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/image", () => ({
    default: (props: Record<string, unknown>) => <img {...props} />,
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
        booking: {
            count: mockBookingCount,
        },
    },
}));

vi.mock("@/services/trust-service", () => ({
    getDriverRatingSummary: vi.fn().mockResolvedValue({
        userId: "user_123",
        averageRating: 4.9,
        ratingCount: 3,
    }),
}));

function makeVerifiedUser() {
    return {
        id: "user_123",
        primaryEmailAddress: {
            emailAddress: "alex.johnson@stetson.edu",
            verification: {
                status: "verified",
            },
        },
        primaryPhoneNumber: null,
        emailAddresses: [
            {
                emailAddress: "alex.johnson@stetson.edu",
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
            profilePictureUrl: null,
        });
        mockBookingCount.mockResolvedValueOnce(2).mockResolvedValueOnce(5);

        vi.resetModules();
        const ProfilePage = (await import("@/app/(protected)/profile/page")).default;
        const output = await ProfilePage();
        const markup = renderToStaticMarkup(output as ReactNode);

        expect(markup).toContain("Alex Johnson");
        expect(markup).toContain("Sophomore");
        expect(markup).toContain("Stetson University");
        expect(markup).toContain("alex.johnson@stetson.edu");
        expect(markup).toContain('href="/user-profile"');
        expect(markup).toContain('data-redirect-url="/"');
        expect(markup).toContain("Rides given");
        expect(markup).toContain("Rides taken");
    });
});
