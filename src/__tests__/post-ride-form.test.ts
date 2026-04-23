import { describe, expect, it } from "vitest";
import {
  buildPostRidePayload,
  canSubmitPostRide,
  dollarsToCents,
  type PostRideFormValues,
} from "@/lib/post-ride-form";
import type { LocationField } from "@/lib/location-field";

function validLocationField(label: string, latitude: number, longitude: number): LocationField {
  return {
    inputText: label,
    selectedLabel: label,
    latitude,
    longitude,
    isValidSelection: true,
  };
}

function invalidLocationField(inputText: string): LocationField {
  return {
    inputText,
    selectedLabel: null,
    latitude: null,
    longitude: null,
    isValidSelection: false,
  };
}

function validFormValues(overrides: Partial<PostRideFormValues> = {}): PostRideFormValues {
  return {
    origin: validLocationField("Stetson University", 29.0361, -81.302),
    destination: validLocationField("Daytona Beach", 29.2108, -81.0228),
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
        origin: invalidLocationField(" "),
        destination: invalidLocationField(""),
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

  it("requires a valid selected suggestion for both locations", () => {
    const now = new Date("2030-01-01T09:00:00.000Z");
    const result = buildPostRidePayload(
      validFormValues({
        origin: invalidLocationField("Stetson University"),
        destination: invalidLocationField("Daytona Beach"),
      }),
      now,
    );

    expect(result.payload).toBeNull();
    expect(result.fieldErrors.originText).toContain(
      "Please select a valid location from suggestions.",
    );
    expect(result.fieldErrors.destinationText).toContain(
      "Please select a valid location from suggestions.",
    );
  });

  it("blocks submit while a request is already in-flight", () => {
    expect(canSubmitPostRide(true)).toBe(false);
    expect(canSubmitPostRide(false)).toBe(true);
  });
});
