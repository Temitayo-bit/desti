export const ONBOARDING_MIN_AGE = 16;
export const ONBOARDING_MAX_AGE = 100;

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
