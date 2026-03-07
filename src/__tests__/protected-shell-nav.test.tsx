import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProtectedShell } from "@/app/(protected)/_components/ProtectedShell";

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

describe("protected shell trip request navigation", () => {
    it("renders consolidated rides and trip request labels without separate my-links", () => {
        const markup = renderToStaticMarkup(
            <ProtectedShell activeNav="browseTripRequests">
                <main>Page</main>
            </ProtectedShell>
        );

        expect(markup).toContain(">Rides<");
        expect(markup).toContain('href="/dashboard"');
        expect(markup).not.toContain("Browse Rides");
        expect(markup).not.toContain(">My Rides<");
        expect(markup).toContain("Trip Requests");
        expect(markup).not.toContain("Browse TripRequests");
        expect(markup).not.toContain(">My Trip Requests<");
    });

    it("renders the profile nav item as a live link with active styling", () => {
        const markup = renderToStaticMarkup(
            <ProtectedShell activeNav="profile">
                <main>Profile page</main>
            </ProtectedShell>
        );

        expect(markup).toContain('href="/profile"');
        expect(markup).toContain(">Profile<");
        expect(markup).toContain("bg-emerald-50 text-emerald-700");
    });
});
