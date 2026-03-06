import { describe, expect, it } from "vitest";
import {
  buildPostTripRequestPayload,
  canSubmitPostTripRequest,
  type PostTripRequestFormValues,
} from "@/lib/post-trip-request-form";

function validFormValues(
  overrides: Partial<PostTripRequestFormValues> = {},
): PostTripRequestFormValues {
  return {
    originText: "Stetson University",
    destinationText: "Daytona Beach",
    earliestDesiredAt: "2030-01-01T10:00",
    latestDesiredAt: "2030-01-01T12:00",
    preferredDepartAt: "",
    seatsNeeded: "3",
    distanceCategory: "MEDIUM",
    pickupInstructions: "",
    dropoffInstructions: "",
    ...overrides,
  };
}

describe("post-trip-request form helpers", () => {
  it("builds payload with required fields and omits blank optionals", () => {
    const now = new Date("2030-01-01T09:00:00.000Z");
    const result = buildPostTripRequestPayload(validFormValues(), now);

    expect(result.submitError).toBeNull();
    expect(result.fieldErrors).toEqual({});
    expect(result.payload).not.toBeNull();
    expect(result.payload?.distanceCategory).toBe("MEDIUM");
    expect(result.payload?.seatsNeeded).toBe(3);
    expect(result.payload?.pickupInstructions).toBeUndefined();
    expect(result.payload?.dropoffInstructions).toBeUndefined();
    expect(result.payload?.preferredDepartAt).toBeUndefined();
  });

  it("validates required fields, text lengths, and seats range", () => {
    const now = new Date("2030-01-01T15:00:00.000Z");
    const result = buildPostTripRequestPayload(
      validFormValues({
        originText: "ab",
        destinationText: " ",
        earliestDesiredAt: "2030-01-01T08:30",
        latestDesiredAt: "2030-01-01T08:15",
        seatsNeeded: "9",
        distanceCategory: "",
      }),
      now,
    );

    expect(result.payload).toBeNull();
    expect(result.submitError).not.toBeNull();
    expect(result.fieldErrors.originText).toBeDefined();
    expect(result.fieldErrors.destinationText).toBeDefined();
    expect(result.fieldErrors.earliestDesiredAt).toBeDefined();
    expect(result.fieldErrors.latestDesiredAt).toBeDefined();
    expect(result.fieldErrors.seatsNeeded).toBeDefined();
    expect(result.fieldErrors.distanceCategory).toBeDefined();
  });

  it("enforces a desired window of 48 hours or less", () => {
    const now = new Date("2030-01-01T09:00:00.000Z");
    const result = buildPostTripRequestPayload(
      validFormValues({
        earliestDesiredAt: "2030-01-01T10:00",
        latestDesiredAt: "2030-01-03T11:00",
      }),
      now,
    );

    expect(result.payload).toBeNull();
    expect(result.fieldErrors.latestDesiredAt).toContain("48 hours");
  });

  it("requires preferred departure to be within the desired window", () => {
    const now = new Date("2030-01-01T09:00:00.000Z");
    const result = buildPostTripRequestPayload(
      validFormValues({ preferredDepartAt: "2030-01-01T13:00" }),
      now,
    );

    expect(result.payload).toBeNull();
    expect(result.fieldErrors.preferredDepartAt).toBeDefined();
  });

  it("blocks submit while a request is already in-flight", () => {
    expect(canSubmitPostTripRequest(true)).toBe(false);
    expect(canSubmitPostTripRequest(false)).toBe(true);
  });
});
