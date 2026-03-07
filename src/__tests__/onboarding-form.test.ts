import { describe, expect, it } from "vitest";
import {
    buildOnboardingPayload,
    canSubmitOnboarding,
    toInitialOnboardingFormValues,
    type OnboardingFormValues,
} from "@/lib/onboarding-form";

function validFormValues(
    overrides: Partial<OnboardingFormValues> = {}
): OnboardingFormValues {
    return {
        name: "Taylor Student",
        age: "21",
        yearAtStetson: "JUNIOR",
        gender: "PREFER_NOT_TO_SAY",
        ...overrides,
    };
}

describe("onboarding form helpers", () => {
    it("builds a valid payload from form values", () => {
        const result = buildOnboardingPayload(validFormValues());

        expect(result.submitError).toBeNull();
        expect(result.fieldErrors).toEqual({});
        expect(result.payload).toEqual({
            name: "Taylor Student",
            age: 21,
            yearAtStetson: "JUNIOR",
            gender: "PREFER_NOT_TO_SAY",
        });
    });

    it("returns field errors for invalid values", () => {
        const result = buildOnboardingPayload(
            validFormValues({
                name: " ",
                age: "12",
                yearAtStetson: "",
                gender: "",
            })
        );

        expect(result.payload).toBeNull();
        expect(result.submitError).not.toBeNull();
        expect(result.fieldErrors.name).toBeDefined();
        expect(result.fieldErrors.age).toBeDefined();
        expect(result.fieldErrors.yearAtStetson).toBeDefined();
        expect(result.fieldErrors.gender).toBeDefined();
    });

    it("rejects malformed age inputs instead of truncating them", () => {
        const decimalAge = buildOnboardingPayload(
            validFormValues({ age: "19.5" })
        );
        const suffixedAge = buildOnboardingPayload(
            validFormValues({ age: "18abc" })
        );

        expect(decimalAge.payload).toBeNull();
        expect(decimalAge.fieldErrors.age).toBeDefined();
        expect(suffixedAge.payload).toBeNull();
        expect(suffixedAge.fieldErrors.age).toBeDefined();
    });

    it("maps nullable local profile data into form defaults", () => {
        expect(
            toInitialOnboardingFormValues({
                name: " Avery Rider ",
                age: 19,
                yearAtStetson: "FRESHMAN",
                gender: "OTHER",
            })
        ).toEqual({
            name: " Avery Rider ",
            age: "19",
            yearAtStetson: "FRESHMAN",
            gender: "OTHER",
        });

        expect(toInitialOnboardingFormValues(null)).toEqual({
            name: "",
            age: "",
            yearAtStetson: "",
            gender: "",
        });
    });

    it("blocks submit while a request is already in-flight", () => {
        expect(canSubmitOnboarding(true)).toBe(false);
        expect(canSubmitOnboarding(false)).toBe(true);
    });
});
