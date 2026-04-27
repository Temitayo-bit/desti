/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProtectedShell } from "@/app/(protected)/_components/ProtectedShell";

afterEach(() => {
  cleanup();
});

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
    const { container } = render(
      <ProtectedShell activeNav="browseTripRequests">
        <main>Page</main>
      </ProtectedShell>
    );

    const dashboard = screen.getByRole("link", { name: /^Dashboard$/i });
    expect(dashboard.getAttribute("href")).toBe("/dashboard");

    const rides = screen.getByRole("link", { name: /^Rides$/i });
    expect(rides.getAttribute("href")).toBe("/browse");

    const requests = screen.getByRole("link", { name: /^Requests$/i });
    expect(requests.getAttribute("href")).toBe("/browse-trip-requests");
    expect(requests.textContent?.trim()).toBe("Requests");

    const messages = screen.getByRole("link", { name: /^Messages$/i });
    expect(messages.getAttribute("href")).toBe("/messages");

    const profile = screen.getByRole("link", { name: /^Profile$/i });
    expect(profile.getAttribute("href")).toBe("/profile");

    expect(screen.queryByRole("link", { name: /Browse Rides/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^My Rides$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Browse TripRequests/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /My Trip Requests/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Post Rides/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Post Trip Request/i })).toBeNull();
    expect(container.querySelector('a[href="/post-ride"]')).toBeNull();
    expect(container.querySelector('a[href="/post-trip-request"]')).toBeNull();
  });

  it("renders the profile nav item as a live link with active styling", () => {
    const { container } = render(
      <ProtectedShell activeNav="profile">
        <main>Profile page</main>
      </ProtectedShell>
    );

    const profile = screen.getByRole("link", { name: /^Profile$/i });
    expect(profile.getAttribute("href")).toBe("/profile");
    expect(profile.textContent).toContain("Profile");
    expect(container.innerHTML).toContain("bg-emerald-50 text-emerald-700");
  });
});
