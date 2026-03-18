import { describe, expect, it } from "vitest";
import { filterMyRides, type MyRideFilterInput } from "@/lib/my-rides";

function fakeRide(overrides: Partial<MyRideFilterInput> = {}): MyRideFilterInput {
  return {
    id: "ride-1",
    destinationText: "Orlando",
    earliestDepartAt: "2030-01-01T10:00:00.000Z",
    latestDepartAt: "2030-01-01T11:00:00.000Z",
    distanceCategory: "MEDIUM",
    confirmedBookings: [],
    ...overrides,
  };
}

describe("my-rides filter helper", () => {
  it("returns all rides when filter is All and query is empty", () => {
    const rides = [fakeRide({ id: "a" }), fakeRide({ id: "b" })];

    const result = filterMyRides({
      rides,
      searchQuery: "",
      activeFilter: "All",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["a", "b"]);
  });

  it("filters by destination search query", () => {
    const rides = [
      fakeRide({ id: "a", destinationText: "Orlando" }),
      fakeRide({ id: "b", destinationText: "Tampa" }),
    ];

    const result = filterMyRides({
      rides,
      searchQuery: "orlan",
      activeFilter: "All",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["a"]);
  });

  it("filters by Upcoming using rides after today", () => {
    const rides = [
      fakeRide({ id: "today", earliestDepartAt: "2030-01-01T18:00:00.000Z" }),
      fakeRide({ id: "upcoming", earliestDepartAt: "2030-01-02T10:00:00.000Z" }),
    ];

    const result = filterMyRides({
      rides,
      searchQuery: "",
      activeFilter: "Upcoming",
      now: new Date("2030-01-01T12:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["upcoming"]);
  });

  it("filters by Today using earliestDepartAt", () => {
    const rides = [
      fakeRide({ id: "today", earliestDepartAt: "2030-01-01T10:00:00.000Z" }),
      fakeRide({ id: "later", earliestDepartAt: "2030-01-02T10:00:00.000Z" }),
    ];

    const result = filterMyRides({
      rides,
      searchQuery: "",
      activeFilter: "Today",
      now: new Date("2030-01-01T12:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["today"]);
  });

  it("filters by Past using latestDepartAt", () => {
    const rides = [
      fakeRide({
        id: "past",
        earliestDepartAt: "2029-12-31T10:00:00.000Z",
        latestDepartAt: "2029-12-31T11:00:00.000Z",
      }),
      fakeRide({
        id: "future",
        earliestDepartAt: "2030-01-01T18:00:00.000Z",
        latestDepartAt: "2030-01-01T19:00:00.000Z",
      }),
    ];

    const result = filterMyRides({
      rides,
      searchQuery: "",
      activeFilter: "Past",
      now: new Date("2030-01-01T12:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["past"]);
  });

  it("filters by Has Upcoming Bookings using confirmed bookings", () => {
    const rides = [
      fakeRide({ id: "open", confirmedBookings: [] }),
      fakeRide({
        id: "booked",
        latestDepartAt: "2030-01-01T19:00:00.000Z",
        confirmedBookings: [{ id: "booking-1" }],
      }),
    ];

    const result = filterMyRides({
      rides,
      searchQuery: "",
      activeFilter: "Has Upcoming Bookings",
      now: new Date("2030-01-01T12:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["booked"]);
  });

  it("excludes past rides from Has Upcoming Bookings", () => {
    const rides = [
      fakeRide({
        id: "past-booked",
        latestDepartAt: "2029-12-31T11:00:00.000Z",
        confirmedBookings: [{ id: "booking-1" }],
      }),
      fakeRide({
        id: "upcoming-booked",
        latestDepartAt: "2030-01-01T19:00:00.000Z",
        confirmedBookings: [{ id: "booking-2" }],
      }),
    ];

    const result = filterMyRides({
      rides,
      searchQuery: "",
      activeFilter: "Has Upcoming Bookings",
      now: new Date("2030-01-01T12:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["upcoming-booked"]);
  });
});
