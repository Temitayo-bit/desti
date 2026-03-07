export const ONBOARDING_YEAR_VALUES = [
    "FRESHMAN",
    "SOPHOMORE",
    "JUNIOR",
    "SENIOR",
] as const;

export const ONBOARDING_GENDER_VALUES = [
    "MALE",
    "FEMALE",
    "OTHER",
    "PREFER_NOT_TO_SAY",
] as const;

export type OnboardingYearValue = (typeof ONBOARDING_YEAR_VALUES)[number];
export type OnboardingGenderValue = (typeof ONBOARDING_GENDER_VALUES)[number];

export interface OnboardingFormValues {
    name: string;
    age: string;
    yearAtStetson: "" | OnboardingYearValue;
    gender: "" | OnboardingGenderValue;
}

export interface OnboardingPayload {
    name: string;
    age: number;
    yearAtStetson: OnboardingYearValue;
    gender: OnboardingGenderValue;
}

export type OnboardingFieldKey = "name" | "age" | "yearAtStetson" | "gender";
export type OnboardingFieldErrors = Partial<Record<OnboardingFieldKey, string>>;

export interface BuildOnboardingPayloadResult {
    payload: OnboardingPayload | null;
    fieldErrors: OnboardingFieldErrors;
    submitError: string | null;
}

export interface LocalOnboardingProfile {
    name?: string | null;
    age?: number | null;
    yearAtStetson?: OnboardingYearValue | null;
    gender?: OnboardingGenderValue | null;
}

export const ONBOARDING_YEAR_OPTIONS: ReadonlyArray<{
    value: OnboardingYearValue;
    label: string;
}> = [
    { value: "FRESHMAN", label: "Freshman" },
    { value: "SOPHOMORE", label: "Sophomore" },
    { value: "JUNIOR", label: "Junior" },
    { value: "SENIOR", label: "Senior" },
];

export const ONBOARDING_GENDER_OPTIONS: ReadonlyArray<{
    value: OnboardingGenderValue;
    label: string;
}> = [
    { value: "MALE", label: "Male" },
    { value: "FEMALE", label: "Female" },
    { value: "OTHER", label: "Other" },
    { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

export const EMPTY_ONBOARDING_FORM_VALUES: OnboardingFormValues = {
    name: "",
    age: "",
    yearAtStetson: "",
    gender: "",
};

export function canSubmitOnboarding(isSubmitting: boolean): boolean {
    return !isSubmitting;
}

export function toInitialOnboardingFormValues(
    profile?: LocalOnboardingProfile | null
): OnboardingFormValues {
    if (!profile) {
        return EMPTY_ONBOARDING_FORM_VALUES;
    }

    return {
        name: profile.name ?? "",
        age: profile.age !== null && profile.age !== undefined ? String(profile.age) : "",
        yearAtStetson: profile.yearAtStetson ?? "",
        gender: profile.gender ?? "",
    };
}

function parseAge(ageInput: string): number | null {
    const trimmed = ageInput.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
        return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed)) {
        return null;
    }

    return parsed;
}

export function buildOnboardingPayload(
    formValues: OnboardingFormValues
): BuildOnboardingPayloadResult {
    const fieldErrors: OnboardingFieldErrors = {};
    const name = formValues.name.trim();

    if (name.length < 2 || name.length > 80) {
        fieldErrors.name = "Name must be between 2 and 80 characters.";
    }

    const age = parseAge(formValues.age);
    if (age === null || age < 16 || age > 100) {
        fieldErrors.age = "Age must be an integer between 16 and 100.";
    }

    if (!ONBOARDING_YEAR_VALUES.includes(formValues.yearAtStetson as OnboardingYearValue)) {
        fieldErrors.yearAtStetson = "Select your year at Stetson.";
    }

    if (!ONBOARDING_GENDER_VALUES.includes(formValues.gender as OnboardingGenderValue)) {
        fieldErrors.gender = "Select your gender.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            payload: null,
            fieldErrors,
            submitError: "Please fix the highlighted fields and try again.",
        };
    }

    return {
        payload: {
            name,
            age: age as number,
            yearAtStetson: formValues.yearAtStetson as OnboardingYearValue,
            gender: formValues.gender as OnboardingGenderValue,
        },
        fieldErrors: {},
        submitError: null,
    };
}
