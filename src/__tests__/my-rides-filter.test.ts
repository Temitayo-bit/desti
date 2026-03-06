import { describe, expect, it } from "vitest";
import { filterMyRides, type MyRideFilterInput } from "@/lib/my-rides";

function fakeRide(overrides: Partial<MyRideFilterInput> = {}): MyRideFilterInput {
  return {
    id: "ride-1",
    destinationText: "Orlando",
    earliestDepartAt: "2030-01-01T10:00:00.000Z",
    distanceCategory: "MEDIUM",
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

  it("filters by quick distance category", () => {
    const rides = [
      fakeRide({ id: "short", distanceCategory: "SHORT" }),
      fakeRide({ id: "medium", distanceCategory: "MEDIUM" }),
      fakeRide({ id: "long", distanceCategory: "LONG" }),
    ];

    const result = filterMyRides({
      rides,
      searchQuery: "",
      activeFilter: "Short",
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(result.map((ride) => ride.id)).toEqual(["short"]);
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
});
