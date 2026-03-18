import { describe, expect, it, vi } from "vitest";
import { openBookingConversationThread } from "@/lib/booking-conversation";

describe("openBookingConversationThread", () => {
    it("returns conversation id and href on success", async () => {
        const fetcher = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    id: "11111111-1111-4111-8111-111111111111",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        );

        const result = await openBookingConversationThread("booking-1", fetcher);
        expect(result).toEqual({
            ok: true,
            conversationId: "11111111-1111-4111-8111-111111111111",
            href: "/messages?conversationId=11111111-1111-4111-8111-111111111111",
        });
        expect(fetcher).toHaveBeenCalledWith(
            "/api/conversations/for-booking/booking-1",
            { method: "POST" }
        );
    });

    it("returns API message on non-2xx response", async () => {
        const fetcher = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    error: "Not Found",
                    message: "Booking not found.",
                }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            )
        );

        const result = await openBookingConversationThread("missing", fetcher);
        expect(result).toEqual({
            ok: false,
            message: "Booking not found.",
        });
    });

    it("returns fallback message when request throws", async () => {
        const fetcher = vi.fn().mockRejectedValue(new Error("network"));

        const result = await openBookingConversationThread("booking-1", fetcher);
        expect(result).toEqual({
            ok: false,
            message: "Unable to open messages for this booking.",
        });
    });
});
