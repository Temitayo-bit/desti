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

vi.mock("@/app/(protected)/my-rides/MyRidesView", () => ({
    MyRidesView: () => <div data-testid="my-rides-view" />,
}));

describe("Advanced Filters feature", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the Advanced Filters button (not disabled)", async () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
        vi.resetModules();
        const Page = (await import("@/app/(protected)/browse/page")).default;
        const markup = renderToStaticMarkup(<Page />);

        expect(markup).toContain("Advanced Filters");
        expect(markup).not.toContain("cursor-not-allowed");
        expect(markup).not.toContain('disabled=""');
        expect(markup).not.toContain("aria-disabled");
    });

    it("renders all quick filter pills", async () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
        vi.resetModules();
        const Page = (await import("@/app/(protected)/browse/page")).default;
        const markup = renderToStaticMarkup(<Page />);

        expect(markup).toContain("All");
        expect(markup).toContain("Soon");
        expect(markup).toContain("Later");
        expect(markup).toContain("2+ Seats");
        expect(markup).toContain("Short Trip");
        expect(markup).toContain("Advanced Filters");
    });

    it("renders search input for destinations", async () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
        vi.resetModules();
        const Page = (await import("@/app/(protected)/browse/page")).default;
        const markup = renderToStaticMarkup(<Page />);

        expect(markup).toContain("Search destinations...");
    });

    it("does not render the advanced filters modal by default", async () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
        vi.resetModules();
        const Page = (await import("@/app/(protected)/browse/page")).default;
        const markup = renderToStaticMarkup(<Page />);

        expect(markup).not.toContain("advancedFiltersTitle");
        expect(markup).not.toContain("Departure Date Range");
        expect(markup).not.toContain("Price Range (per seat)");
        expect(markup).not.toContain("Distance Category");
        expect(markup).not.toContain("Minimum Available Seats");
    });
});
