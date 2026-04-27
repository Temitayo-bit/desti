"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { DistanceCategory } from "@prisma/client";
import { MapPin, MessageCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { TripRequestsViewToggle } from "../_components/TripRequestsViewToggle";
import {
  filterMyTripRequests,
  getPendingOffersForTripRequest,
  groupPendingOffersByTripRequestId,
  hasPendingOffersForTripRequest,
  type PendingIncomingOffer,
  type MyTripRequestsQuickFilter,
} from "@/lib/my-trip-requests";
import { formatRelativeTime } from "@/lib/dashboard";
import { openBookingConversationThread } from "@/lib/booking-conversation";
import {
  type BrowseTimeWindow,
  buildActiveDistanceSet,
  distanceCategoryLabel,
  formatDistanceMilesLabel,
  matchesLocalDepartDate,
  rideDepartureTimeMatchesWindow,
} from "@/lib/browse-ride-filters";

type TripRequestStatus = "ACTIVE" | "CLOSED";

interface TripRequestSummary {
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
  status: TripRequestStatus;
  createdAt: string;
  updatedAt: string;
  confirmedBookings: ConfirmedBookingSummary[];
}

interface ConfirmedBookingSummary {
  id: string;
  riderUserId: string;
  driverUserId: string | null;
  seatsBooked: number;
  startsAt: string;
  endsAt: string;
}

interface EditTripRequestFormData {
  originText?: string;
  destinationText?: string;
  earliestDesiredAt?: string;
  latestDesiredAt?: string;
  preferredDepartAt?: string;
  distanceCategory?: DistanceCategory;
  seatsNeeded?: number;
  pickupInstructions?: string;
  dropoffInstructions?: string;
}

interface TripRequestApiValidationDetail {
  field?: string;
  message?: string;
}

interface OffersMineApiResponse {
  items?: PendingIncomingOffer[];
  nextCursor?: string | null;
}

type OfferActionType = "accept" | "cancel";
interface PendingOfferActionState {
  action: OfferActionType;
  idempotencyKey: string;
}

type OfferActionPendingMap = Partial<Record<string, PendingOfferActionState>>;
type ActionNotice =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

type EditFieldKey =
  | "originText"
  | "destinationText"
  | "earliestDesiredAt"
  | "latestDesiredAt"
  | "preferredDepartAt"
  | "distanceCategory"
  | "seatsNeeded"
  | "pickupInstructions"
  | "dropoffInstructions";

type EditFieldErrors = Partial<Record<EditFieldKey, string>>;

const editFieldNameMap: Record<string, EditFieldKey> = {
  originText: "originText",
  destinationText: "destinationText",
  earliestDesiredAt: "earliestDesiredAt",
  latestDesiredAt: "latestDesiredAt",
  preferredDepartAt: "preferredDepartAt",
  distanceCategory: "distanceCategory",
  seatsNeeded: "seatsNeeded",
  pickupInstructions: "pickupInstructions",
  dropoffInstructions: "dropoffInstructions",
};

const MapPinIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-zinc-500"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const ClockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-zinc-500"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const UsersIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-zinc-500"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-zinc-400 transition-colors group-hover:text-emerald-600"
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

async function parseEditErrorResponse(response: Response): Promise<{
  fieldErrors: EditFieldErrors;
  message: string;
}> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const fieldErrors: EditFieldErrors = {};
  let message = "Unable to update trip request right now. Please try again.";

  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      message = maybeMessage;
    }

    const details = (payload as { details?: unknown }).details;
    if (Array.isArray(details)) {
      details.forEach((detail) => {
        const typedDetail = detail as TripRequestApiValidationDetail;
        if (
          typeof typedDetail.field === "string" &&
          typeof typedDetail.message === "string"
        ) {
          const mappedField = editFieldNameMap[typedDetail.field];
          if (mappedField && !fieldErrors[mappedField]) {
            fieldErrors[mappedField] = typedDetail.message;
          }
        }
      });
    }
  }

  return { fieldErrors, message };
}

async function parseOfferActionError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return (
    payload?.message ??
    payload?.error ??
    "Unable to complete offer action. Please try again."
  );
}

function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

async function fetchMyTripRequests(
  signal?: AbortSignal,
): Promise<TripRequestSummary[]> {
  const response = await fetch("/api/trip-requests/mine", { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch your trip requests");
  }

  const payload = (await response.json()) as { items?: TripRequestSummary[] };
  return payload.items ?? [];
}

async function fetchPendingIncomingOffers(
  signal?: AbortSignal,
): Promise<PendingIncomingOffer[]> {
  const MAX_PAGES = 100;
  const allOffers: PendingIncomingOffer[] = [];
  let nextCursor: string | null = null;
  let pagesFetched = 0;
  let lastCursor: string | null = null;

  do {
    if (pagesFetched >= MAX_PAGES) {
      throw new Error("Too many pages while fetching incoming offers.");
    }

    const search = new URLSearchParams({
      role: "rider",
      status: "PENDING",
      limit: "50",
    });
    if (nextCursor) {
      search.set("cursor", nextCursor);
    }

    const response = await fetch(`/api/offers/mine?${search.toString()}`, {
      signal,
    });

    if (!response.ok) {
      throw new Error("Failed to fetch incoming offers");
    }

    const payload = (await response.json()) as OffersMineApiResponse;
    allOffers.push(...(payload.items ?? []));
    pagesFetched += 1;
    const newCursor = payload.nextCursor ?? null;
    if (newCursor && newCursor === lastCursor) {
      throw new Error("Detected repeating pagination cursor for incoming offers.");
    }
    lastCursor = newCursor;
    nextCursor = newCursor;
  } while (nextCursor);

  return allOffers;
}

export type MyTripRequestsHubFilters = {
  hubSearchQuery?: string;
  departDate?: string;
  distShort?: boolean;
  distMedium?: boolean;
  distLong?: boolean;
  timeWindow?: BrowseTimeWindow | null;
};

export type MyTripRequestsHubControls = {
  sortBy?: "earliest" | "seats";
  setSortBy?: (v: "earliest" | "seats") => void;
  onClearHubFilters?: () => void;
};

interface MyTripRequestsViewProps {
  /** When true, hides the page title, create CTA, and tab toggle (parent hub provides them). */
  hubLayout?: boolean;
  /** Shared hub filters + sort from parent (rides-style browse hub). */
  hubMode?: boolean;
  hubFilters?: MyTripRequestsHubFilters;
  hubControls?: MyTripRequestsHubControls;
}

export function MyTripRequestsView({
  hubLayout = false,
  hubMode = false,
  hubFilters,
  hubControls,
}: MyTripRequestsViewProps) {
  const hubSearchQuery = hubFilters?.hubSearchQuery ?? "";
  const departDate = hubFilters?.departDate ?? "";
  const distShort = hubFilters?.distShort ?? true;
  const distMedium = hubFilters?.distMedium ?? true;
  const distLong = hubFilters?.distLong ?? true;
  const timeWindow = hubFilters?.timeWindow ?? null;
  const sortBy = hubControls?.sortBy ?? "earliest";
  const setSortBy = hubControls?.setSortBy;
  const onClearHubFilters = hubControls?.onClearHubFilters;

  const router = useRouter();
  const [tripRequests, setTripRequests] = useState<TripRequestSummary[]>([]);
  const [pendingOffers, setPendingOffers] = useState<PendingIncomingOffer[]>([]);
  const [selectedTripRequest, setSelectedTripRequest] =
    useState<TripRequestSummary | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<EditTripRequestFormData>({});
  const [editFieldErrors, setEditFieldErrors] = useState<EditFieldErrors>({});
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<MyTripRequestsQuickFilter>("All");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [refreshingData, setRefreshingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingOfferActions, setPendingOfferActions] =
    useState<OfferActionPendingMap>({});
  const [openingConversationBookingId, setOpeningConversationBookingId] =
    useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [successState, setSuccessState] = useState<"edit" | null>(null);
  const [matchCountByRequestId, setMatchCountByRequestId] = useState<
    Record<string, number>
  >({});
  const closeTripRequestDialogButtonRef = useRef<HTMLButtonElement | null>(null);
  const tripRequestDialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const loadPageData = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      const { signal, silent = false } = options ?? {};
      setLoadError(null);

      if (silent) {
        setRefreshingData(true);
      } else {
        setLoading(true);
      }

      try {
        const [nextTripRequests, nextPendingOffers] = await Promise.all([
          fetchMyTripRequests(signal),
          fetchPendingIncomingOffers(signal),
        ]);

        if (signal?.aborted) return;

        setTripRequests(
          nextTripRequests.map((tripRequest) => ({
            ...tripRequest,
            confirmedBookings: tripRequest.confirmedBookings ?? [],
          })),
        );
        setPendingOffers(nextPendingOffers);
        setSelectedTripRequest((prev) => {
          if (!prev) return prev;
          return (
            nextTripRequests.find((tripRequest) => tripRequest.id === prev.id) ??
            null
          );
        });
        setLoadError(null);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setLoadError(
          error instanceof Error
            ? error
            : new Error("Failed to load trip request data."),
        );
        console.error("Error loading my trip requests data:", error);
      } finally {
        if (!signal?.aborted) {
          if (silent) {
            setRefreshingData(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPageData({ signal: controller.signal });
    return () => controller.abort();
  }, [loadPageData]);

  useEffect(() => {
    if (tripRequests.length === 0) {
      setMatchCountByRequestId({});
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const results = await Promise.all(
          tripRequests.map(async (tr) => {
            const res = await fetch(`/api/trip-requests/${tr.id}/matches`, {
              signal: ac.signal,
            });
            if (!res.ok) return [tr.id, 0] as const;
            const data = (await res.json()) as { items?: unknown[] };
            return [tr.id, Array.isArray(data.items) ? data.items.length : 0] as const;
          }),
        );
        if (!ac.signal.aborted) {
          setMatchCountByRequestId(Object.fromEntries(results));
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        console.error("Failed to load match counts:", e);
      }
    })();
    return () => ac.abort();
  }, [tripRequests]);

  useEffect(() => {
    if (!actionNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionNotice(null);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  const filteredTripRequests = useMemo(() => {
    const base = filterMyTripRequests({
      tripRequests,
      searchQuery: hubMode ? hubSearchQuery : searchQuery,
      activeFilter: hubMode ? "All" : activeFilter,
      pendingOfferTripRequestIds: new Set(
        pendingOffers.map((offer) => offer.tripRequestId),
      ),
    });
    if (!hubMode) {
      return base;
    }
    let list = base.filter((tr) =>
      matchesLocalDepartDate(tr.earliestDesiredAt, departDate),
    );
    const dist = buildActiveDistanceSet({
      short: distShort,
      medium: distMedium,
      long: distLong,
    });
    if (dist !== "all") {
      list = list.filter((tr) => dist.has(tr.distanceCategory));
    }
    list = list.filter((tr) =>
      rideDepartureTimeMatchesWindow(tr.earliestDesiredAt, timeWindow),
    );
    if (sortBy === "seats") {
      list = [...list].sort((a, b) => b.seatsNeeded - a.seatsNeeded);
    } else {
      list = [...list].sort(
        (a, b) =>
          new Date(a.earliestDesiredAt).getTime() -
          new Date(b.earliestDesiredAt).getTime(),
      );
    }
    return list;
  }, [
    tripRequests,
    hubMode,
    hubSearchQuery,
    searchQuery,
    activeFilter,
    pendingOffers,
    departDate,
    distShort,
    distMedium,
    distLong,
    timeWindow,
    sortBy,
  ]);
  const pendingOffersByTripRequestId = useMemo(
    () => groupPendingOffersByTripRequestId(pendingOffers),
    [pendingOffers],
  );
  const selectedTripRequestOffers = selectedTripRequest
    ? getPendingOffersForTripRequest(
        pendingOffersByTripRequestId,
        selectedTripRequest.id,
      )
    : [];
  const quickFilters = ["All", "Active", "Offers Received", "Booked", "Closed"] as const;

  const formatTimeRange = (earliest: string, latest: string) => {
    try {
      const d1 = new Date(earliest);
      const d2 = new Date(latest);

      if (d1.toDateString() === d2.toDateString()) {
        if (d1.toDateString() === new Date().toDateString()) {
          return `Today ${format(d1, "h:mm a")} - ${format(d2, "h:mm a")}`;
        }
        return `${format(d1, "MMM d, h:mm a")} - ${format(d2, "h:mm a")}`;
      }
      return `${format(d1, "MMM d, h:mm a")} - ${format(d2, "MMM d, h:mm a")}`;
    } catch {
      return "Time TBD";
    }
  };

  const toTitleCase = (value: string) => {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  const closeTripRequestModal = useCallback(() => {
    setSelectedTripRequest(null);
    setSuccessState(null);
    setIsEditing(false);
    setEditFormData({});
    setEditFieldErrors({});
    setEditSubmitError(null);
    setActionNotice(null);

    const previouslyFocusedElement = lastFocusedElementRef.current;
    if (previouslyFocusedElement) {
      window.requestAnimationFrame(() => {
        previouslyFocusedElement.focus();
      });
    }
    lastFocusedElementRef.current = null;
  }, []);

  useEffect(() => {
    if (!selectedTripRequest) return;

    function getFocusableElements(): HTMLElement[] {
      const dialog = tripRequestDialogRef.current;
      if (!dialog) return [];

      return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    window.requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        tripRequestDialogRef.current?.focus();
      }
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTripRequestModal();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = tripRequestDialogRef.current;
      if (!dialog) {
        return;
      }

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const isInsideDialog =
        activeElement instanceof HTMLElement && dialog.contains(activeElement);

      if (event.shiftKey) {
        if (!isInsideDialog || activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (!isInsideDialog || activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedTripRequest, closeTripRequestModal]);

  const beginEditingTripRequest = (tripRequest: TripRequestSummary) => {
    if (tripRequest.status !== "ACTIVE") return;

    setSelectedTripRequest(tripRequest);
    setEditFormData({
      originText: tripRequest.originText,
      destinationText: tripRequest.destinationText,
      earliestDesiredAt: format(
        new Date(tripRequest.earliestDesiredAt),
        "yyyy-MM-dd'T'HH:mm",
      ),
      latestDesiredAt: format(
        new Date(tripRequest.latestDesiredAt),
        "yyyy-MM-dd'T'HH:mm",
      ),
      preferredDepartAt: tripRequest.preferredDepartAt
        ? format(new Date(tripRequest.preferredDepartAt), "yyyy-MM-dd'T'HH:mm")
        : "",
      distanceCategory: tripRequest.distanceCategory,
      seatsNeeded: tripRequest.seatsNeeded,
      pickupInstructions: tripRequest.pickupInstructions ?? "",
      dropoffInstructions: tripRequest.dropoffInstructions ?? "",
    });
    setEditFieldErrors({});
    setEditSubmitError(null);
    setActionNotice(null);
    setIsEditing(true);
  };

  const startEditing = () => {
    if (!selectedTripRequest || selectedTripRequest.status !== "ACTIVE") return;
    beginEditingTripRequest(selectedTripRequest);
  };

  const handleEditSubmit = async () => {
    if (!selectedTripRequest || selectedTripRequest.status !== "ACTIVE") return;

    setEditFieldErrors({});
    setEditSubmitError(null);

    const originText = editFormData.originText?.trim() ?? "";
    const destinationText = editFormData.destinationText?.trim() ?? "";
    const earliestDesiredAt = editFormData.earliestDesiredAt ?? "";
    const latestDesiredAt = editFormData.latestDesiredAt ?? "";
    const preferredDepartAt = editFormData.preferredDepartAt ?? "";
    const pickupInstructions = editFormData.pickupInstructions?.trim() ?? "";
    const dropoffInstructions = editFormData.dropoffInstructions?.trim() ?? "";

    const seatsNeeded =
      typeof editFormData.seatsNeeded === "number"
        ? editFormData.seatsNeeded
        : Number.NaN;

    if (
      !originText ||
      !destinationText ||
      !earliestDesiredAt ||
      !latestDesiredAt ||
      !editFormData.distanceCategory ||
      !Number.isInteger(seatsNeeded)
    ) {
      setEditSubmitError("Please fill all required fields before saving.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/trip-requests/${selectedTripRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originText,
          destinationText,
          earliestDesiredAt: new Date(earliestDesiredAt).toISOString(),
          latestDesiredAt: new Date(latestDesiredAt).toISOString(),
          preferredDepartAt: preferredDepartAt
            ? new Date(preferredDepartAt).toISOString()
            : null,
          distanceCategory: editFormData.distanceCategory,
          seatsNeeded,
          pickupInstructions: pickupInstructions ? pickupInstructions : null,
          dropoffInstructions: dropoffInstructions ? dropoffInstructions : null,
        }),
      });

      if (!response.ok) {
        const parsedError = await parseEditErrorResponse(response);
        setEditFieldErrors(parsedError.fieldErrors);
        setEditSubmitError(parsedError.message);
        return;
      }

      const updatedTripRequest = (await response.json()) as Omit<
        TripRequestSummary,
        "confirmedBookings"
      >;
      const mergedUpdatedTripRequest: TripRequestSummary = {
        ...updatedTripRequest,
        confirmedBookings: selectedTripRequest.confirmedBookings,
      };
      setSelectedTripRequest(mergedUpdatedTripRequest);
      setTripRequests((prev) =>
        prev.map((tripRequest) =>
          tripRequest.id === mergedUpdatedTripRequest.id
            ? mergedUpdatedTripRequest
            : tripRequest,
        ),
      );
      setIsEditing(false);
      setSuccessState("edit");
      window.setTimeout(() => {
        closeTripRequestModal();
      }, 2500);
    } catch (error) {
      setEditSubmitError(
        `Error updating trip request: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelTripRequest = async (tripRequest: TripRequestSummary) => {
    if (tripRequest.status !== "ACTIVE") return;
    if (!confirm("Are you sure you want to cancel this trip request?")) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/trip-requests/${tripRequest.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTripRequests((prev) => prev.filter((item) => item.id !== tripRequest.id));
        closeTripRequestModal();
        return;
      }

      if (response.status === 501) {
        const payload = await response.json().catch(() => null);
        alert(payload?.message ?? "Trip request cancellation is not implemented yet.");
        return;
      }

      const payload = await response.json().catch(() => null);
      alert(
        payload?.message ?? payload?.error ?? "Failed to cancel trip request.",
      );
    } catch {
      alert("An error occurred while attempting to cancel the trip request.");
    } finally {
      setSubmitting(false);
    }
  };

  const runOfferAction = async (offerId: string, action: OfferActionType) => {
    setActionNotice(null);
    const existingPendingState = pendingOfferActions[offerId];
    const idempotencyKey =
      existingPendingState?.idempotencyKey ?? createIdempotencyKey();
    setPendingOfferActions((prev) => ({
      ...prev,
      [offerId]: { action, idempotencyKey },
    }));

    const endpoint =
      action === "accept"
        ? `/api/offers/${offerId}/accept`
        : `/api/offers/${offerId}/cancel`;
    const successMessage =
      action === "accept" ? "Offer accepted." : "Offer declined.";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      });
      if (!response.ok) {
        throw new Error(await parseOfferActionError(response));
      }

      setActionNotice({ type: "success", text: successMessage });
      await loadPageData({ silent: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to complete offer action. Please try again.";
      setActionNotice({ type: "error", text: message });
    } finally {
      setPendingOfferActions((prev) => {
        const next = { ...prev };
        delete next[offerId];
        return next;
      });
    }
  };

  const openBookingMessages = async (bookingId: string) => {
    setActionNotice(null);
    setOpeningConversationBookingId(bookingId);

    const result = await openBookingConversationThread(bookingId);
    if (!result.ok) {
      setActionNotice({ type: "error", text: result.message });
      setOpeningConversationBookingId(null);
      return;
    }

    router.push(result.href);
  };

  return (
    <>
      {!hubLayout ? (
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-start md:mb-8">
            <div>
              <h1 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl">
                My Trip Requests
              </h1>
              <p className="text-zinc-500">Manage trip requests you have posted</p>
            </div>
            <Link
              href="/post-trip-request"
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-800 px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-emerald-900"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Post Trip Request
            </Link>
          </div>

          <TripRequestsViewToggle activeView="my" />

          <div className="relative mt-6">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3.5 pl-11 pr-4 font-medium placeholder:font-normal transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="mt-5 -mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2 pb-1">
              {quickFilters.map((filterOpt) => (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => setActiveFilter(filterOpt)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                    activeFilter === filterOpt
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {filterOpt}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : !hubMode ? (
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm md:p-8">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3.5 pl-11 pr-4 font-medium placeholder:font-normal transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="mt-5 -mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2 pb-1">
              {quickFilters.map((filterOpt) => (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => setActiveFilter(filterOpt)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                    activeFilter === filterOpt
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {filterOpt}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`w-full min-w-0 ${hubMode ? "" : "mx-auto max-w-5xl"}`}
      >
        <div
          className={
            hubMode
              ? "w-full min-w-0"
              : "w-full min-w-0 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm md:p-6 lg:p-8"
          }
        >
          {hubMode ? (
            <div className="mb-1 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-bold text-zinc-900">
                My Trip Requests (
                {loading && tripRequests.length === 0
                  ? "…"
                  : filteredTripRequests.length}
                )
              </h2>
              {setSortBy ? (
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  <span className="text-sm text-zinc-500">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as "earliest" | "seats")
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800"
                  >
                    <option value="earliest">Earliest desired departure</option>
                    <option value="seats">Seats needed (high to low)</option>
                  </select>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mb-4 text-center text-sm font-medium text-zinc-500 md:mb-6">
              {filteredTripRequests.length}{" "}
              {filteredTripRequests.length === 1
                ? "trip request"
                : "trip requests"}{" "}
              posted
            </p>
          )}
          {actionNotice ? (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                actionNotice.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              {actionNotice.text}
            </div>
          ) : null}
          {refreshingData ? (
            <p className="mb-4 text-sm text-zinc-500">Refreshing trip request data...</p>
          ) : null}

          {loading ? (
            <div className="flex flex-col gap-4">
              {(hubMode ? [1, 2, 3, 4] : [1, 2, 3]).map((index) => (
                <div
                  key={index}
                  className={`${
                    hubMode ? "h-36" : "h-32"
                  } animate-pulse rounded-2xl bg-zinc-100`}
                />
              ))}
            </div>
          ) : loadError ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-500"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-1">
                Unable to load trip requests
              </h3>
              <p className="text-zinc-500 max-w-sm mx-auto">
                {loadError.message || "Something went wrong while loading your data."}
              </p>
              <button
                type="button"
                onClick={() => void loadPageData()}
                className="mt-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white px-5 py-2.5 font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredTripRequests.length === 0 ? (
            hubMode ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 py-16 text-center">
                <h3 className="text-lg font-bold text-zinc-900">
                  No trip requests found
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                  We couldn&apos;t find any of your trip requests matching your search and
                  filters. Try a different date or clear optional filters.
                </p>
                {onClearHubFilters ? (
                  <button
                    type="button"
                    onClick={onClearHubFilters}
                    className="mt-4 text-sm font-semibold text-[#006837] hover:underline"
                  >
                    Clear search &amp; filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="px-4 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-400"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-bold text-zinc-900">
                  No trip requests found
                </h3>
                <p className="mx-auto max-w-sm text-zinc-500">
                  We couldn&apos;t find any of your trip requests matching your current
                  search and filter criteria.
                </p>
                {activeFilter !== "All" ? (
                  <button
                    type="button"
                    onClick={() => setActiveFilter("All")}
                    className="mt-4 font-medium text-emerald-700 hover:underline"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4">
              {filteredTripRequests.map((tripRequest) => {
                const cardOffers = getPendingOffersForTripRequest(
                  pendingOffersByTripRequestId,
                  tripRequest.id,
                );
                const matchCount = matchCountByRequestId[tripRequest.id];
                const showOfferBadge = hasPendingOffersForTripRequest(
                  pendingOffersByTripRequestId,
                  tripRequest.id,
                );

                if (hubMode) {
                  return (
                    <article
                      key={tripRequest.id}
                      className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white pl-1 text-left shadow-sm transition-all hover:border-[#006837]/50 hover:shadow-md"
                    >
                      <div
                        className="absolute bottom-0 left-0 top-0 w-1 bg-[#006837]"
                        aria-hidden
                      />
                      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
                        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                          <div>
                            <div className="flex gap-2">
                              <div className="mt-0.5 flex w-2 flex-col items-center pt-0.5">
                                <span className="h-2.5 w-2.5 rounded-full border-2 border-[#006837] bg-white" />
                                <span className="my-0.5 min-h-[1.5rem] w-px flex-1 bg-zinc-200" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#006837]" />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-zinc-400">
                                  Origin
                                </p>
                                <p className="text-sm font-semibold text-zinc-900">
                                  {tripRequest.originText}
                                </p>
                                <p className="pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-zinc-400">
                                  Destination
                                </p>
                                <p className="text-sm font-semibold text-zinc-900">
                                  {tripRequest.destinationText}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right sm:pl-4">
                            <p className="text-2xl font-bold text-[#006837]">
                              {tripRequest.seatsNeeded}
                            </p>
                            <p className="text-xs text-zinc-500">seats needed</p>
                            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                              Status
                            </p>
                            <p className="text-sm font-semibold text-zinc-800">
                              {toTitleCase(tripRequest.status)}
                            </p>
                            {showOfferBadge ? (
                              <p className="mt-1 text-xs font-semibold text-blue-700">
                                Offer received
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                              <ClockIcon />
                              {formatTimeRange(
                                tripRequest.earliestDesiredAt,
                                tripRequest.latestDesiredAt,
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                              <MapPin
                                className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                                strokeWidth={2}
                                aria-hidden
                              />
                              {distanceCategoryLabel(tripRequest.distanceCategory)} ·{" "}
                              {formatDistanceMilesLabel(tripRequest.distanceCategory)}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-xs font-medium text-zinc-500">
                          {cardOffers.length} offer{cardOffers.length === 1 ? "" : "s"} received ·{" "}
                          {matchCount === undefined
                            ? "Loading matches…"
                            : `${matchCount} suggested matching ride${matchCount === 1 ? "" : "s"}`}
                        </p>

                        <div className="mt-4 flex border-t border-zinc-100 pt-4">
                          <Link
                            href={`/trip-requests/${tripRequest.id}`}
                            className="inline-flex items-center justify-center rounded-xl border-2 border-[#006837] bg-white px-4 py-2 text-sm font-semibold text-[#006837] transition hover:bg-[#006837] hover:text-white"
                          >
                            View Request
                          </Link>
                        </div>

                        {tripRequest.confirmedBookings.length > 0 ? (
                          <div className="mt-4 border-t border-zinc-200 pt-4">
                            <p className="mb-3 text-sm font-semibold text-zinc-900">
                              Confirmed bookings ({tripRequest.confirmedBookings.length})
                            </p>
                            <div className="space-y-2">
                              {tripRequest.confirmedBookings.map((booking) => {
                                const openingConversation =
                                  openingConversationBookingId === booking.id;
                                return (
                                  <div
                                    key={booking.id}
                                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="space-y-1">
                                        <p className="text-sm font-semibold text-zinc-900">
                                          Booking #{booking.id.slice(0, 8)}
                                        </p>
                                        <p className="text-xs text-zinc-600">
                                          {booking.seatsBooked}{" "}
                                          {booking.seatsBooked === 1 ? "seat" : "seats"} ·{" "}
                                          {formatTimeRange(booking.startsAt, booking.endsAt)}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={openingConversation}
                                        onClick={() =>
                                          void openBookingMessages(booking.id)
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <MessageCircle size={14} />
                                        {openingConversation ? "Opening..." : "Message"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    key={tripRequest.id}
                    className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 text-left transition-all hover:border-emerald-500/50 hover:shadow-md"
                  >
                    <Link
                      href={`/trip-requests/${tripRequest.id}`}
                      className="group w-full text-left relative cursor-pointer block"
                    >
                      <div className="absolute top-0 right-0 flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm ${
                            tripRequest.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                          }`}
                        >
                          {toTitleCase(tripRequest.status)}
                        </span>
                        {hasPendingOffersForTripRequest(
                          pendingOffersByTripRequestId,
                          tripRequest.id,
                        ) && (
                          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200 shadow-sm">
                            Offer Received
                          </span>
                        )}
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                          {toTitleCase(tripRequest.distanceCategory)}
                        </span>
                      </div>

                      <div className="pr-24">
                        <div className="flex items-start gap-3 mb-1">
                          <div className="mt-1">
                            <MapPinIcon />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-tight text-zinc-900 group-hover:text-emerald-800 transition-colors">
                              {tripRequest.destinationText}
                            </h3>
                            <p className="text-sm text-zinc-500 mt-0.5">
                              from {tripRequest.originText}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-end justify-between">
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <ClockIcon />
                            {formatTimeRange(
                              tripRequest.earliestDesiredAt,
                              tripRequest.latestDesiredAt,
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md">
                            <UsersIcon />
                            Needs {tripRequest.seatsNeeded}{" "}
                            {tripRequest.seatsNeeded === 1 ? "seat" : "seats"}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1 text-emerald-800">
                          <ArrowRightIcon />
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-medium text-zinc-500">
                        {cardOffers.length} offer{cardOffers.length === 1 ? "" : "s"} received ·{" "}
                        {matchCount === undefined
                          ? "Loading matches…"
                          : `${matchCount} suggested matching ride${matchCount === 1 ? "" : "s"}`}
                      </p>
                    </Link>

                    <div className="mt-4 flex border-t border-zinc-100 pt-4">
                      <Link
                        href={`/trip-requests/${tripRequest.id}`}
                        className="inline-flex items-center justify-center rounded-xl border-2 border-[#006837] bg-white px-4 py-2 text-sm font-semibold text-[#006837] transition hover:bg-[#006837] hover:text-white"
                      >
                        View Request
                      </Link>
                    </div>

                    {tripRequest.confirmedBookings.length > 0 ? (
                      <div className="mt-4 border-t border-zinc-200 pt-4">
                        <p className="mb-3 text-sm font-semibold text-zinc-900">
                          Confirmed bookings ({tripRequest.confirmedBookings.length})
                        </p>
                        <div className="space-y-2">
                          {tripRequest.confirmedBookings.map((booking) => {
                            const openingConversation =
                              openingConversationBookingId === booking.id;
                            return (
                              <div
                                key={booking.id}
                                className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-zinc-900">
                                      Booking #{booking.id.slice(0, 8)}
                                    </p>
                                    <p className="text-xs text-zinc-600">
                                      {booking.seatsBooked}{" "}
                                      {booking.seatsBooked === 1 ? "seat" : "seats"} ·{" "}
                                      {formatTimeRange(
                                        booking.startsAt,
                                        booking.endsAt,
                                      )}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={openingConversation}
                                    onClick={() =>
                                      void openBookingMessages(booking.id)
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <MessageCircle size={14} />
                                    {openingConversation ? "Opening..." : "Message"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedTripRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tripRequestDetailsTitle"
            ref={tripRequestDialogRef}
            tabIndex={-1}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 md:p-8 flex-1">
              <button
                ref={closeTripRequestDialogButtonRef}
                onClick={closeTripRequestModal}
                aria-label="Close trip request details"
                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <AnimatePresence mode="wait">
                {successState ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center space-y-6"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2"
                    >
                      <motion.svg
                        width="50"
                        height="50"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                      >
                        <motion.polyline points="20 6 9 17 4 12" />
                      </motion.svg>
                    </motion.div>
                    <h2
                      id="tripRequestDetailsTitle"
                      className="text-3xl font-bold text-zinc-900"
                    >
                      Trip Request Updated!
                    </h2>
                    <p className="text-zinc-500 max-w-sm">
                      Your trip request details were saved successfully.
                    </p>
                  </motion.div>
                ) : isEditing ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <h2
                      id="tripRequestDetailsTitle"
                      className="text-2xl font-bold mb-8 pr-12 text-zinc-900"
                    >
                      Edit Trip Request
                    </h2>

                    {editSubmitError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-5">
                        {editSubmitError}
                      </div>
                    )}

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <label
                            htmlFor="editOrigin"
                            className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800"
                          >
                            <MapPinIcon /> Origin
                          </label>
                          <input
                            id="editOrigin"
                            type="text"
                            placeholder="Enter origin location..."
                            value={editFormData.originText || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                originText: event.target.value,
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                          />
                          {editFieldErrors.originText && (
                            <p className="mt-1 text-sm text-red-600">
                              {editFieldErrors.originText}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="editDestination"
                            className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800"
                          >
                            <MapPinIcon /> Destination
                          </label>
                          <input
                            id="editDestination"
                            type="text"
                            placeholder="Enter destination location..."
                            value={editFormData.destinationText || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                destinationText: event.target.value,
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                          />
                          {editFieldErrors.destinationText && (
                            <p className="mt-1 text-sm text-red-600">
                              {editFieldErrors.destinationText}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                          <ClockIcon /> Desired Window
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Earliest
                            </label>
                            <input
                              type="datetime-local"
                              value={editFormData.earliestDesiredAt || ""}
                              onChange={(event) =>
                                setEditFormData({
                                  ...editFormData,
                                  earliestDesiredAt: event.target.value,
                                })
                              }
                              className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                            />
                            {editFieldErrors.earliestDesiredAt && (
                              <p className="mt-1 text-sm text-red-600">
                                {editFieldErrors.earliestDesiredAt}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Latest
                            </label>
                            <input
                              type="datetime-local"
                              value={editFormData.latestDesiredAt || ""}
                              onChange={(event) =>
                                setEditFormData({
                                  ...editFormData,
                                  latestDesiredAt: event.target.value,
                                })
                              }
                              className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                            />
                            {editFieldErrors.latestDesiredAt && (
                              <p className="mt-1 text-sm text-red-600">
                                {editFieldErrors.latestDesiredAt}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-zinc-600 mb-1">
                            Preferred Departure (Optional)
                          </label>
                          <input
                            type="datetime-local"
                            value={editFormData.preferredDepartAt || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                preferredDepartAt: event.target.value,
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                          />
                          {editFieldErrors.preferredDepartAt && (
                            <p className="mt-1 text-sm text-red-600">
                              {editFieldErrors.preferredDepartAt}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <UsersIcon /> Seats Needed
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="8"
                            value={editFormData.seatsNeeded || 1}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                seatsNeeded: Number.parseInt(event.target.value, 10) || 1,
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          />
                          {editFieldErrors.seatsNeeded && (
                            <p className="mt-1 text-sm text-red-600">
                              {editFieldErrors.seatsNeeded}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-emerald-800 mb-2">
                            Distance Category
                          </label>
                          <select
                            value={editFormData.distanceCategory || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                distanceCategory: event.target.value as DistanceCategory,
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          >
                            <option value="">Select distance</option>
                            <option value="SHORT">Short</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LONG">Long</option>
                          </select>
                          {editFieldErrors.distanceCategory && (
                            <p className="mt-1 text-sm text-red-600">
                              {editFieldErrors.distanceCategory}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-emerald-800 mb-2">
                            Pickup Instructions (Optional)
                          </label>
                          <textarea
                            value={editFormData.pickupInstructions || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                pickupInstructions: event.target.value,
                              })
                            }
                            rows={2}
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none resize-none"
                          />
                          {editFieldErrors.pickupInstructions && (
                            <p className="mt-1 text-sm text-red-600">
                              {editFieldErrors.pickupInstructions}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-emerald-800 mb-2">
                            Dropoff Instructions (Optional)
                          </label>
                          <textarea
                            value={editFormData.dropoffInstructions || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                dropoffInstructions: event.target.value,
                              })
                            }
                            rows={2}
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none resize-none"
                          />
                          {editFieldErrors.dropoffInstructions && (
                            <p className="mt-1 text-sm text-red-600">
                              {editFieldErrors.dropoffInstructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-100 flex gap-3 justify-end items-center">
                      <button
                        onClick={() => setIsEditing(false)}
                        disabled={submitting}
                        className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium rounded-xl transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void handleEditSubmit()}
                        disabled={submitting}
                        className="px-8 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl shadow-sm transition-colors text-lg disabled:opacity-70 flex items-center gap-2"
                      >
                        {submitting ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <h2
                      id="tripRequestDetailsTitle"
                      className="text-2xl font-bold mb-8 pr-12 text-zinc-900"
                    >
                      Trip Request Details
                    </h2>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            selectedTripRequest.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                          }`}
                        >
                          {toTitleCase(selectedTripRequest.status)}
                        </span>
                      </div>
                      {actionNotice && (
                        <div
                          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                            actionNotice.type === "success"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-red-300 bg-red-50 text-red-700"
                          }`}
                        >
                          {actionNotice.text}
                        </div>
                      )}
                      {refreshingData ? (
                        <p className="text-sm text-zinc-500">
                          Refreshing trip request data...
                        </p>
                      ) : null}

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                            <MapPinIcon /> Origin
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-700">
                            {selectedTripRequest.originText}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                            <MapPinIcon /> Destination
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-700">
                            {selectedTripRequest.destinationText}
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                          <ClockIcon /> Desired Window
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Earliest
                            </label>
                            <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                              {format(
                                new Date(selectedTripRequest.earliestDesiredAt),
                                "MMM d, h:mm a",
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Latest
                            </label>
                            <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                              {format(
                                new Date(selectedTripRequest.latestDesiredAt),
                                "MMM d, h:mm a",
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <UsersIcon /> Seats Needed
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                            {selectedTripRequest.seatsNeeded}
                          </div>
                        </div>
                        <div>
                          <div className="block text-sm font-semibold text-emerald-800 mb-2">
                            Distance Category
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                            {toTitleCase(selectedTripRequest.distanceCategory)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="block text-sm font-semibold text-emerald-800 mb-2">
                          Preferred Departure
                        </div>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800">
                          {selectedTripRequest.preferredDepartAt
                            ? format(
                                new Date(selectedTripRequest.preferredDepartAt),
                                "MMM d, h:mm a",
                              )
                            : "Not specified"}
                        </div>
                      </div>

                      {(selectedTripRequest.pickupInstructions ||
                        selectedTripRequest.dropoffInstructions) && (
                        <div className="pt-2">
                          <h4 className="font-semibold text-zinc-900 mb-3">Notes</h4>
                          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 space-y-3">
                            {selectedTripRequest.pickupInstructions && (
                              <p>
                                <span className="font-semibold">Pickup:</span>{" "}
                                {selectedTripRequest.pickupInstructions}
                              </p>
                            )}
                            {selectedTripRequest.dropoffInstructions && (
                              <p>
                                <span className="font-semibold">Dropoff:</span>{" "}
                                {selectedTripRequest.dropoffInstructions}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:p-6">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h4 className="text-lg font-semibold text-zinc-900">
                            Incoming Offers
                          </h4>
                          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            {selectedTripRequestOffers.length} pending
                          </span>
                        </div>

                        {selectedTripRequestOffers.length === 0 ? (
                          <p className="text-sm text-zinc-600">
                            No pending incoming offers for this trip request.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {selectedTripRequestOffers.map((offer) => {
                              const busyAction =
                                pendingOfferActions[offer.id]?.action ?? null;
                              const isBusy = Boolean(busyAction);
                              const actionsDisabled =
                                isBusy || selectedTripRequest.status !== "ACTIVE";

                              return (
                                <div
                                  key={offer.id}
                                  className="rounded-xl border border-zinc-200 bg-white p-4"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-zinc-900">
                                        {offer.seatsOffered}{" "}
                                        {offer.seatsOffered === 1 ? "seat" : "seats"}{" "}
                                        offered
                                      </p>
                                      <p className="text-xs text-zinc-500">
                                        {formatRelativeTime(offer.createdAt)}
                                      </p>
                                    </div>
                                    <p className="text-lg font-bold text-emerald-700">
                                      {formatPrice(offer.priceCents)}
                                    </p>
                                  </div>

                                  {offer.message ? (
                                    <p className="mt-3 text-sm text-zinc-600">
                                      {offer.message}
                                    </p>
                                  ) : null}

                                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <button
                                      type="button"
                                      disabled={actionsDisabled}
                                      onClick={() =>
                                        void runOfferAction(offer.id, "accept")
                                      }
                                      className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {busyAction === "accept"
                                        ? "Accepting..."
                                        : "Accept"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionsDisabled}
                                      onClick={() =>
                                        void runOfferAction(offer.id, "cancel")
                                      }
                                      className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {busyAction === "cancel"
                                        ? "Declining..."
                                        : "Decline"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {selectedTripRequest.status !== "ACTIVE" && (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                          This trip request is closed and can no longer be edited or
                          cancelled.
                        </div>
                      )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-100 flex gap-3 justify-end items-center">
                      <button
                        onClick={startEditing}
                        disabled={
                          submitting || selectedTripRequest.status !== "ACTIVE"
                        }
                        className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl transition-colors disabled:opacity-60 disabled:hover:bg-emerald-800"
                      >
                        Edit Trip Request
                      </button>
                      <button
                        onClick={() =>
                          void handleCancelTripRequest(selectedTripRequest)
                        }
                        disabled={
                          submitting || selectedTripRequest.status !== "ACTIVE"
                        }
                        className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors disabled:opacity-60 disabled:hover:bg-red-50"
                      >
                        Cancel Trip Request
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
