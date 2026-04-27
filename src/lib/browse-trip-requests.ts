import type { DistanceCategory } from "@prisma/client";

export type BrowseRidesQuickFilter =
  | "All"
  | "Soon"
  | "Later"
  | "2+ Seats"
  | "Short Trip";

export type BrowseTripRequestsQuickFilter =
  | "All"
  | "Soon"
  | "Solo"
  | "Group"
  | "Offer Sent";

export interface TripRequestSummary {
  id: string;
  riderUserId: string;
  originText: string;
  destinationText: string;
  earliestDesiredAt: string;
  latestDesiredAt: string;
  distanceCategory: DistanceCategory;
  seatsNeeded: number;
  pickupInstructions: string | null;
  dropoffInstructions: string | null;
  preferredDepartAt: string | null;
  status: "ACTIVE";
  createdAt: string;
  updatedAt: string;
  rider?: {
    name: string | null;
    profilePictureUrl: string | null;
  };
}

export interface PendingOfferSummary {
  id: string;
  tripRequestId: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED";
}

export interface BrowseTripRequestItem extends TripRequestSummary {
  hasPendingOffer: boolean;
}

export interface RideBrowseSummary {
  id: string;
  driverUserId: string;
  destinationText: string;
  earliestDepartAt: string;
  distanceCategory: DistanceCategory;
  seatsAvailable: number;
}

export interface OfferFormValues {
  seatsOffered: string;
  priceDollars: string;
  message: string;
}

export type OfferFieldKey = "seatsOffered" | "priceDollars" | "message";
export type OfferFieldErrors = Partial<Record<OfferFieldKey, string>>;

export interface OfferPayload {
  seatsOffered: number;
  priceCents: number;
  message?: string;
}

export interface BuildOfferPayloadResult {
  payload: OfferPayload | null;
  fieldErrors: OfferFieldErrors;
  submitError: string | null;
}

export function dollarsToCents(dollarsInput: string): number | null {
  const parsed = Number(dollarsInput);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function parseSeatCount(seatsInput: string): number | null {
  const parsed = Number.parseInt(seatsInput, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export function buildOfferPayload(
  formValues: OfferFormValues,
): BuildOfferPayloadResult {
  const fieldErrors: OfferFieldErrors = {};

  const seatsOffered = parseSeatCount(formValues.seatsOffered);
  if (seatsOffered === null || seatsOffered < 1 || seatsOffered > 8) {
    fieldErrors.seatsOffered = "Seats offered must be an integer between 1 and 8.";
  }

  const priceCents = dollarsToCents(formValues.priceDollars);
  if (priceCents === null) {
    fieldErrors.priceDollars = "Price must be a number greater than or equal to 0.";
  }

  const message = formValues.message.trim();
  if (message.length > 500) {
    fieldErrors.message = "Message must be 500 characters or fewer.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      payload: null,
      fieldErrors,
      submitError: "Please fix the highlighted fields and try again.",
    };
  }

  const payload: OfferPayload = {
    seatsOffered: seatsOffered!,
    priceCents: priceCents!,
    ...(message ? { message } : {}),
  };

  return {
    payload,
    fieldErrors: {},
    submitError: null,
  };
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function parseStartsAt(startsAtIso: string): Date | null {
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) {
    return null;
  }

  return startsAt;
}

function applyTripRequestQuickFilter(
  tripRequest: TripRequestSummary,
  activeFilter: BrowseTripRequestsQuickFilter,
  hasPendingOffer: boolean,
  now: Date,
): boolean {
  if (activeFilter === "All") return true;

  if (activeFilter === "Offer Sent") {
    return hasPendingOffer;
  }

  if (activeFilter === "Solo") {
    return tripRequest.seatsNeeded === 1;
  }

  if (activeFilter === "Group") {
    return tripRequest.seatsNeeded >= 2;
  }

  const startsAt = parseStartsAt(tripRequest.earliestDesiredAt);
  if (!startsAt) {
    return false;
  }

  const threshold = addHours(now, 24);
  if (activeFilter === "Soon") {
    return startsAt >= now && startsAt <= threshold;
  }

  return false;
}

function applyRideQuickFilter(
  ride: RideBrowseSummary,
  activeFilter: BrowseRidesQuickFilter,
  now: Date,
): boolean {
  if (activeFilter === "All") return true;

  if (activeFilter === "2+ Seats") {
    return ride.seatsAvailable >= 2;
  }

  if (activeFilter === "Short Trip") {
    return ride.distanceCategory === "SHORT";
  }

  const startsAt = parseStartsAt(ride.earliestDepartAt);
  if (!startsAt) {
    return false;
  }

  const threshold = addHours(now, 24);
  if (activeFilter === "Soon") {
    return startsAt >= now && startsAt <= threshold;
  }

  return startsAt > threshold;
}

export function getPendingOfferTripRequestIds(
  offers: PendingOfferSummary[],
): Set<string> {
  return new Set(
    offers
      .filter((offer) => offer.status === "PENDING")
      .map((offer) => offer.tripRequestId),
  );
}

interface FilterTripRequestOptions {
  tripRequests: TripRequestSummary[];
  currentUserId: string | null;
  searchQuery: string;
  activeFilter: BrowseTripRequestsQuickFilter;
  pendingOfferTripRequestIds: Set<string>;
  now?: Date;
}

export function filterTripRequestsForBrowse({
  tripRequests,
  currentUserId,
  searchQuery,
  activeFilter,
  pendingOfferTripRequestIds,
  now = new Date(),
}: FilterTripRequestOptions): BrowseTripRequestItem[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return tripRequests
    .filter((tripRequest) => {
      if (currentUserId && tripRequest.riderUserId === currentUserId) {
        return false;
      }

      const matchesSearch =
        normalizedSearch.length === 0 ||
        tripRequest.destinationText.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      return applyTripRequestQuickFilter(
        tripRequest,
        activeFilter,
        pendingOfferTripRequestIds.has(tripRequest.id),
        now,
      );
    })
    .map((tripRequest) => ({
      ...tripRequest,
      hasPendingOffer: pendingOfferTripRequestIds.has(tripRequest.id),
    }));
}

interface FilterRideOptions<T extends RideBrowseSummary> {
  rides: T[];
  currentUserId: string | null;
  searchQuery: string;
  activeFilter: BrowseRidesQuickFilter;
  now?: Date;
}

export function filterRidesForBrowse<T extends RideBrowseSummary>({
  rides,
  currentUserId,
  searchQuery,
  activeFilter,
  now = new Date(),
}: FilterRideOptions<T>): T[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return rides.filter((ride) => {
    if (currentUserId && ride.driverUserId === currentUserId) {
      return false;
    }

    const matchesSearch =
      normalizedSearch.length === 0 ||
      ride.destinationText.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) {
      return false;
    }

    return applyRideQuickFilter(ride, activeFilter, now);
  });
}
