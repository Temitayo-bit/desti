import { distanceCategoryFromLocationFields } from "@/lib/distance-category";
import type { DistanceCategoryOption } from "@/lib/distance-category";
import {
  hasValidLocationFieldSelection,
  type LocationField,
} from "@/lib/location-field";

export type { DistanceCategoryOption } from "@/lib/distance-category";
export type MusicPreferenceOption = "MUSIC_ALLOWED" | "NO_MUSIC";
export type VehicleTypeOption =
  | "SEDAN"
  | "SUV"
  | "TRUCK"
  | "VAN"
  | "COUPE"
  | "OTHER";

export interface PostRideFormValues {
  origin: LocationField;
  destination: LocationField;
  earliestDepartAt: string;
  latestDepartAt: string;
  preferredDepartAt: string;
  seatsTotal: string;
  priceDollars: string;
  musicPreference: "" | MusicPreferenceOption;
  hasAc: "" | "true" | "false";
  hasTrunkSpace: "" | "true" | "false";
  vehicleType: "" | VehicleTypeOption;
  pickupInstructions: string;
  dropoffInstructions: string;
}

export interface CreateRidePayload {
  originText: string;
  destinationText: string;
  earliestDepartAt: string;
  latestDepartAt: string;
  distanceCategory: DistanceCategoryOption;
  musicPreference?: MusicPreferenceOption;
  hasAc?: boolean;
  hasTrunkSpace?: boolean;
  vehicleType?: VehicleTypeOption;
  priceCents: number;
  seatsTotal: number;
  pickupInstructions?: string;
  dropoffInstructions?: string;
  preferredDepartAt?: string;
}

export type PostRideFieldKey =
  | "originText"
  | "destinationText"
  | "earliestDepartAt"
  | "latestDepartAt"
  | "preferredDepartAt"
  | "seatsTotal"
  | "priceDollars"
  | "distanceCategory"
  | "musicPreference"
  | "hasAc"
  | "hasTrunkSpace"
  | "vehicleType"
  | "pickupInstructions"
  | "dropoffInstructions";

export type PostRideFieldErrors = Partial<Record<PostRideFieldKey, string>>;

export interface BuildPostRidePayloadResult {
  payload: CreateRidePayload | null;
  fieldErrors: PostRideFieldErrors;
  submitError: string | null;
}

const CLOCK_SKEW_GRACE_MS = 10 * 60 * 1000;

export function canSubmitPostRide(isSubmitting: boolean): boolean {
  return !isSubmitting;
}

export function dollarsToCents(dollarsInput: string): number | null {
  const parsed = Number(dollarsInput);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function localDateTimeToIso(localDateTime: string): string | null {
  if (!localDateTime) {
    return null;
  }

  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseSeatCount(seatsInput: string): number | null {
  const parsed = Number.parseInt(seatsInput, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export function buildPostRidePayload(
  formValues: PostRideFormValues,
  now: Date = new Date(),
): BuildPostRidePayloadResult {
  const fieldErrors: PostRideFieldErrors = {};
  const originText = formValues.origin.inputText.trim();
  const destinationText = formValues.destination.inputText.trim();
  const pickupInstructions = formValues.pickupInstructions.trim();
  const dropoffInstructions = formValues.dropoffInstructions.trim();

  if (!originText) {
    fieldErrors.originText = "Origin is required.";
  } else if (!hasValidLocationFieldSelection(formValues.origin)) {
    fieldErrors.originText = "Please select a valid location from suggestions.";
  }
  if (!destinationText) {
    fieldErrors.destinationText = "Destination is required.";
  } else if (!hasValidLocationFieldSelection(formValues.destination)) {
    fieldErrors.destinationText =
      "Please select a valid location from suggestions.";
  }
  if (!formValues.earliestDepartAt) {
    fieldErrors.earliestDepartAt = "Earliest departure is required.";
  }
  if (!formValues.latestDepartAt) {
    fieldErrors.latestDepartAt = "Latest departure is required.";
  }

  const computedDistanceCategory = distanceCategoryFromLocationFields(
    formValues.origin,
    formValues.destination,
  );
  if (!computedDistanceCategory) {
    fieldErrors.distanceCategory =
      "Select origin and destination first; distance category is calculated automatically.";
  }

  const earliestIso = localDateTimeToIso(formValues.earliestDepartAt);
  const latestIso = localDateTimeToIso(formValues.latestDepartAt);
  const preferredIso = localDateTimeToIso(formValues.preferredDepartAt);

  if (formValues.earliestDepartAt && !earliestIso) {
    fieldErrors.earliestDepartAt = "Earliest departure must be a valid date/time.";
  }
  if (formValues.latestDepartAt && !latestIso) {
    fieldErrors.latestDepartAt = "Latest departure must be a valid date/time.";
  }
  if (formValues.preferredDepartAt && !preferredIso) {
    fieldErrors.preferredDepartAt = "Preferred departure must be a valid date/time.";
  }

  const earliestDate = earliestIso ? new Date(earliestIso) : null;
  const latestDate = latestIso ? new Date(latestIso) : null;
  const preferredDate = preferredIso ? new Date(preferredIso) : null;
  const notPastThreshold = now.getTime() - CLOCK_SKEW_GRACE_MS;

  if (earliestDate && earliestDate.getTime() < notPastThreshold) {
    fieldErrors.earliestDepartAt = "Earliest departure must not be in the past.";
  }
  if (earliestDate && latestDate && latestDate.getTime() <= earliestDate.getTime()) {
    fieldErrors.latestDepartAt = "Latest departure must be after earliest departure.";
  }
  if (
    preferredDate &&
    earliestDate &&
    latestDate &&
    (preferredDate.getTime() < earliestDate.getTime() ||
      preferredDate.getTime() > latestDate.getTime())
  ) {
    fieldErrors.preferredDepartAt =
      "Preferred departure must be within the departure window.";
  }

  const seatsTotal = parseSeatCount(formValues.seatsTotal);
  if (seatsTotal === null || seatsTotal < 1 || seatsTotal > 8) {
    fieldErrors.seatsTotal = "Seats must be an integer between 1 and 8.";
  }

  const priceCents = dollarsToCents(formValues.priceDollars);
  if (priceCents === null) {
    fieldErrors.priceDollars = "Price must be a number greater than or equal to 0.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      payload: null,
      fieldErrors,
      submitError: "Please fix the highlighted fields and try again.",
    };
  }

  const payload: CreateRidePayload = {
    originText,
    destinationText,
    earliestDepartAt: earliestIso!,
    latestDepartAt: latestIso!,
    distanceCategory: computedDistanceCategory!,
    priceCents: priceCents!,
    seatsTotal: seatsTotal!,
    ...(formValues.musicPreference
      ? { musicPreference: formValues.musicPreference }
      : {}),
    ...(formValues.hasAc === "true"
      ? { hasAc: true }
      : formValues.hasAc === "false"
        ? { hasAc: false }
        : {}),
    ...(formValues.hasTrunkSpace === "true"
      ? { hasTrunkSpace: true }
      : formValues.hasTrunkSpace === "false"
        ? { hasTrunkSpace: false }
        : {}),
    ...(formValues.vehicleType ? { vehicleType: formValues.vehicleType } : {}),
    ...(pickupInstructions ? { pickupInstructions } : {}),
    ...(dropoffInstructions ? { dropoffInstructions } : {}),
    ...(preferredIso ? { preferredDepartAt: preferredIso } : {}),
  };

  return {
    payload,
    fieldErrors: {},
    submitError: null,
  };
}
