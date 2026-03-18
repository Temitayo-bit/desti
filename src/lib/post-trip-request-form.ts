export type DistanceCategoryOption = "SHORT" | "MEDIUM" | "LONG";

export interface PostTripRequestFormValues {
  originText: string;
  destinationText: string;
  earliestDesiredAt: string;
  latestDesiredAt: string;
  preferredDepartAt: string;
  seatsNeeded: string;
  distanceCategory: "" | DistanceCategoryOption;
  pickupInstructions: string;
  dropoffInstructions: string;
}

export interface CreateTripRequestPayload {
  originText: string;
  destinationText: string;
  earliestDesiredAt: string;
  latestDesiredAt: string;
  distanceCategory: DistanceCategoryOption;
  seatsNeeded: number;
  pickupInstructions?: string;
  dropoffInstructions?: string;
  preferredDepartAt?: string;
}

export type PostTripRequestFieldKey =
  | "originText"
  | "destinationText"
  | "earliestDesiredAt"
  | "latestDesiredAt"
  | "preferredDepartAt"
  | "seatsNeeded"
  | "distanceCategory"
  | "pickupInstructions"
  | "dropoffInstructions";

export type PostTripRequestFieldErrors = Partial<Record<PostTripRequestFieldKey, string>>;

export interface BuildPostTripRequestPayloadResult {
  payload: CreateTripRequestPayload | null;
  fieldErrors: PostTripRequestFieldErrors;
  submitError: string | null;
}

const CLOCK_SKEW_GRACE_MS = 10 * 60 * 1000;
const MAX_DESIRED_WINDOW_MS = 48 * 60 * 60 * 1000;

export function canSubmitPostTripRequest(isSubmitting: boolean): boolean {
  return !isSubmitting;
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

export function buildPostTripRequestPayload(
  formValues: PostTripRequestFormValues,
  now: Date = new Date(),
): BuildPostTripRequestPayloadResult {
  const fieldErrors: PostTripRequestFieldErrors = {};
  const originText = formValues.originText.trim();
  const destinationText = formValues.destinationText.trim();
  const pickupInstructions = formValues.pickupInstructions.trim();
  const dropoffInstructions = formValues.dropoffInstructions.trim();

  if (!originText) {
    fieldErrors.originText = "Origin is required.";
  } else if (originText.length < 3 || originText.length > 200) {
    fieldErrors.originText = "Origin must be between 3 and 200 characters.";
  }

  if (!destinationText) {
    fieldErrors.destinationText = "Destination is required.";
  } else if (destinationText.length < 3 || destinationText.length > 200) {
    fieldErrors.destinationText = "Destination must be between 3 and 200 characters.";
  }

  if (!formValues.earliestDesiredAt) {
    fieldErrors.earliestDesiredAt = "Earliest desired departure is required.";
  }

  if (!formValues.latestDesiredAt) {
    fieldErrors.latestDesiredAt = "Latest desired departure is required.";
  }

  if (!formValues.distanceCategory) {
    fieldErrors.distanceCategory = "Distance category is required.";
  }

  const earliestIso = localDateTimeToIso(formValues.earliestDesiredAt);
  const latestIso = localDateTimeToIso(formValues.latestDesiredAt);
  const preferredIso = localDateTimeToIso(formValues.preferredDepartAt);

  if (formValues.earliestDesiredAt && !earliestIso) {
    fieldErrors.earliestDesiredAt = "Earliest desired departure must be a valid date/time.";
  }

  if (formValues.latestDesiredAt && !latestIso) {
    fieldErrors.latestDesiredAt = "Latest desired departure must be a valid date/time.";
  }

  if (formValues.preferredDepartAt && !preferredIso) {
    fieldErrors.preferredDepartAt = "Preferred departure must be a valid date/time.";
  }

  const earliestDate = earliestIso ? new Date(earliestIso) : null;
  const latestDate = latestIso ? new Date(latestIso) : null;
  const preferredDate = preferredIso ? new Date(preferredIso) : null;
  const notPastThreshold = now.getTime() - CLOCK_SKEW_GRACE_MS;

  if (earliestDate && earliestDate.getTime() < notPastThreshold) {
    fieldErrors.earliestDesiredAt = "Earliest desired departure must not be in the past.";
  }

  if (earliestDate && latestDate) {
    if (latestDate.getTime() <= earliestDate.getTime()) {
      fieldErrors.latestDesiredAt = "Latest desired departure must be after earliest desired departure.";
    } else if (latestDate.getTime() - earliestDate.getTime() > MAX_DESIRED_WINDOW_MS) {
      fieldErrors.latestDesiredAt = "Desired window must be 48 hours or less.";
    }
  }

  if (
    preferredDate &&
    earliestDate &&
    latestDate &&
    (preferredDate.getTime() < earliestDate.getTime() ||
      preferredDate.getTime() > latestDate.getTime())
  ) {
    fieldErrors.preferredDepartAt = "Preferred departure must be within the desired window.";
  }

  const seatsNeeded = parseSeatCount(formValues.seatsNeeded);
  if (seatsNeeded === null || seatsNeeded < 1 || seatsNeeded > 8) {
    fieldErrors.seatsNeeded = "Seats needed must be an integer between 1 and 8.";
  }

  if (formValues.pickupInstructions && !pickupInstructions) {
    fieldErrors.pickupInstructions =
      "Pickup instructions must not be empty after trimming.";
  } else if (pickupInstructions.length > 500) {
    fieldErrors.pickupInstructions = "Pickup instructions must be 500 characters or fewer.";
  }

  if (formValues.dropoffInstructions && !dropoffInstructions) {
    fieldErrors.dropoffInstructions =
      "Dropoff instructions must not be empty after trimming.";
  } else if (dropoffInstructions.length > 500) {
    fieldErrors.dropoffInstructions = "Dropoff instructions must be 500 characters or fewer.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      payload: null,
      fieldErrors,
      submitError: "Please fix the highlighted fields and try again.",
    };
  }

  const payload: CreateTripRequestPayload = {
    originText,
    destinationText,
    earliestDesiredAt: earliestIso!,
    latestDesiredAt: latestIso!,
    distanceCategory: formValues.distanceCategory as DistanceCategoryOption,
    seatsNeeded: seatsNeeded!,
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
