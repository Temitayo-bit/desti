import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
    handlePostConversationForBooking,
    handlePostConversationForOffer,
} from "@/routes/conversations";
import { ConversationServiceError } from "@/services/conversationService";

const {
    mockRequireStetsonAuth,
    mockGetOrCreateBookingConversation,
    mockGetOrCreateOfferConversation,
    mockAssertConversationParticipant,
} = vi.hoisted(() => ({
    mockRequireStetsonAuth: vi.fn(),
    mockGetOrCreateBookingConversation: vi.fn(),
    mockGetOrCreateOfferConversation: vi.fn(),
    mockAssertConversationParticipant: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/services/conversationService", async () => {
    const actual = await vi.importActual<typeof import("@/services/conversationService")>(
        "@/services/conversationService"
    );
    return {
        ...actual,
        getOrCreateBookingConversation: (...args: unknown[]) =>
            mockGetOrCreateBookingConversation(...args),
        getOrCreateOfferConversation: (...args: unknown[]) =>
            mockGetOrCreateOfferConversation(...args),
    };
});

vi.mock("@/helpers/conversationAuth", () => ({
    assertConversationParticipant: (...args: unknown[]) =>
        mockAssertConversationParticipant(...args),
}));

function authSuccess(userId = "user_rider_1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: "rider@stetson.edu",
        },
    };
}

function makeConversation(overrides: Record<string, unknown> = {}) {
    return {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "BOOKING",
        bookingId: "booking-1",
        offerId: null,
        riderUserId: "user_rider_1",
        driverUserId: "user_driver_1",
        createdAt: new Date("2030-01-01T10:00:00.000Z"),
        updatedAt: new Date("2030-01-01T10:00:00.000Z"),
        ...overrides,
    };
}

describe("POST /api/conversations/for-booking/:bookingId and /for-offer/:offerId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(authSuccess());
    });

    it("creates/returns booking conversation when caller is participant", async () => {
        const conversation = makeConversation();
        mockGetOrCreateBookingConversation.mockResolvedValue(conversation);
        mockAssertConversationParticipant.mockResolvedValue(conversation);

        const res = await handlePostConversationForBooking(
            new NextRequest("http://localhost:3000/api/conversations/for-booking/booking-1", {
                method: "POST",
            }),
            "booking-1"
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe(conversation.id);
        expect(mockGetOrCreateBookingConversation).toHaveBeenCalledWith("booking-1");
    });

    it("creates/returns offer conversation when caller is participant", async () => {
        const conversation = makeConversation({
            type: "OFFER",
            bookingId: null,
            offerId: "offer-1",
        });
        mockGetOrCreateOfferConversation.mockResolvedValue(conversation);
        mockAssertConversationParticipant.mockResolvedValue(conversation);

        const res = await handlePostConversationForOffer(
            new NextRequest("http://localhost:3000/api/conversations/for-offer/offer-1", {
                method: "POST",
            }),
            "offer-1"
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe(conversation.id);
        expect(mockGetOrCreateOfferConversation).toHaveBeenCalledWith("offer-1");
    });

    it("returns 404 when caller is not a participant", async () => {
        const conversation = makeConversation();
        mockGetOrCreateBookingConversation.mockResolvedValue(conversation);
        mockAssertConversationParticipant.mockRejectedValue(
            new ConversationServiceError(
                "Conversation not found.",
                "CONVERSATION_NOT_FOUND",
                404
            )
        );

        const res = await handlePostConversationForBooking(
            new NextRequest("http://localhost:3000/api/conversations/for-booking/booking-1", {
                method: "POST",
            }),
            "booking-1"
        );

        expect(res.status).toBe(404);
    });

    it("maps service 404 and 409 errors for booking/offer creation", async () => {
        mockGetOrCreateBookingConversation.mockRejectedValue(
            new ConversationServiceError("Booking not found.", "BOOKING_NOT_FOUND", 404)
        );
        const bookingRes = await handlePostConversationForBooking(
            new NextRequest("http://localhost:3000/api/conversations/for-booking/missing", {
                method: "POST",
            }),
            "missing"
        );
        expect(bookingRes.status).toBe(404);

        mockGetOrCreateOfferConversation.mockRejectedValue(
            new ConversationServiceError("Offer cancelled.", "OFFER_CANCELLED", 409)
        );
        const offerRes = await handlePostConversationForOffer(
            new NextRequest("http://localhost:3000/api/conversations/for-offer/cancelled", {
                method: "POST",
            }),
            "cancelled"
        );
        expect(offerRes.status).toBe(409);
    });
});
