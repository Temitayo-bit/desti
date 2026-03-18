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
    seatsAvailable: 1,
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
      fakeTripRequest({ id: "tr-with-offer", seatsNeeded: 1, destinationText: "Orlando" }),
      fakeTripRequest({ id: "tr-without-offer", seatsNeeded: 3, destinationText: "Orlando" }),
    ];

    const pendingIds = new Set<string>(["tr-with-offer"]);

    const filtered = filterTripRequestsForBrowse({
      tripRequests,
      currentUserId: "driver-1",
      searchQuery: "orlando",
      activeFilter: "Offer Sent",
      pendingOfferTripRequestIds: pendingIds,
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("tr-with-offer");
    expect(filtered[0].hasPendingOffer).toBe(true);
  });

  it("filters rides by seat count and hides driver-owned rides", () => {
    const rides = [
      fakeRide({ id: "ride-own", driverUserId: "driver-1", destinationText: "Orlando", seatsAvailable: 4 }),
      fakeRide({ id: "ride-a", driverUserId: "driver-2", destinationText: "Orlando", seatsAvailable: 2 }),
      fakeRide({ id: "ride-b", driverUserId: "driver-3", destinationText: "Orlando", seatsAvailable: 1 }),
    ];

    const filtered = filterRidesForBrowse({
      rides,
      currentUserId: "driver-1",
      searchQuery: "orlando",
      activeFilter: "2+ Seats",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(filtered.map((ride) => ride.id)).toEqual(["ride-a"]);
  });

  it("filters rides into Soon and Later buckets", () => {
    const rides = [
      fakeRide({ id: "soon", earliestDepartAt: "2030-01-01T10:00:00.000Z", seatsAvailable: 1 }),
      fakeRide({ id: "later", earliestDepartAt: "2030-01-02T10:00:01.000Z", seatsAvailable: 1 }),
    ];

    const soon = filterRidesForBrowse({
      rides,
      currentUserId: null,
      searchQuery: "",
      activeFilter: "Soon",
      now: new Date("2030-01-01T10:00:00.000Z"),
    });

    const later = filterRidesForBrowse({
      rides,
      currentUserId: null,
      searchQuery: "",
      activeFilter: "Later",
      now: new Date("2030-01-01T10:00:00.000Z"),
    });

    expect(soon.map((ride) => ride.id)).toEqual(["soon"]);
    expect(later.map((ride) => ride.id)).toEqual(["later"]);
  });
});
