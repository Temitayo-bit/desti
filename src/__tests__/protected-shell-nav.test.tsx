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
        expect(markup).not.toContain("Browse Rides");
        expect(markup).not.toContain(">My Rides<");
        expect(markup).toContain("Trip Requests");
        expect(markup).not.toContain("Browse TripRequests");
        expect(markup).not.toContain(">My Trip Requests<");
    });
});
