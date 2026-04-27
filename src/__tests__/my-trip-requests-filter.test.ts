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
    status: "ACTIVE",
    confirmedBookings: [],
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
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["a"]);
  });

  it("filters by Active using status", () => {
    const tripRequests = [
      fakeTripRequest({ id: "active", status: "ACTIVE" }),
      fakeTripRequest({ id: "closed", status: "CLOSED" }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "",
      activeFilter: "Active",
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["active"]);
  });

  it("filters by Offers Received using pending offer ids", () => {
    const tripRequests = [
      fakeTripRequest({ id: "with-offer" }),
      fakeTripRequest({ id: "without-offer" }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "",
      activeFilter: "Offers Received",
      pendingOfferTripRequestIds: new Set(["with-offer"]),
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["with-offer"]);
  });

  it("filters by Booked using confirmed bookings", () => {
    const tripRequests = [
      fakeTripRequest({ id: "open", confirmedBookings: [] }),
      fakeTripRequest({
        id: "booked",
        confirmedBookings: [{ id: "booking-1" }],
      }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "",
      activeFilter: "Booked",
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["booked"]);
  });

  it("filters by Closed using status", () => {
    const tripRequests = [
      fakeTripRequest({ id: "active", status: "ACTIVE" }),
      fakeTripRequest({ id: "closed", status: "CLOSED" }),
    ];

    const result = filterMyTripRequests({
      tripRequests,
      searchQuery: "",
      activeFilter: "Closed",
    });

    expect(result.map((tripRequest) => tripRequest.id)).toEqual(["closed"]);
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
