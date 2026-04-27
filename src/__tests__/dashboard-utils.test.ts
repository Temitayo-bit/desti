import { describe, expect, it } from "vitest";
import {
    formatRelativeTime,
    getSeatDisplayText,
    normalizeDashboardBooking,
    toDistanceLabel,
    type DashboardBookingItem,
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
});
