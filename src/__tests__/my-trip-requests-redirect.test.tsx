import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRedirect } = vi.hoisted(() => ({
    mockRedirect: vi.fn((path: string) => {
        throw new Error(`REDIRECT:${path}`);
    }),
}));

vi.mock("next/navigation", () => ({
    redirect: mockRedirect,
}));

describe("my trip requests compatibility route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects to the trip requests hub in my mode", async () => {
        vi.resetModules();
        const Page = (await import("@/app/(protected)/my-trip-requests/page")).default;

        expect(() => Page()).toThrow("REDIRECT:/browse-trip-requests?view=my");
    });
});
