/**
 * @jest-environment node
 */
import "dotenv/config";
import { POST as createOffer } from "@/app/api/trip-requests/[tripRequestId]/offers/route";
import { POST as acceptOffer } from "@/app/api/offers/[offerId]/accept/route";
import { POST as cancelOffer } from "@/app/api/offers/[offerId]/cancel/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
    auth: vi.fn(),
    currentUser: vi.fn(),
}));

describe("Offer Lifecycle Integration Tests", () => {
    const RIDER_ID = "user_rider_test_" + Date.now();
    const DRIVER_ID = "user_driver_test_" + Date.now();
    const DRIVER_2_ID = "user_driver_2_" + Date.now();

    let tripRequestId: string;

    beforeAll(async () => {
        // Clean up
        await prisma.idempotencyKey.deleteMany();
        await prisma.offer.deleteMany();
        await prisma.booking.deleteMany();
        await prisma.tripRequest.deleteMany();
        await prisma.user.deleteMany({ where: { clerkUserId: { in: [RIDER_ID, DRIVER_ID, DRIVER_2_ID] } } });

        // Create Users
        await prisma.user.createMany({
            data: [
                { clerkUserId: RIDER_ID, email: "rider@stetson.edu" },
                { clerkUserId: DRIVER_ID, email: "driver@stetson.edu" },
                { clerkUserId: DRIVER_2_ID, email: "driver2@stetson.edu" },
            ],
        });

        // Create Trip Request (Active)
        const tr = await prisma.tripRequest.create({
            data: {
                riderUserId: RIDER_ID,
                originText: "DeLand",
                destinationText: "Orlando",
                earliestDesiredAt: new Date(Date.now() + 3600000), // +1h
                latestDesiredAt: new Date(Date.now() + 7200000), // +2h
                distanceCategory: "MEDIUM",
                seatsNeeded: 1,
                status: "ACTIVE",
            },
        });
        tripRequestId = tr.id;
    });

    afterAll(async () => {
        // Cleanup order matters for FKs
        await prisma.idempotencyKey.deleteMany();
        await prisma.offer.deleteMany(); // Deletes offers first
        // Bookings might link to TripRequest/Users. 
        // We need to delete bookings.
        await prisma.booking.deleteMany();
        await prisma.tripRequest.deleteMany();
        await prisma.user.deleteMany({ where: { clerkUserId: { in: [RIDER_ID, DRIVER_ID, DRIVER_2_ID] } } });
    });

    // Helper to mock auth
    const mockAuth = (userId: string) => {
        (auth as any).mockReturnValue({
            userId: userId,
            sessionId: "sess_test",
            getToken: async () => "token",
        });

        const emailMap: Record<string, string> = {
            [RIDER_ID]: "rider@stetson.edu",
            [DRIVER_ID]: "driver@stetson.edu",
            [DRIVER_2_ID]: "driver2@stetson.edu",
        };

        (currentUser as any).mockResolvedValue({
            id: userId,
            emailAddresses: [{ emailAddress: emailMap[userId], verification: { status: "verified" } }],
        });
    };

    const createReq = (url: string, headers: Record<string, string>, body: any) => {
        return new NextRequest(new URL(url, "http://localhost"), {
            method: "POST",
            headers: new Headers(headers),
            body: JSON.stringify(body),
        });
    };

    test("1. Driver can create an offer", async () => {
        mockAuth(DRIVER_ID);
        const key = "idemp_offer_1";
        const req = createReq(
            `http://localhost/api/trip-requests/${tripRequestId}/offers`,
            { "Idempotency-Key": key },
            { seatsOffered: 2, priceCents: 1500, message: "I can take you." }
        );

        const res = await createOffer(req, { params: Promise.resolve({ tripRequestId }) });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.id).toBeDefined();
        expect(json.status).toBe("PENDING");
        expect(json.seatsOffered).toBe(2);
    });

    test("2. Idempotency returns same offer", async () => {
        mockAuth(DRIVER_ID);
        const key = "idemp_offer_1"; // Same key
        const req = createReq(
            `http://localhost/api/trip-requests/${tripRequestId}/offers`,
            { "Idempotency-Key": key },
            { seatsOffered: 2, priceCents: 1500, message: "I can take you." }
        );

        const res = await createOffer(req, { params: Promise.resolve({ tripRequestId }) });
        expect(res.status).toBe(200); // 200 OK for replay
        const json = await res.json();
        expect(json.status).toBe("PENDING");
    });

    test("3. Self-offer blocked", async () => {
        mockAuth(RIDER_ID); // Rider tries to offer request
        const req = createReq(
            `http://localhost/api/trip-requests/${tripRequestId}/offers`,
            { "Idempotency-Key": "idemp_self" },
            { seatsOffered: 1, priceCents: 0 }
        );
        const res = await createOffer(req, { params: Promise.resolve({ tripRequestId }) });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.message).toContain("own request");
    });

    test("4. One active offer per driver", async () => {
        mockAuth(DRIVER_ID); // Already has offer from test 1
        const req = createReq(
            `http://localhost/api/trip-requests/${tripRequestId}/offers`,
            { "Idempotency-Key": "idemp_offer_new_key" },
            { seatsOffered: 2, priceCents: 1000 }
        );
        const res = await createOffer(req, { params: Promise.resolve({ tripRequestId }) });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.message).toContain("already have an active offer");
    });

    test("5. Rider can accept offer (Creates Booking + Closes Request)", async () => {
        // Setup: Create a competing offer from DRIVER_2_ID first to verify it gets cancelled later via updateMany
        mockAuth(DRIVER_2_ID);
        const req2 = createReq(
            `http://localhost/api/trip-requests/${tripRequestId}/offers`,
            { "Idempotency-Key": "idemp_offer_driver_2" },
            { seatsOffered: 1, priceCents: 1200, message: "I can take you too." }
        );
        const res2 = await createOffer(req2, { params: Promise.resolve({ tripRequestId }) });
        expect(res2.status).toBe(201);
        const offer2 = await res2.json();
        expect(offer2.status).toBe("PENDING");

        // Now accept Driver 1's offer
        const offers = await prisma.offer.findMany({ where: { driverUserId: DRIVER_ID, tripRequestId } });
        const offerId = offers[0].id;

        mockAuth(RIDER_ID);
        const req = createReq(`http://localhost/api/offers/${offerId}/accept`, {}, {});
        const res = await acceptOffer(req, { params: Promise.resolve({ offerId }) });

        expect(res.status).toBe(200);
        const json = await res.json();

        // Verify Response Structure
        expect(json.offer).toBeDefined();
        expect(json.booking).toBeDefined();
        expect(json.offer.status).toBe("ACCEPTED");
        expect(json.booking.status).toBe("CONFIRMED");
        expect(json.booking.driverUserId).toBe(DRIVER_ID);
        expect(json.booking.tripRequestId).toBe(tripRequestId);
        expect(json.booking.priceCents).toBe(1500); // From Test 1

        // Verify DB State: TripRequest Closed?
        const tr = await prisma.tripRequest.findUnique({ where: { id: tripRequestId } });
        expect(tr?.status).toBe("CLOSED");

        // Verify DB State: Competing Offer Cancelled?
        const competingOffer = await prisma.offer.findUnique({ where: { id: offer2.id } });
        expect(competingOffer?.status).toBe("CANCELLED");
    });

    test("6. Driver cannot accept offer", async () => {
        mockAuth(DRIVER_ID);
        // Create new offer from Driver 2 on a NEW request (since old one is closed)
        const tr2 = await prisma.tripRequest.create({
            data: {
                riderUserId: RIDER_ID,
                originText: "Test2", destinationText: "Test2",
                earliestDesiredAt: new Date(), latestDesiredAt: new Date(),
                distanceCategory: "SHORT", seatsNeeded: 1,
                status: "ACTIVE",
            },
        });

        const offer2 = await prisma.offer.create({
            data: {
                tripRequestId: tr2.id,
                driverUserId: DRIVER_2_ID,
                riderUserId: RIDER_ID,
                seatsOffered: 1,
                priceCents: 1000,
                status: "PENDING"
            }
        });

        const req = createReq(`http://localhost/api/offers/${offer2.id}/accept`, {}, {});
        const res = await acceptOffer(req, { params: Promise.resolve({ offerId: offer2.id }) });
        expect(res.status).toBe(403); // Forbidden
    });

    test("7. Only one accepted offer allowed (Simulate Double Accept on fresh request)", async () => {
        // Create new TR
        const tr = await prisma.tripRequest.create({
            data: {
                riderUserId: RIDER_ID,
                originText: "DoubleAccept", destinationText: "Test",
                earliestDesiredAt: new Date(), latestDesiredAt: new Date(),
                distanceCategory: "SHORT", seatsNeeded: 1,
                status: "ACTIVE",
            },
        });

        // Create 2 offers (DB direct)
        const o1 = await prisma.offer.create({
            data: { tripRequestId: tr.id, driverUserId: DRIVER_ID, riderUserId: RIDER_ID, seatsOffered: 1, priceCents: 1000, status: "PENDING" }
        });
        const o2 = await prisma.offer.create({
            data: { tripRequestId: tr.id, driverUserId: DRIVER_2_ID, riderUserId: RIDER_ID, seatsOffered: 1, priceCents: 1000, status: "PENDING" }
        });

        // Accept Offer 1
        mockAuth(RIDER_ID);
        const req1 = createReq(`http://localhost/api/offers/${o1.id}/accept`, {}, {});
        const res1 = await acceptOffer(req1, { params: Promise.resolve({ offerId: o1.id }) });
        expect(res1.status).toBe(200);

        // Try Accept Offer 2
        const req2 = createReq(`http://localhost/api/offers/${o2.id}/accept`, {}, {});
        const res2 = await acceptOffer(req2, { params: Promise.resolve({ offerId: o2.id }) });

        // Should Conflict because TripRequest is CLOSED or offer already accepted
        expect(res2.status).toBe(409); // Conflict
        const json = await res2.json();
        // Reason could be "Trip request is no longer active" OR "already has an accepted offer" depending on which check hits first
        // In our transaction, we check ACTIVE status first.
        expect(json.message).toBeTruthy();
    });

    test("8. Driver can cancel their offer (Pending only)", async () => {
        // Use a new TR/Offer
        const tr3 = await prisma.tripRequest.create({
            data: { riderUserId: RIDER_ID, originText: "CancelTest", destinationText: "Test", earliestDesiredAt: new Date(), latestDesiredAt: new Date(), distanceCategory: "SHORT", seatsNeeded: 1, status: "ACTIVE" }
        });
        const offer = await prisma.offer.create({
            data: { tripRequestId: tr3.id, driverUserId: DRIVER_2_ID, riderUserId: RIDER_ID, seatsOffered: 1, priceCents: 1000, status: "PENDING" }
        });

        mockAuth(DRIVER_2_ID);
        const req = createReq(`http://localhost/api/offers/${offer.id}/cancel`, {}, {});
        const res = await cancelOffer(req, { params: Promise.resolve({ offerId: offer.id }) });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe("CANCELLED");
    });

    test("9. Driver cannot cancel ACCEPTED offers", async () => {
        // Create new TR, Accepted Offer
        const tr = await prisma.tripRequest.create({ data: { riderUserId: RIDER_ID, originText: "Active", destinationText: "A", earliestDesiredAt: new Date(), latestDesiredAt: new Date(), distanceCategory: "SHORT", seatsNeeded: 1, status: "CLOSED" } });
        const offer = await prisma.offer.create({ data: { tripRequestId: tr.id, driverUserId: DRIVER_ID, riderUserId: RIDER_ID, seatsOffered: 1, priceCents: 1000, status: "ACCEPTED" } });

        mockAuth(DRIVER_ID);
        const req = createReq(`http://localhost/api/offers/${offer.id}/cancel`, {}, {});
        const res = await cancelOffer(req, { params: Promise.resolve({ offerId: offer.id }) });

        expect(res.status).toBe(409); // Conflict
        const json = await res.json();
        expect(json.message).toContain("Drivers cannot cancel");
    });

    test("10. Rider can cancel ACCEPTED offer (Cascades to Booking + Re-opens Request)", async () => {
        // Create new TR, Accepted Offer
        const tr = await prisma.tripRequest.create({ data: { riderUserId: RIDER_ID, originText: "Active", destinationText: "A", earliestDesiredAt: new Date(), latestDesiredAt: new Date(), distanceCategory: "SHORT", seatsNeeded: 1, status: "CLOSED" } });

        // Use offer creation to ensure booking creation? 
        // No, let's artificially create the state to match "Accepted" state
        const offer = await prisma.offer.create({ data: { tripRequestId: tr.id, driverUserId: DRIVER_ID, riderUserId: RIDER_ID, seatsOffered: 1, priceCents: 1000, status: "ACCEPTED" } });
        const booking = await prisma.booking.create({ data: { tripRequestId: tr.id, driverUserId: DRIVER_ID, riderUserId: RIDER_ID, seatsBooked: 1, priceCents: 1000, status: "CONFIRMED" } });

        mockAuth(RIDER_ID);
        const req = createReq(`http://localhost/api/offers/${offer.id}/cancel`, {}, {});
        const res = await cancelOffer(req, { params: Promise.resolve({ offerId: offer.id }) });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe("CANCELLED");

        // Verify TripRequest is ACTIVE
        const updatedTR = await prisma.tripRequest.findUnique({ where: { id: tr.id } });
        expect(updatedTR?.status).toBe("ACTIVE");

        // Verify Booking is CANCELLED
        const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
        expect(updatedBooking?.status).toBe("CANCELLED");
    });
});
