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
    mockBookingFindUnique,
    mockOfferFindUnique,
    mockOfferFindFirst,
    mockConversationFindUnique,
    mockConversationFindFirst,
    mockConversationFindMany,
    mockMessageFindFirst,
} = vi.hoisted(() => ({
    mockRequireStetsonAuth: vi.fn(),
    mockGetOrCreateBookingConversation: vi.fn(),
    mockGetOrCreateOfferConversation: vi.fn(),
    mockAssertConversationParticipant: vi.fn(),
    mockBookingFindUnique: vi.fn(),
    mockOfferFindUnique: vi.fn(),
    mockOfferFindFirst: vi.fn(),
    mockConversationFindUnique: vi.fn(),
    mockConversationFindFirst: vi.fn(),
    mockConversationFindMany: vi.fn(),
    mockMessageFindFirst: vi.fn(),
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

vi.mock("@/lib/prisma", () => ({
    prisma: {
        booking: {
            findUnique: (...args: unknown[]) => mockBookingFindUnique(...args),
        },
        offer: {
            findUnique: (...args: unknown[]) => mockOfferFindUnique(...args),
            findFirst: (...args: unknown[]) => mockOfferFindFirst(...args),
        },
        conversation: {
            findUnique: (...args: unknown[]) => mockConversationFindUnique(...args),
            findFirst: (...args: unknown[]) => mockConversationFindFirst(...args),
            findMany: (...args: unknown[]) => mockConversationFindMany(...args),
        },
        message: {
            findFirst: (...args: unknown[]) => mockMessageFindFirst(...args),
        },
    },
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
        mockBookingFindUnique.mockResolvedValue({
            id: "booking-1",
            tripRequestId: null,
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            ride: null,
        });
        mockOfferFindFirst.mockResolvedValue(null);
        mockConversationFindUnique.mockResolvedValue(null);
        mockConversationFindFirst.mockResolvedValue(null);
        mockConversationFindMany.mockResolvedValue([]);
        mockMessageFindFirst.mockResolvedValue(null);
        mockOfferFindUnique.mockResolvedValue({
            id: "offer-1",
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
        });
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

    it("reuses canonical pair conversation for offer endpoint", async () => {
        const pairConversation = makeConversation({
            id: "pair-conversation-id",
            type: "BOOKING",
            bookingId: "booking-existing",
            offerId: null,
        });
        mockConversationFindMany.mockResolvedValue([pairConversation]);
        mockAssertConversationParticipant.mockResolvedValue(pairConversation);

        const res = await handlePostConversationForOffer(
            new NextRequest("http://localhost:3000/api/conversations/for-offer/offer-1", {
                method: "POST",
            }),
            "offer-1"
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe("pair-conversation-id");
        expect(mockGetOrCreateOfferConversation).not.toHaveBeenCalled();
    });

    it("returns 404 when caller is not a participant", async () => {
        mockBookingFindUnique.mockResolvedValue({
            id: "booking-1",
            tripRequestId: null,
            riderUserId: "some-other-rider",
            driverUserId: "some-other-driver",
            ride: null,
        });

        const res = await handlePostConversationForBooking(
            new NextRequest("http://localhost:3000/api/conversations/for-booking/booking-1", {
                method: "POST",
            }),
            "booking-1"
        );

        expect(res.status).toBe(404);
        expect(mockGetOrCreateBookingConversation).not.toHaveBeenCalled();
    });

    it("maps service 404 and 409 errors for booking/offer creation", async () => {
        mockBookingFindUnique.mockResolvedValue({
            id: "missing",
            tripRequestId: null,
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            ride: null,
        });
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

        mockOfferFindUnique.mockResolvedValue({
            id: "cancelled",
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
        });
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

    it("reuses offer conversation for offer-derived confirmed booking", async () => {
        mockBookingFindUnique.mockResolvedValue({
            id: "booking-1",
            tripRequestId: "trip-request-1",
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            ride: null,
        });
        mockConversationFindMany.mockResolvedValueOnce([]);
        mockConversationFindFirst.mockResolvedValueOnce(null);
        mockOfferFindFirst.mockResolvedValue({
            id: "offer-accepted-1",
        });

        const offerConversation = makeConversation({
            type: "OFFER",
            bookingId: null,
            offerId: "offer-accepted-1",
        });
        mockGetOrCreateOfferConversation.mockResolvedValue(offerConversation);
        mockAssertConversationParticipant.mockResolvedValue(offerConversation);

        const res = await handlePostConversationForBooking(
            new NextRequest("http://localhost:3000/api/conversations/for-booking/booking-1", {
                method: "POST",
            }),
            "booking-1"
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe(offerConversation.id);
        expect(mockGetOrCreateOfferConversation).toHaveBeenCalledWith(
            "offer-accepted-1"
        );
        expect(mockGetOrCreateBookingConversation).not.toHaveBeenCalled();
        expect(mockConversationFindMany).toHaveBeenCalledTimes(1);
        expect(mockConversationFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    riderUserId: "user_rider_1",
                    driverUserId: "user_driver_1",
                }),
            })
        );
    });

    it("reuses existing booking conversation when present", async () => {
        mockBookingFindUnique.mockResolvedValue({
            id: "booking-1",
            tripRequestId: "trip-request-1",
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            ride: null,
        });
        mockConversationFindMany.mockResolvedValueOnce([]);
        mockConversationFindFirst.mockResolvedValueOnce(null);
        mockOfferFindFirst.mockResolvedValue({
            id: "offer-accepted-1",
        });
        const bookingConversation = makeConversation({
            type: "BOOKING",
            bookingId: "booking-1",
            offerId: null,
        });
        mockConversationFindUnique.mockResolvedValue(bookingConversation);
        mockAssertConversationParticipant.mockResolvedValue(bookingConversation);

        const res = await handlePostConversationForBooking(
            new NextRequest("http://localhost:3000/api/conversations/for-booking/booking-1", {
                method: "POST",
            }),
            "booking-1"
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe(bookingConversation.id);
        expect(mockGetOrCreateOfferConversation).not.toHaveBeenCalled();
        expect(mockGetOrCreateBookingConversation).not.toHaveBeenCalled();
        expect(mockConversationFindMany).toHaveBeenCalledTimes(1);
        expect(mockConversationFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    riderUserId: "user_rider_1",
                    driverUserId: "user_driver_1",
                }),
            })
        );
    });

    it("reuses canonical trip-request conversation before accepted-offer fallback", async () => {
        mockBookingFindUnique.mockResolvedValue({
            id: "booking-1",
            tripRequestId: "trip-request-1",
            riderUserId: "user_rider_1",
            driverUserId: "user_driver_1",
            ride: null,
        });
        mockConversationFindMany.mockResolvedValueOnce([]);
        mockConversationFindFirst.mockResolvedValueOnce(
            makeConversation({
                id: "canonical-conversation-id",
                type: "OFFER",
                bookingId: null,
                offerId: "offer-old-thread",
            })
        );
        mockAssertConversationParticipant.mockResolvedValue(
            makeConversation({
                id: "canonical-conversation-id",
                type: "OFFER",
                bookingId: null,
                offerId: "offer-old-thread",
            })
        );

        const res = await handlePostConversationForBooking(
            new NextRequest("http://localhost:3000/api/conversations/for-booking/booking-1", {
                method: "POST",
            }),
            "booking-1"
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe("canonical-conversation-id");
        expect(mockGetOrCreateOfferConversation).not.toHaveBeenCalled();
        expect(mockGetOrCreateBookingConversation).not.toHaveBeenCalled();
        expect(mockOfferFindFirst).not.toHaveBeenCalled();
        expect(mockConversationFindMany).toHaveBeenCalledTimes(1);
        expect(mockConversationFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    riderUserId: "user_rider_1",
                    driverUserId: "user_driver_1",
                }),
            })
        );
    });
});
