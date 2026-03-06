import { describe, expect, it } from "vitest";
import {
  filterMyTripRequests,
  getPendingOffersForTripRequest,
  groupPendingOffersByTripRequestId,
  hasPendingOffersForTripRequest,
  type PendingIncomingOffer,
  type MyTripRequestFilterInput,
} from "@/lib/my-trip-requests";

function fakeTripRequest(
  overrides: Partial<MyTripRequestFilterInput> = {},
): MyTripRequestFilterInput {
  return {
    id: "trip-request-1",
    destinationText: "Orlando",
    earliestDesiredAt: "2030-01-01T10:00:00.000Z",
    distanceCategory: "MEDIUM",
    ...overrides,
  };
}

describe("my-trip-requests filter helper", () => {
  it("returns all trip requests when filter is All and query is empty", () => {
    const tripRequests = [
      fakeTripRequest({ id: "a" }),
      fakeTripRequest({ id: "b" }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "",
      activeFilter: "All",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["a", "b"]);
  });

  it("filters by destination search query", () => {
    const tripRequests = [
      fakeTripRequest({ id: "a", destinationText: "Orlando" }),
      fakeTripRequest({ id: "b", destinationText: "Tampa" }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "orlan",
      activeFilter: "All",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["a"]);
  });

  it("filters by quick distance category", () => {
    const tripRequests = [
      fakeTripRequest({ id: "short", distanceCategory: "SHORT" }),
      fakeTripRequest({ id: "medium", distanceCategory: "MEDIUM" }),
      fakeTripRequest({ id: "long", distanceCategory: "LONG" }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "",
      activeFilter: "Short",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["short"]);
  });

  it("filters by Today using earliestDesiredAt", () => {
    const tripRequests = [
      fakeTripRequest({
        id: "today",
        earliestDesiredAt: "2030-01-01T10:00:00.000Z",
      }),
      fakeTripRequest({
        id: "later",
        earliestDesiredAt: "2030-01-02T10:00:00.000Z",
      }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "",
      activeFilter: "Today",
      now: new Date("2030-01-01T12:00:00.000Z"),
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["today"]);
  });

  it("groups pending offers by trip request id", () => {
    const offers: PendingIncomingOffer[] = [
      {
        id: "offer-1",
        tripRequestId: "request-a",
        driverUserId: "driver-1",
        riderUserId: "rider-1",
        seatsOffered: 2,
        priceCents: 1200,
        message: null,
        status: "PENDING",
        createdAt: "2030-01-01T12:00:00.000Z",
      },
      {
        id: "offer-2",
        tripRequestId: "request-a",
        driverUserId: "driver-2",
        riderUserId: "rider-1",
        seatsOffered: 1,
        priceCents: 1500,
        message: "Can leave at 5PM",
        status: "PENDING",
        createdAt: "2030-01-01T13:00:00.000Z",
      },
      {
        id: "offer-3",
        tripRequestId: "request-b",
        driverUserId: "driver-3",
        riderUserId: "rider-1",
        seatsOffered: 3,
        priceCents: 2000,
        message: null,
        status: "PENDING",
        createdAt: "2030-01-01T14:00:00.000Z",
      },
    ];

    const grouped = groupPendingOffersByTripRequestId(offers);

    expect(grouped["request-a"].map((offer) => offer.id)).toEqual([
      "offer-1",
      "offer-2",
    ]);
    expect(grouped["request-b"].map((offer) => offer.id)).toEqual(["offer-3"]);
  });

  it("returns chip visibility by pending offers map", () => {
    const grouped = groupPendingOffersByTripRequestId([
      {
        id: "offer-1",
        tripRequestId: "request-a",
        driverUserId: "driver-1",
        riderUserId: "rider-1",
        seatsOffered: 2,
        priceCents: 1200,
        message: null,
        status: "PENDING",
        createdAt: "2030-01-01T12:00:00.000Z",
      },
    ]);

    expect(hasPendingOffersForTripRequest(grouped, "request-a")).toBe(true);
    expect(hasPendingOffersForTripRequest(grouped, "request-b")).toBe(false);
  });

  it("reflects pending offer removal after accept/cancel updates", () => {
    const groupedBefore = groupPendingOffersByTripRequestId([
      {
        id: "offer-1",
        tripRequestId: "request-a",
        driverUserId: "driver-1",
        riderUserId: "rider-1",
        seatsOffered: 2,
        priceCents: 1200,
        message: null,
        status: "PENDING",
        createdAt: "2030-01-01T12:00:00.000Z",
      },
    ]);

    expect(getPendingOffersForTripRequest(groupedBefore, "request-a")).toHaveLength(1);
    expect(hasPendingOffersForTripRequest(groupedBefore, "request-a")).toBe(true);

    const groupedAfter = groupPendingOffersByTripRequestId([]);
    expect(getPendingOffersForTripRequest(groupedAfter, "request-a")).toHaveLength(0);
    expect(hasPendingOffersForTripRequest(groupedAfter, "request-a")).toBe(false);
  });
});
