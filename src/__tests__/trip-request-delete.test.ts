import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireStetsonAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { DELETE } from "@/app/api/trip-requests/[tripRequestId]/route";

describe("DELETE /api/trip-requests/:tripRequestId", () => {
  it("returns 501 TODO response", async () => {
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(501);
    expect(json).toEqual({
      message: "TODO: Trip request cancellation endpoint is not yet implemented.",
    });
  });
});
