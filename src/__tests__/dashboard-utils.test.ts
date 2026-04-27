import { describe, expect, it } from "vitest";
import {
    dedupeBookingsById,
    filterOffersSentForDashboard,
    formatRelativeTime,
    getSeatDisplayText,
    normalizeDashboardBooking,
    offerOutcomeLabel,
    toDistanceLabel,
    type DashboardBookingItem,
    type DashboardOfferSummary,
} from "@/lib/dashboard";

describe("dashboard helpers", () => {
    it("normalizes ride-based bookings with price", () => {
        const booking: DashboardBookingItem = {
            id: "booking-ride",
            riderUserId: "rider-1",
            driverUserId: null,
            status: "CONFIRMED",
            seatsBooked: 2,
            priceCents: 2500,
            createdAt: "2026-03-05T12:00:00.000Z",
            ride: {
                id: "ride-1",
                driverUserId: "driver-1",
                originText: "Stetson University",
                destinationText: "Orlando Airport",
                earliestDepartAt: "2026-03-10T13:00:00.000Z",
                latestDepartAt: "2026-03-10T15:00:00.000Z",
                preferredDepartAt: null,
                distanceCategory: "LONG",
                priceCents: 2500,
                seatsTotal: 4,
                seatsAvailable: 2,
                status: "ACTIVE",
            },
        };

        const normalized = normalizeDashboardBooking(booking);
        expect(normalized.originText).toBe("Stetson University");
        expect(normalized.destinationText).toBe("Orlando Airport");
        expect(normalized.startsAt).toBe("2026-03-10T13:00:00.000Z");
        expect(normalized.endsAt).toBe("2026-03-10T15:00:00.000Z");
        expect(normalized.priceCents).toBe(2500);
        expect(normalized.riderUserId).toBe("rider-1");
        expect(normalized.driverUserId).toBe("driver-1");
        expect(normalized.totalSeatsBooked).toBe(2);
        expect(normalized.driverName).toBeNull();
    });

    it("normalizes trip-request bookings with booking-level price", () => {
        const booking: DashboardBookingItem = {
            id: "booking-trip",
            riderUserId: "rider-2",
            driverUserId: "driver-2",
            status: "CONFIRMED",
            seatsBooked: 1,
            priceCents: 3000,
            createdAt: "2026-03-05T12:00:00.000Z",
            tripRequest: {
                id: "trip-1",
                originText: "DeLand",
                destinationText: "Jacksonville",
                earliestDesiredAt: "2026-03-14T19:00:00.000Z",
                latestDesiredAt: "2026-03-14T21:00:00.000Z",
                preferredDepartAt: null,
                distanceCategory: "MEDIUM",
                seatsNeeded: 2,
                status: "ACTIVE",
            },
        };

        const normalized = normalizeDashboardBooking(booking);
        expect(normalized.originText).toBe("DeLand");
        expect(normalized.destinationText).toBe("Jacksonville");
        expect(normalized.startsAt).toBe("2026-03-14T19:00:00.000Z");
        expect(normalized.endsAt).toBe("2026-03-14T21:00:00.000Z");
        expect(normalized.priceCents).toBe(3000);
        expect(normalized.riderUserId).toBe("rider-2");
        expect(normalized.driverUserId).toBe("driver-2");
        expect(normalized.totalSeatsBooked).toBe(1);
        expect(normalized.driverName).toBeNull();
    });

    it("formats seat text based on viewer role", () => {
        const booking = {
            id: "booking-role",
            riderUserId: "rider-9",
            driverUserId: "driver-9",
            status: "CONFIRMED" as const,
            seatsBooked: 1,
            priceCents: 1000,
            totalSeatsBooked: 3,
            originText: "A",
            originLatitude: null,
            originLongitude: null,
            destinationText: "B",
            destinationLatitude: null,
            destinationLongitude: null,
            startsAt: "2026-03-10T13:00:00.000Z",
            endsAt: "2026-03-10T15:00:00.000Z",
            distanceCategory: "SHORT" as const,
            driverName: null,
            vehicleType: null,
        };

        expect(getSeatDisplayText(booking, "rider-9")).toBe("1 seat booked");
        expect(getSeatDisplayText(booking, "driver-9")).toBe("3 seats booked total");
        expect(getSeatDisplayText(booking, null)).toBe("1 seat booked");
    });

    it("formats relative times consistently", () => {
        const now = new Date("2026-03-05T12:00:00.000Z");

        expect(formatRelativeTime("2026-03-05T11:59:40.000Z", now)).toBe("just now");
        expect(formatRelativeTime("2026-03-05T11:59:00.000Z", now)).toBe("1 minute ago");
        expect(formatRelativeTime("2026-03-05T10:00:00.000Z", now)).toBe("2 hours ago");
        expect(formatRelativeTime("2026-03-02T12:00:00.000Z", now)).toBe("3 days ago");
        expect(formatRelativeTime("not-a-date", now)).toBe("just now");
    });

    it("maps distance labels to UI text", () => {
        expect(toDistanceLabel("SHORT")).toBe("Short Distance");
        expect(toDistanceLabel("MEDIUM")).toBe("Medium Distance");
        expect(toDistanceLabel("LONG")).toBe("Long Distance");
    });

    it("dedupes normalized bookings by id", () => {
        const a = {
            id: "dup-1",
            riderUserId: "r-1",
            driverUserId: "d-1",
            status: "CONFIRMED" as const,
            seatsBooked: 1,
            priceCents: 1000,
            totalSeatsBooked: 1,
            originText: "A",
            originLatitude: null,
            originLongitude: null,
            destinationText: "B",
            destinationLatitude: null,
            destinationLongitude: null,
            startsAt: "2026-03-10T13:00:00.000Z",
            endsAt: "2026-03-10T15:00:00.000Z",
            distanceCategory: "SHORT" as const,
            driverName: null,
            vehicleType: null,
        };
        const b = { ...a, seatsBooked: 2 };
        const out = dedupeBookingsById([a, b]);
        expect(out).toHaveLength(1);
        expect(out[0]!.id).toBe("dup-1");
    });

    it("filters and ranks dashboard sent offers", () => {
        const now = new Date("2026-04-20T12:00:00.000Z");
        const future = "2026-04-25T12:00:00.000Z";
        const past = "2026-04-10T12:00:00.000Z";

        const tr = {
            id: "tr-1",
            originText: "O1",
            destinationText: "D1",
            earliestDesiredAt: "2026-04-24T10:00:00.000Z",
            latestDesiredAt: future,
            preferredDepartAt: null,
            distanceCategory: "MEDIUM" as const,
            seatsNeeded: 1,
            status: "ACTIVE" as const,
        };

        const offer = (
            id: string,
            status: DashboardOfferSummary["status"],
            latest: string,
            created: string
        ): DashboardOfferSummary => ({
            id,
            tripRequestId: "tr-1",
            driverUserId: "d1",
            riderUserId: "r1",
            seatsOffered: 1,
            priceCents: 100,
            message: null,
            status,
            createdAt: created,
            tripRequest: { ...tr, id: "tr-1", latestDesiredAt: latest },
            driver: { name: "X" },
        });

        const pendingFuture = offer("o1", "PENDING", future, "2026-04-18T10:00:00.000Z");
        const acceptedFuture = offer("o2", "ACCEPTED", future, "2026-04-19T10:00:00.000Z");
        const pendingExpired = offer("o3", "PENDING", past, "2026-04-19T10:00:00.000Z");
        const cancelled = offer("o4", "CANCELLED", past, "2026-04-19T10:00:00.000Z");

        const mixed = [pendingExpired, acceptedFuture, cancelled, pendingFuture];
        const out = filterOffersSentForDashboard(mixed, now, { maxItems: 5 });
        expect(out.map((o) => o.id)).toEqual(["o1", "o2", "o4"]);
    });

    it("maps offer Prisma status to user-facing label", () => {
        expect(offerOutcomeLabel("PENDING")).toBe("Pending");
        expect(offerOutcomeLabel("ACCEPTED")).toBe("Accepted");
        expect(offerOutcomeLabel("CANCELLED")).toBe("Rejected");
    });
});
