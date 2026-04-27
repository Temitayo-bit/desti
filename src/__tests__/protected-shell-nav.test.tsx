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
    it("renders the remaining protected nav items without post links", () => {
        const markup = renderToStaticMarkup(
            <ProtectedShell activeNav="browseTripRequests">
                <main>Page</main>
            </ProtectedShell>
        );

        expect(markup).toContain('href="/dashboard"');
        expect(markup).toContain(">Dashboard<");
        expect(markup).toContain(">Rides<");
        expect(markup).not.toContain("Browse Rides");
        expect(markup).not.toContain(">My Rides<");
        expect(markup).toContain('href="/browse"');
        expect(markup).toContain(">Requests<");
        expect(markup).not.toContain("Browse TripRequests");
        expect(markup).not.toContain(">My Trip Requests<");
        expect(markup).toContain('href="/browse-trip-requests"');
        expect(markup).toContain('href="/messages"');
        expect(markup).toContain(">Messages<");
        expect(markup).toContain('href="/profile"');
        expect(markup).toContain(">Profile<");
        expect(markup).not.toContain('href="/post-ride"');
        expect(markup).not.toContain('href="/post-trip-request"');
        expect(markup).not.toContain(">Post Rides<");
        expect(markup).not.toContain(">Post Trip Request<");
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
