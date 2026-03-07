import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseSearchParams } = vi.hoisted(() => ({
    mockUseSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: mockUseSearchParams,
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

vi.mock("@/app/(protected)/_components/ProtectedShell", () => ({
    ProtectedShell: ({ children }: { children: ReactNode }) => (
        <div data-testid="protected-shell">{children}</div>
    ),
}));

vi.mock("@/app/(protected)/my-trip-requests/MyTripRequestsView", () => ({
    MyTripRequestsView: () => <div data-testid="my-trip-requests-view" />,
}));

describe("browse trip requests hub page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("defaults to browse mode when no view query is present", async () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams());

        vi.resetModules();
        const Page = (await import("@/app/(protected)/browse-trip-requests/page")).default;
        const markup = renderToStaticMarkup(<Page />);

        expect(markup).toContain("Trip Requests");
        expect(markup).toContain("Browse");
        expect(markup).toContain("My Trip Requests");
        expect(markup).not.toContain("data-testid=\"my-trip-requests-view\"");
    });

    it("renders the my trip requests view when view=my", async () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams("view=my"));

        vi.resetModules();
        const Page = (await import("@/app/(protected)/browse-trip-requests/page")).default;
        const markup = renderToStaticMarkup(<Page />);

        expect(markup).toContain("data-testid=\"my-trip-requests-view\"");
    });
});
