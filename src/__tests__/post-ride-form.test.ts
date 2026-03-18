import { describe, expect, it } from "vitest";
import {
  buildPostRidePayload,
  canSubmitPostRide,
  dollarsToCents,
  type PostRideFormValues,
} from "@/lib/post-ride-form";

function validFormValues(overrides: Partial<PostRideFormValues> = {}): PostRideFormValues {
  return {
    originText: "Stetson University",
    destinationText: "Daytona Beach",
    earliestDepartAt: "2030-01-01T10:00",
    latestDepartAt: "2030-01-01T12:00",
    preferredDepartAt: "",
    seatsTotal: "3",
    priceDollars: "12.50",
    distanceCategory: "MEDIUM",
    pickupInstructions: "",
    dropoffInstructions: "",
    ...overrides,
  };
}

describe("post-ride form helpers", () => {
  it("converts dollars to cents", () => {
    expect(dollarsToCents("12.50")).toBe(1250);
    expect(dollarsToCents("0")).toBe(0);
    expect(dollarsToCents("12.345")).toBe(1235);
  });

  it("builds payload with required fields and omits blank optionals", () => {
    const now = new Date("2030-01-01T09:00:00.000Z");
    const result = buildPostRidePayload(validFormValues(), now);

    expect(result.submitError).toBeNull();
    expect(result.fieldErrors).toEqual({});
    expect(result.payload).not.toBeNull();
    expect(result.payload?.distanceCategory).toBe("MEDIUM");
    expect(result.payload?.priceCents).toBe(1250);
    expect(result.payload?.pickupInstructions).toBeUndefined();
    expect(result.payload?.dropoffInstructions).toBeUndefined();
    expect(result.payload?.preferredDepartAt).toBeUndefined();
  });

  it("validates missing required fields and invalid ranges", () => {
    const now = new Date("2030-01-01T15:00:00.000Z");
    const result = buildPostRidePayload(
      validFormValues({
        originText: " ",
        destinationText: "",
        earliestDepartAt: "2030-01-01T08:30",
        latestDepartAt: "2030-01-01T08:15",
        seatsTotal: "9",
        priceDollars: "-1",
        distanceCategory: "",
      }),
      now,
    );

    expect(result.payload).toBeNull();
    expect(result.submitError).not.toBeNull();
    expect(result.fieldErrors.originText).toBeDefined();
    expect(result.fieldErrors.destinationText).toBeDefined();
    expect(result.fieldErrors.earliestDepartAt).toBeDefined();
    expect(result.fieldErrors.latestDepartAt).toBeDefined();
    expect(result.fieldErrors.seatsTotal).toBeDefined();
    expect(result.fieldErrors.priceDollars).toBeDefined();
    expect(result.fieldErrors.distanceCategory).toBeDefined();
  });

  it("blocks submit while a request is already in-flight", () => {
    expect(canSubmitPostRide(true)).toBe(false);
    expect(canSubmitPostRide(false)).toBe(true);
  });
});
