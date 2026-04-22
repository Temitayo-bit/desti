import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireStetsonAuth, service, MockStopRequestError } = vi.hoisted(() => {
    class StopRequestErrorForTests extends Error {
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
            createStopRequest: vi.fn(),
            listStopRequestsForDriver: vi.fn(),
            listStopRequestsForRider: vi.fn(),
            quoteStopRequest: vi.fn(),
            acceptStopRequest: vi.fn(),
            rejectStopRequest: vi.fn(),
        },
        MockStopRequestError: StopRequestErrorForTests,
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/services/stop-request-service", () => ({
    createStopRequest: (...args: unknown[]) => service.createStopRequest(...args),
    listStopRequestsForDriver: (...args: unknown[]) => service.listStopRequestsForDriver(...args),
    listStopRequestsForRider: (...args: unknown[]) => service.listStopRequestsForRider(...args),
    quoteStopRequest: (...args: unknown[]) => service.quoteStopRequest(...args),
    acceptStopRequest: (...args: unknown[]) => service.acceptStopRequest(...args),
    rejectStopRequest: (...args: unknown[]) => service.rejectStopRequest(...args),
    StopRequestError: MockStopRequestError,
}));

import {
    GET as listIncomingStopRequestsRoute,
    POST as createStopRequestRoute,
} from "@/app/api/rides/[rideId]/stop-requests/route";
import { GET as listOutgoingStopRequestsRoute } from "@/app/api/me/stop-requests/outgoing/route";
import { POST as quoteStopRequestRoute } from "@/app/api/stop-requests/[stopRequestId]/quote/route";
import { POST as acceptStopRequestRoute } from "@/app/api/stop-requests/[stopRequestId]/accept/route";
import { POST as rejectStopRequestRoute } from "@/app/api/stop-requests/[stopRequestId]/reject/route";

function successAuth(userId = "user-1") {
    return {
        user: {
            clerkUserId: userId,
            primaryStetsonEmail: `${userId}@stetson.edu`,
        },
    };
}

describe("stop request routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireStetsonAuth.mockResolvedValue(successAuth("rider-1"));
    });

    it("POST /api/rides/:rideId/stop-requests creates stop request", async () => {
        service.createStopRequest.mockResolvedValue({ id: "stop-1", state: "PENDING" });

        const req = new Request("http://localhost/api/rides/ride-1/stop-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                requestedPickupText: "Library",
                requestedPickupLatitude: 29.028,
                requestedPickupLongitude: -81.303,
                requestedDropoffText: "Airport",
                requestedDropoffLatitude: 29.179,
                requestedDropoffLongitude: -81.058,
                riderNote: "Near south entrance",
            }),
        });

        const res = await createStopRequestRoute(req as never, {
            params: Promise.resolve({ rideId: "ride-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.item.id).toBe("stop-1");
        expect(service.createStopRequest).toHaveBeenCalledWith(
            "ride-1",
            "rider-1",
            expect.objectContaining({
                requestedPickupText: "Library",
                requestedDropoffText: "Airport",
            })
        );
    });

    it("POST /api/rides/:rideId/stop-requests rejects invalid coordinates", async () => {
        const req = new Request("http://localhost/api/rides/ride-1/stop-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                requestedPickupText: "Library",
                requestedPickupLatitude: 120,
                requestedPickupLongitude: -81.303,
                requestedDropoffText: "Airport",
                requestedDropoffLatitude: 29.179,
                requestedDropoffLongitude: -81.058,
            }),
        });

        const res = await createStopRequestRoute(req as never, {
            params: Promise.resolve({ rideId: "ride-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.details).toEqual([
            {
                field: "requestedPickupLatitude",
                message: "requestedPickupLatitude must be a finite number between -90 and 90.",
            },
        ]);
        expect(service.createStopRequest).not.toHaveBeenCalled();
    });

    it("GET /api/rides/:rideId/stop-requests lists incoming for driver", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("driver-1"));
        service.listStopRequestsForDriver.mockResolvedValue([{ id: "stop-1" }]);

        const req = new Request("http://localhost/api/rides/ride-1/stop-requests", { method: "GET" });
        const res = await listIncomingStopRequestsRoute(req as never, {
            params: Promise.resolve({ rideId: "ride-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.items).toHaveLength(1);
        expect(service.listStopRequestsForDriver).toHaveBeenCalledWith("ride-1", "driver-1");
    });

    it("GET /api/me/stop-requests/outgoing lists outgoing for rider", async () => {
        service.listStopRequestsForRider.mockResolvedValue([{ id: "stop-1" }]);

        const req = new Request("http://localhost/api/me/stop-requests/outgoing", { method: "GET" });
        const res = await listOutgoingStopRequestsRoute(req as never);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.items).toHaveLength(1);
        expect(service.listStopRequestsForRider).toHaveBeenCalledWith("rider-1");
    });

    it("POST /api/stop-requests/:id/quote quotes stop request", async () => {
        mockRequireStetsonAuth.mockResolvedValue(successAuth("driver-1"));
        service.quoteStopRequest.mockResolvedValue({ id: "stop-1", state: "QUOTED" });

        const req = new Request("http://localhost/api/stop-requests/stop-1/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quotedPriceCents: 1800 }),
        });
        const res = await quoteStopRequestRoute(req as never, {
            params: Promise.resolve({ stopRequestId: "stop-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.item.state).toBe("QUOTED");
        expect(service.quoteStopRequest).toHaveBeenCalledWith("stop-1", "driver-1", 1800);
    });

    it("POST /api/stop-requests/:id/quote rejects invalid quoted price", async () => {
        const req = new Request("http://localhost/api/stop-requests/stop-1/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quotedPriceCents: 0 }),
        });
        const res = await quoteStopRequestRoute(req as never, {
            params: Promise.resolve({ stopRequestId: "stop-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.details).toEqual([
            {
                field: "quotedPriceCents",
                message: "quotedPriceCents must be an integer between 1 and 2147483647.",
            },
        ]);
        expect(service.quoteStopRequest).not.toHaveBeenCalled();
    });

    it("POST /api/stop-requests/:id/accept accepts stop request", async () => {
        service.acceptStopRequest.mockResolvedValue({
            stopRequest: { id: "stop-1", state: "ACCEPTED" },
            booking: { id: "booking-1", status: "CONFIRMED" },
        });

        const req = new Request("http://localhost/api/stop-requests/stop-1/accept", {
            method: "POST",
        });
        const res = await acceptStopRequestRoute(req as never, {
            params: Promise.resolve({ stopRequestId: "stop-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.booking.id).toBe("booking-1");
        expect(service.acceptStopRequest).toHaveBeenCalledWith("stop-1", "rider-1");
    });

    it("POST /api/stop-requests/:id/reject rejects stop request", async () => {
        service.rejectStopRequest.mockResolvedValue({ id: "stop-1", state: "REJECTED" });

        const req = new Request("http://localhost/api/stop-requests/stop-1/reject", {
            method: "POST",
        });
        const res = await rejectStopRequestRoute(req as never, {
            params: Promise.resolve({ stopRequestId: "stop-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.item.state).toBe("REJECTED");
        expect(service.rejectStopRequest).toHaveBeenCalledWith("stop-1", "rider-1");
    });

    it("maps stop-request domain errors to HTTP responses", async () => {
        service.acceptStopRequest.mockRejectedValue(
            new MockStopRequestError("Only quoted stop requests can be accepted.", {
                statusCode: 409,
                error: "Conflict",
                code: "STOP_REQUEST_NOT_QUOTED",
            })
        );

        const req = new Request("http://localhost/api/stop-requests/stop-1/accept", {
            method: "POST",
        });
        const res = await acceptStopRequestRoute(req as never, {
            params: Promise.resolve({ stopRequestId: "stop-1" }),
        });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.code).toBe("STOP_REQUEST_NOT_QUOTED");
    });
});
