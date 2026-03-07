"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ProtectedShell } from "../_components/ProtectedShell";
import { TripRequestsViewToggle } from "../_components/TripRequestsViewToggle";
import { MyTripRequestsView } from "../my-trip-requests/MyTripRequestsView";
import {
  buildOfferPayload,
  filterTripRequestsForBrowse,
  getPendingOfferTripRequestIds,
  type BrowseTripRequestsQuickFilter,
  type OfferFieldErrors,
  type OfferFormValues,
  type PendingOfferSummary,
  type TripRequestSummary,
} from "@/lib/browse-trip-requests";
import { normalizeTripRequestsView } from "@/lib/trip-request-view";

interface CurrentUserSummary {
  clerkUserId: string;
  primaryVerifiedEmail: string;
  created: boolean;
  localUser: {
    id: string;
    clerkUserId: string;
    name: string | null;
  } | null;
}

interface TripRequestsApiResponse {
  items?: TripRequestSummary[];
}

interface OffersMineApiResponse {
  items?: PendingOfferSummary[];
  nextCursor?: string | null;
}

interface ApiValidationDetail {
  field?: string;
  message?: string;
}

const initialOfferFormValues: OfferFormValues = {
  seatsOffered: "1",
  priceDollars: "",
  message: "",
};

const fieldNameMap: Record<string, keyof OfferFieldErrors> = {
  seatsOffered: "seatsOffered",
  priceCents: "priceDollars",
  message: "message",
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
    className="text-zinc-400 group-hover:text-emerald-600 transition-colors"
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

async function parseOfferErrorResponse(
  response: Response,
): Promise<{ fieldErrors: OfferFieldErrors; message: string }> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const fieldErrors: OfferFieldErrors = {};
  let message = "Unable to send offer right now. Please try again.";

  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      message = maybeMessage;
    }

    const details = (payload as { details?: unknown }).details;
    if (Array.isArray(details)) {
      details.forEach((detail) => {
        const typedDetail = detail as ApiValidationDetail;
        if (
          typeof typedDetail.field === "string" &&
          typeof typedDetail.message === "string"
        ) {
          const mappedField = fieldNameMap[typedDetail.field];
          if (mappedField && !fieldErrors[mappedField]) {
            fieldErrors[mappedField] = typedDetail.message;
          }
        }
      });
    }
  }

  return { fieldErrors, message };
}

function formatTimeRange(earliest: string, latest: string) {
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
}

function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function BrowseTripRequestsPage() {
  const searchParams = useSearchParams();
  const currentView = normalizeTripRequestsView(searchParams.get("view"));
  const [tripRequests, setTripRequests] = useState<TripRequestSummary[]>([]);
  const [selectedTripRequest, setSelectedTripRequest] =
    useState<TripRequestSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUserSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<BrowseTripRequestsQuickFilter>("All");
  const [loading, setLoading] = useState(true);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [pendingOfferTripRequestIds, setPendingOfferTripRequestIds] = useState(
    () => new Set<string>(),
  );
  const [offerFormValues, setOfferFormValues] = useState<OfferFormValues>(
    initialOfferFormValues,
  );
  const [offerFieldErrors, setOfferFieldErrors] = useState<OfferFieldErrors>({});
  const [offerSubmitError, setOfferSubmitError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const closeTripDialogButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (currentView !== "browse") {
      return;
    }

    const controller = new AbortController();

    async function fetchTripRequests() {
      const response = await fetch("/api/trip-requests", {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch trip requests");
      }

      const payload = (await response.json()) as TripRequestsApiResponse;
      if (!controller.signal.aborted) {
        setTripRequests(payload.items ?? []);
      }
    }

    async function fetchCurrentUser() {
      const response = await fetch("/api/me", { signal: controller.signal });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as CurrentUserSummary;
      if (!controller.signal.aborted) {
        setCurrentUser(payload);
      }
    }

    async function fetchPendingOffers() {
      const allOffers: PendingOfferSummary[] = [];
      let nextCursor: string | null = null;

      do {
        const search = new URLSearchParams({
          role: "driver",
          status: "PENDING",
          limit: "50",
        });
        if (nextCursor) {
          search.set("cursor", nextCursor);
        }

        const response = await fetch(`/api/offers/mine?${search.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch pending offers");
        }

        const payload = (await response.json()) as OffersMineApiResponse;
        if (controller.signal.aborted) {
          return;
        }

        allOffers.push(...(payload.items ?? []));
        nextCursor = payload.nextCursor ?? null;
      } while (nextCursor);

      if (!controller.signal.aborted) {
        setPendingOfferTripRequestIds(getPendingOfferTripRequestIds(allOffers));
      }
    }

    async function loadPageData() {
      try {
        setLoading(true);
        await Promise.all([
          fetchTripRequests(),
          fetchCurrentUser(),
          fetchPendingOffers(),
        ]);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to load browse trip requests data:", error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      controller.abort();
    };
  }, [currentView]);

  useEffect(() => {
    if (!selectedTripRequest) {
      return;
    }

    window.requestAnimationFrame(() => {
      closeTripDialogButtonRef.current?.focus();
    });
  }, [selectedTripRequest]);

  const quickFilters = ["All", "Soon", "Solo", "Group", "Offer Sent"] as const;

  const filteredTripRequests = useMemo(
    () =>
      filterTripRequestsForBrowse({
        tripRequests,
        currentUserId: currentUser?.clerkUserId ?? null,
        searchQuery,
        activeFilter,
        pendingOfferTripRequestIds,
      }),
    [tripRequests, currentUser?.clerkUserId, searchQuery, activeFilter, pendingOfferTripRequestIds],
  );

  const selectedHasPendingOffer =
    selectedTripRequest !== null &&
    pendingOfferTripRequestIds.has(selectedTripRequest.id);

  function updateOfferField<K extends keyof OfferFormValues>(
    field: K,
    value: OfferFormValues[K],
  ) {
    setOfferFormValues((prev) => ({ ...prev, [field]: value }));
    setOfferFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function openTripRequestModal(tripRequest: TripRequestSummary) {
    const activeElement = document.activeElement;
    lastFocusedElementRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;
    setSelectedTripRequest(tripRequest);
    setOfferSubmitError(null);
    setOfferFieldErrors({});
    setOfferSuccess(false);
    setOfferFormValues({
      seatsOffered: String(tripRequest.seatsNeeded),
      priceDollars: "",
      message: "",
    });
  }

  function closeTripRequestModal() {
    setSelectedTripRequest(null);
    setOfferSubmitError(null);
    setOfferFieldErrors({});
    setOfferSuccess(false);
    setOfferFormValues(initialOfferFormValues);

    const previouslyFocusedElement = lastFocusedElementRef.current;
    if (previouslyFocusedElement) {
      window.requestAnimationFrame(() => {
        previouslyFocusedElement.focus();
      });
    }
    lastFocusedElementRef.current = null;
  }

  if (currentView === "my") {
    return (
      <ProtectedShell activeNav="browseTripRequests">
        <MyTripRequestsView />
      </ProtectedShell>
    );
  }

  async function handleSendOffer() {
    if (!selectedTripRequest || submittingOffer || selectedHasPendingOffer) {
      return;
    }

    setOfferSubmitError(null);
    const buildResult = buildOfferPayload(offerFormValues);
    setOfferFieldErrors(buildResult.fieldErrors);

    if (!buildResult.payload) {
      setOfferSubmitError(buildResult.submitError);
      return;
    }

    try {
      setSubmittingOffer(true);

      const response = await fetch(
        `/api/trip-requests/${selectedTripRequest.id}/offers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(buildResult.payload),
        },
      );

      if (response.ok) {
        setPendingOfferTripRequestIds((prev) => {
          const next = new Set(prev);
          next.add(selectedTripRequest.id);
          return next;
        });
        setOfferSuccess(true);
        window.setTimeout(() => {
          closeTripRequestModal();
        }, 2200);
        return;
      }

      const parsedError = await parseOfferErrorResponse(response);
      setOfferFieldErrors((prev) => ({ ...prev, ...parsedError.fieldErrors }));
      setOfferSubmitError(parsedError.message);
    } catch (error) {
      console.error("Failed to send offer:", error);
      setOfferSubmitError("Network error while sending offer. Please try again.");
    } finally {
      setSubmittingOffer(false);
    }
  }

  return (
    <ProtectedShell activeNav="browseTripRequests">
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-zinc-100">
        <div className="mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              Trip Requests
            </h1>
            <p className="text-zinc-500">
              Find active trip requests from verified Stetson students
            </p>
          </div>
        </div>

        <TripRequestsViewToggle activeView="browse" />

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
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
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium placeholder:font-normal"
          />
        </div>

        <div className="mt-5 -mx-1 px-1 overflow-x-auto">
          <div className="flex min-w-max gap-2 pb-1">
            {quickFilters.map((filterOpt) => (
              <button
                key={filterOpt}
                onClick={() => setActiveFilter(filterOpt)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeFilter === filterOpt
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
                }`}
              >
                {filterOpt}
              </button>
            ))}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap bg-zinc-100 border border-zinc-300 text-zinc-400 cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
              Advanced Filters
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto">
        <div className="w-full min-w-0 bg-white rounded-2xl p-4 md:p-6 lg:p-8 shadow-sm border border-zinc-100">
          <p className="text-sm font-medium text-zinc-500 mb-4 md:mb-6 text-center">
            {filteredTripRequests.length}{" "}
            {filteredTripRequests.length === 1
              ? "trip request"
              : "trip requests"}{" "}
            available
          </p>

          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-32 bg-zinc-100 animate-pulse rounded-2xl"
                ></div>
              ))}
            </div>
          ) : filteredTripRequests.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
              <h3 className="text-lg font-bold text-zinc-900 mb-1">
                No trip requests found
              </h3>
              <p className="text-zinc-500 max-w-sm mx-auto">
                We couldn&apos;t find any trip requests matching your current
                search and filter criteria.
              </p>
              {activeFilter !== "All" && (
                <button
                  onClick={() => setActiveFilter("All")}
                  className="mt-4 text-emerald-700 font-medium hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredTripRequests.map((tripRequest) => (
                <button
                  type="button"
                  key={tripRequest.id}
                  onClick={() => openTripRequestModal(tripRequest)}
                  className="group w-full text-left bg-white border border-zinc-200 rounded-2xl p-5 hover:border-emerald-500/50 hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-5 right-5 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                    {toTitleCase(tripRequest.distanceCategory)}
                  </div>

                  <div className="pr-20">
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
                    <div className="flex items-center gap-2 text-emerald-800">
                      {tripRequest.hasPendingOffer ? (
                        <span className="text-sm font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Offer Sent
                        </span>
                      ) : (
                        <ArrowRightIcon />
                      )}
                    </div>
                  </div>
                </button>
              ))}
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
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 md:p-8 flex-1">
              <button
                ref={closeTripDialogButtonRef}
                onClick={closeTripRequestModal}
                aria-label="Close trip request details"
                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <AnimatePresence mode="wait">
                {offerSuccess ? (
                  <motion.div
                    key="offer-success"
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
                    <h2 className="text-3xl font-bold text-zinc-900">Offer Sent!</h2>
                    <p className="text-zinc-500 max-w-sm">
                      Your offer has been submitted and is now listed in Pending
                      Offers on your dashboard.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="offer-form"
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
                          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            Distance
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                            {toTitleCase(selectedTripRequest.distanceCategory)}
                          </div>
                        </div>
                      </div>

                      {(selectedTripRequest.pickupInstructions ||
                        selectedTripRequest.dropoffInstructions) && (
                        <div className="pt-2">
                          <h4 className="font-semibold text-zinc-900 mb-3">
                            Rider Notes
                          </h4>
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

                      {selectedHasPendingOffer ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium">
                          You already sent an active offer for this trip request.
                        </div>
                      ) : (
                        <div className="border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-4">
                          <h4 className="text-lg font-bold text-zinc-900">Send Offer</h4>

                          {offerSubmitError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {offerSubmitError}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label
                                htmlFor="seatsOffered"
                                className="block text-sm font-semibold text-emerald-800 mb-2"
                              >
                                Seats Offered
                              </label>
                              <input
                                id="seatsOffered"
                                type="number"
                                min="1"
                                max="8"
                                step="1"
                                value={offerFormValues.seatsOffered}
                                onChange={(event) =>
                                  updateOfferField("seatsOffered", event.target.value)
                                }
                                className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                              />
                              {offerFieldErrors.seatsOffered && (
                                <p className="mt-1 text-sm text-red-600">
                                  {offerFieldErrors.seatsOffered}
                                </p>
                              )}
                            </div>

                            <div>
                              <label
                                htmlFor="priceDollars"
                                className="block text-sm font-semibold text-emerald-800 mb-2"
                              >
                                Total Price ($)
                              </label>
                              <input
                                id="priceDollars"
                                type="number"
                                min="0"
                                step="0.01"
                                value={offerFormValues.priceDollars}
                                onChange={(event) =>
                                  updateOfferField("priceDollars", event.target.value)
                                }
                                className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                                placeholder="12.50"
                              />
                              {offerFieldErrors.priceDollars && (
                                <p className="mt-1 text-sm text-red-600">
                                  {offerFieldErrors.priceDollars}
                                </p>
                              )}
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="offerMessage"
                              className="block text-sm font-semibold text-emerald-800 mb-2"
                            >
                              Message (Optional)
                            </label>
                            <textarea
                              id="offerMessage"
                              rows={3}
                              value={offerFormValues.message}
                              onChange={(event) =>
                                updateOfferField("message", event.target.value)
                              }
                              className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                              placeholder="Share any helpful details for the rider..."
                            />
                            {offerFieldErrors.message && (
                              <p className="mt-1 text-sm text-red-600">
                                {offerFieldErrors.message}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-100 flex gap-3 justify-end items-center">
                      <button
                        onClick={closeTripRequestModal}
                        className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium rounded-xl transition-colors"
                      >
                        Close
                      </button>
                      {!selectedHasPendingOffer && (
                        <button
                          onClick={() => void handleSendOffer()}
                          disabled={submittingOffer}
                          className="px-8 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl shadow-sm transition-colors text-lg whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {submittingOffer ? "Sending..." : "Send Offer"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </ProtectedShell>
  );
}
