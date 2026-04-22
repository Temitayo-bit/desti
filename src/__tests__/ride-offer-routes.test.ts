import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, service, MockRideOfferError } = vi.hoisted(() => {
    class RideOfferErrorForTests extends Error {
        statusCode: number;
        error: string;
        code: string;

        constructor(
            message: string,
            {
                statusCode,
                error,
                code,
            }: {
                statusCode: number;
                error: string;
                code: string;
            }
        ) {
            super(message);
            this.statusCode = statusCode;
            this.error = error;
            this.code = code;
        }
    }

    return {
        mockRequireStetsonAuth: vi.fn(),
        service: {
            createRideOffer: vi.fn(),
            listRideOffersForDriver: vi.fn(),
            listRideOffersForRider: vi.fn(),
            acceptRideOffer: vi.fn(),
            rejectRideOffer: vi.fn(),
        },
        MockRideOfferError: RideOfferErrorForTests,
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/services/ride-offer-service", () => ({
    createRideOffer: (...args: unknown[]) => service.createRideOffer(...args),
    listRideOffersForDriver: (...args: unknown[]) => service.listRideOffersForDriver(...args),
    listRideOffersForRider: (...args: unknown[]) => service.listRideOffersForRider(...args),
    acceptRideOffer: (...args: unknown[]) => service.acceptRideOffer(...args),
    rejectRideOffer: (...args: unknown[]) => service.rejectRideOffer(...args),
    RideOfferError: MockRideOfferError,
}));

import { POST as createRideOfferRoute, GET as listIncomingRideOffersRoute } from "@/app/api/rides/[rideId]/offers/route";
import { GET as listOutgoingRideOffersRoute } from "@/app/api/me/ride-offers/outgoing/route";
import { POST as acceptRideOfferRoute } from "@/app/api/ride-offers/[offerId]/accept/route";
import { POST as rejectRideOfferRoute } from "@/app/api/ride-offers/[offerId]/reject/route";

function successAuth(userId = "user-1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: `${userId}@stetson.edu`,
        },
    };
}

describe("ride offer routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth("rider-1"));
    });

    it("POST /api/rides/:rideId/offers creates offer", async () => {
        service.createRideOffer.mockResolvedValue({ id: "offer-1", state: "PENDING" });

        const req = new Request("http://localhost/api/rides/ride-1/offers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offeredPriceCents: 1500 }),
        });

        const res = await createRideOfferRoute(req as never, {
            params: Promise.resolve({ rideId: "ride-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.id).toBe("offer-1");
        expect(service.createRideOffer).toHaveBeenCalledWith("ride-1", "rider-1", 1500);
    });

    it("POST /api/rides/:rideId/offers rejects offeredPriceCents above int32 max", async () => {
        const req = new Request("http://localhost/api/rides/ride-1/offers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offeredPriceCents: 2_147_483_648 }),
        });

        const res = await createRideOfferRoute(req as never, {
            params: Promise.resolve({ rideId: "ride-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.details).toEqual([
            {
                field: "offeredPriceCents",
                message: "offeredPriceCents must be an integer between 1 and 2147483647.",
            },
        ]);
        expect(service.createRideOffer).not.toHaveBeenCalled();
    });

    it("GET /api/rides/:rideId/offers lists driver incoming offers", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("driver-1"));
        service.listRideOffersForDriver.mockResolvedValue([{ id: "offer-1" }]);

        const req = new Request("http://localhost/api/rides/ride-1/offers", { method: "GET" });
        const res = await listIncomingRideOffersRoute(req as never, {
            params: Promise.resolve({ rideId: "ride-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.items).toHaveLength(1);
        expect(service.listRideOffersForDriver).toHaveBeenCalledWith("ride-1", "driver-1");
    });

    it("GET /api/me/ride-offers/outgoing lists rider offers", async () => {
        service.listRideOffersForRider.mockResolvedValue([{ id: "offer-1" }]);

        const req = new Request("http://localhost/api/me/ride-offers/outgoing", { method: "GET" });
        const res = await listOutgoingRideOffersRoute(req as never);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.items).toHaveLength(1);
        expect(service.listRideOffersForRider).toHaveBeenCalledWith("rider-1");
    });

    it("POST /api/ride-offers/:offerId/accept accepts offer", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("driver-1"));
        service.acceptRideOffer.mockResolvedValue({
            offer: { id: "offer-1", state: "ACCEPTED" },
            booking: { id: "booking-1", status: "CONFIRMED" },
        });

        const req = new Request("http://localhost/api/ride-offers/offer-1/accept", { method: "POST" });
        const res = await acceptRideOfferRoute(req as never, {
            params: Promise.resolve({ offerId: "offer-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.booking.id).toBe("booking-1");
        expect(service.acceptRideOffer).toHaveBeenCalledWith("offer-1", "driver-1");
    });

    it("POST /api/ride-offers/:offerId/reject rejects offer", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("driver-1"));
        service.rejectRideOffer.mockResolvedValue({ id: "offer-1", state: "REJECTED" });

        const req = new Request("http://localhost/api/ride-offers/offer-1/reject", { method: "POST" });
        const res = await rejectRideOfferRoute(req as never, {
            params: Promise.resolve({ offerId: "offer-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.item.state).toBe("REJECTED");
        expect(service.rejectRideOffer).toHaveBeenCalledWith("offer-1", "driver-1");
    });

    it("maps ride-offer domain errors to HTTP responses", async () => {
        service.acceptRideOffer.mockRejectedValue(
            new MockRideOfferError("Only pending offers can be accepted.", {
                statusCode: 409,
                error: "Conflict",
                code: "RIDE_OFFER_NOT_PENDING",
            })
        );

        const req = new Request("http://localhost/api/ride-offers/offer-1/accept", { method: "POST" });
        const res = await acceptRideOfferRoute(req as never, {
            params: Promise.resolve({ offerId: "offer-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.code).toBe("RIDE_OFFER_NOT_PENDING");
    });
});
