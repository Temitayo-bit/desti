import { describe, expect, it } from "vitest";
import {
  buildOfferPayload,
  filterRidesForBrowse,
  filterTripRequestsForBrowse,
  getPendingOfferTripRequestIds,
  type OfferFormValues,
  type PendingOfferSummary,
  type RideBrowseSummary,
  type TripRequestSummary,
} from "@/lib/browse-trip-requests";

function validOfferFormValues(
  overrides: Partial<OfferFormValues> = {},
): OfferFormValues {
  return {
    seatsOffered: "2",
    priceDollars: "12.50",
    message: "Can leave from campus at 5 PM",
    ...overrides,
  };
}

function fakeTripRequest(
  overrides: Partial<TripRequestSummary> = {},
): TripRequestSummary {
  return {
    id: "tr-1",
    riderUserId: "rider-1",
    originText: "Stetson University",
    destinationText: "Orlando Airport",
    earliestDesiredAt: "2030-01-01T10:00:00.000Z",
    latestDesiredAt: "2030-01-01T12:00:00.000Z",
    distanceCategory: "MEDIUM",
    seatsNeeded: 2,
    pickupInstructions: null,
    dropoffInstructions: null,
    preferredDepartAt: null,
    status: "ACTIVE",
    createdAt: "2030-01-01T08:00:00.000Z",
    updatedAt: "2030-01-01T08:00:00.000Z",
    ...overrides,
  };
}

function fakeRide(overrides: Partial<RideBrowseSummary> = {}): RideBrowseSummary {
  return {
    id: "ride-1",
    driverUserId: "driver-1",
    destinationText: "Orlando",
    earliestDepartAt: "2030-01-01T10:00:00.000Z",
    distanceCategory: "MEDIUM",
    ...overrides,
  };
}

describe("browse-trip-requests helpers", () => {
  it("builds a valid offer payload and converts dollars to cents", () => {
    const result = buildOfferPayload(validOfferFormValues());

    expect(result.submitError).toBeNull();
    expect(result.fieldErrors).toEqual({});
    expect(result.payload).toEqual({
      seatsOffered: 2,
      priceCents: 1250,
      message: "Can leave from campus at 5 PM",
    });
  });

  it("omits empty message while keeping payload valid", () => {
    const result = buildOfferPayload(validOfferFormValues({ message: "   " }));

    expect(result.submitError).toBeNull();
    expect(result.payload).toEqual({ seatsOffered: 2, priceCents: 1250 });
  });

  it("validates seats, price, and message length", () => {
    const result = buildOfferPayload(
      validOfferFormValues({
        seatsOffered: "9",
        priceDollars: "-1",
        message: "x".repeat(501),
      }),
    );

    expect(result.payload).toBeNull();
    expect(result.submitError).not.toBeNull();
    expect(result.fieldErrors.seatsOffered).toBeDefined();
    expect(result.fieldErrors.priceDollars).toBeDefined();
    expect(result.fieldErrors.message).toBeDefined();
  });

  it("maps pending offers into a trip-request id set", () => {
    const offers: PendingOfferSummary[] = [
      { id: "o1", tripRequestId: "tr-1", status: "PENDING" },
      { id: "o2", tripRequestId: "tr-2", status: "CANCELLED" },
      { id: "o3", tripRequestId: "tr-3", status: "PENDING" },
    ];

    const pendingIds = getPendingOfferTripRequestIds(offers);
    expect(pendingIds.has("tr-1")).toBe(true);
    expect(pendingIds.has("tr-3")).toBe(true);
    expect(pendingIds.has("tr-2")).toBe(false);
  });

  it("filters trip requests by ownership/search/filter and marks pending offers", () => {
    const tripRequests = [
      fakeTripRequest({ id: "tr-own", riderUserId: "driver-1", destinationText: "Miami" }),
      fakeTripRequest({ id: "tr-short", distanceCategory: "SHORT", destinationText: "Orlando" }),
      fakeTripRequest({ id: "tr-medium", distanceCategory: "MEDIUM", destinationText: "Tampa" }),
    ];

    const pendingIds = new Set<string>(["tr-short"]);

    const filtered = filterTripRequestsForBrowse({
      tripRequests,
      currentUserId: "driver-1",
      searchQuery: "orlando",
      activeFilter: "Short",
      pendingOfferTripRequestIds: pendingIds,
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("tr-short");
    expect(filtered[0].hasPendingOffer).toBe(true);
  });

  it("filters rides and hides driver-owned rides", () => {
    const rides = [
      fakeRide({ id: "ride-own", driverUserId: "driver-1", destinationText: "Orlando", distanceCategory: "SHORT" }),
      fakeRide({ id: "ride-a", driverUserId: "driver-2", destinationText: "Orlando", distanceCategory: "SHORT" }),
      fakeRide({ id: "ride-b", driverUserId: "driver-3", destinationText: "Tampa", distanceCategory: "MEDIUM" }),
    ];

    const filtered = filterRidesForBrowse({
      rides,
      currentUserId: "driver-1",
      searchQuery: "orlando",
      activeFilter: "Short",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(filtered.map((ride) => ride.id)).toEqual(["ride-a"]);
  });
});
