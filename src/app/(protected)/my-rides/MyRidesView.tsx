"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MessageCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { RidesViewToggle } from "../_components/RidesViewToggle";
import { filterMyRides, type MyRidesQuickFilter } from "@/lib/my-rides";
import { openBookingConversationThread } from "@/lib/booking-conversation";
import type { ManagedRideSummary } from "@/types/ride";

type ActionNotice =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

interface EditRideFormData {
  originText?: string;
  destinationText?: string;
  earliestDepartAt?: string;
  latestDepartAt?: string;
  seatsTotal?: number;
  priceDollars?: string;
  musicPreference?: "" | "MUSIC_ALLOWED" | "NO_MUSIC";
  hasAc?: "" | "true" | "false";
  hasTrunkSpace?: "" | "true" | "false";
  vehicleType?: "" | "SEDAN" | "SUV" | "TRUCK" | "VAN" | "COUPE" | "OTHER";
}

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

export function MyRidesView() {
  const router = useRouter();
  const [rides, setRides] = useState<ManagedRideSummary[]>([]);
  const [selectedRide, setSelectedRide] = useState<ManagedRideSummary | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<EditRideFormData>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<MyRidesQuickFilter>("All");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<"edit" | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [isConfirmingCancellation, setIsConfirmingCancellation] =
    useState(false);
  const [openingConversationBookingId, setOpeningConversationBookingId] =
    useState<string | null>(null);
  const closeRideDialogButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const loadMyRides = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadError(null);
      setLoading(true);
      const response = await fetch("/api/rides/mine", { signal });

      if (!response.ok) {
        throw new Error("Failed to fetch your rides");
      }

      const payload = (await response.json()) as {
        items?: ManagedRideSummary[];
      };
      if (signal?.aborted) {
        return;
      }

      setRides(
        (payload.items ?? []).map((ride) => ({
          ...ride,
          confirmedBookings: ride.confirmedBookings ?? [],
        })),
      );
      setLoadError(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setLoadError(
        error instanceof Error
          ? error
          : new Error("Failed to load your rides."),
      );
      console.error("Error fetching my rides:", error);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadMyRides(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadMyRides]);

  useEffect(() => {
    if (!selectedRide) return;

    window.requestAnimationFrame(() => {
      closeRideDialogButtonRef.current?.focus();
    });
  }, [selectedRide]);

  const closeRideModal = useCallback(() => {
    setSelectedRide(null);
    setSuccessState(null);
    setIsEditing(false);
    setEditFormData({});
    setIsConfirmingCancellation(false);

    const previouslyFocusedElement = lastFocusedElementRef.current;
    if (previouslyFocusedElement) {
      window.requestAnimationFrame(() => {
        previouslyFocusedElement.focus();
      });
    }
    lastFocusedElementRef.current = null;
  }, []);

  useEffect(() => {
    if (!selectedRide) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeRideModal();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedRide, closeRideModal]);

  const filteredRides = filterMyRides({
    rides,
    searchQuery,
    activeFilter,
  });
  const quickFilters = [
    "All",
    "Today",
    "Upcoming",
    "Past",
    "Has Upcoming Bookings",
  ] as const;

  const selectedRideEditLocked = Boolean(
    selectedRide && selectedRide.confirmedBookings.length > 0,
  );

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

  const toNullableBooleanSelectValue = (
    value: boolean | null,
  ): "" | "true" | "false" => {
    if (value === true) return "true";
    if (value === false) return "false";
    return "";
  };

  const formatOptionalFeature = (value: boolean | null) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "Unspecified";
  };

  const formatMusicPreference = (
    value: ManagedRideSummary["musicPreference"],
  ) => {
    if (value === "MUSIC_ALLOWED") return "Music allowed";
    if (value === "NO_MUSIC") return "No music";
    return "Unspecified";
  };

  const formatVehicleType = (value: ManagedRideSummary["vehicleType"]) => {
    if (!value) return "Unspecified";
    return toTitleCase(value);
  };

  const startEditing = () => {
    if (!selectedRide || selectedRide.confirmedBookings.length > 0) return;

    setEditFormData({
      originText: selectedRide.originText,
      destinationText: selectedRide.destinationText,
      earliestDepartAt: format(
        new Date(selectedRide.earliestDepartAt),
        "yyyy-MM-dd'T'HH:mm",
      ),
      latestDepartAt: format(
        new Date(selectedRide.latestDepartAt),
        "yyyy-MM-dd'T'HH:mm",
      ),
      seatsTotal: selectedRide.seatsTotal,
      priceDollars: (selectedRide.priceCents / 100).toFixed(2),
      musicPreference: selectedRide.musicPreference ?? "",
      hasAc: toNullableBooleanSelectValue(selectedRide.hasAc),
      hasTrunkSpace: toNullableBooleanSelectValue(selectedRide.hasTrunkSpace),
      vehicleType: selectedRide.vehicleType ?? "",
    });
    setIsEditing(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedRide) return;

    const normalizedPriceInput = editFormData.priceDollars?.trim() ?? "";
    if (normalizedPriceInput.length === 0) {
      alert("Price/Seat is required.");
      return;
    }

    const parsedPriceDollars = Number(normalizedPriceInput);
    if (!Number.isFinite(parsedPriceDollars) || parsedPriceDollars < 0) {
      alert("Price/Seat must be a valid non-negative dollar amount.");
      return;
    }

    const parts = normalizedPriceInput.split(".");
    if (parts.length > 2) {
      alert("Price/Seat must be a valid non-negative dollar amount.");
      return;
    }

    const rawDollarsPart = parts[0] ?? "0";
    const rawCentsPart = parts[1] ?? "";
    const dollarsPart = rawDollarsPart === "" ? "0" : rawDollarsPart;

    if (rawCentsPart.length > 2) {
      alert("Price/Seat must be a valid non-negative dollar amount.");
      return;
    }

    if (!/^\d+$/.test(dollarsPart) || !/^\d*$/.test(rawCentsPart)) {
      alert("Price/Seat must be a valid non-negative dollar amount.");
      return;
    }

    const centsPart = `${rawCentsPart}00`.slice(0, 2);
    const parsedPriceCents =
      Number.parseInt(dollarsPart, 10) * 100 +
      Number.parseInt(centsPart, 10);

    try {
      setSubmitting(true);
      const response = await fetch(`/api/rides/${selectedRide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originText: editFormData.originText,
          destinationText: editFormData.destinationText,
          earliestDepartAt: editFormData.earliestDepartAt
            ? new Date(editFormData.earliestDepartAt).toISOString()
            : undefined,
          latestDepartAt: editFormData.latestDepartAt
            ? new Date(editFormData.latestDepartAt).toISOString()
            : undefined,
          seatsTotal: editFormData.seatsTotal,
          priceCents: parsedPriceCents,
          musicPreference: editFormData.musicPreference || null,
          hasAc:
            editFormData.hasAc === "true"
              ? true
              : editFormData.hasAc === "false"
                ? false
                : null,
          hasTrunkSpace:
            editFormData.hasTrunkSpace === "true"
              ? true
              : editFormData.hasTrunkSpace === "false"
                ? false
                : null,
          vehicleType: editFormData.vehicleType || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message ?? "Failed to update ride");
      }

      const updatedRide = (await response.json()) as Omit<
        ManagedRideSummary,
        "confirmedBookings"
      >;
      const mergedUpdatedRide: ManagedRideSummary = {
        ...updatedRide,
        confirmedBookings: selectedRide.confirmedBookings,
      };
      setSelectedRide(mergedUpdatedRide);
      setRides((prev) =>
        prev.map((ride) =>
          ride.id === mergedUpdatedRide.id ? mergedUpdatedRide : ride,
        ),
      );
      setIsEditing(false);
      setSuccessState("edit");
      window.setTimeout(() => {
        closeRideModal();
      }, 2500);
    } catch (error: unknown) {
      alert(`Error updating ride: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRide = async (rideId: string) => {
    try {
      setSubmitting(true);
      setActionNotice(null);
      const response = await fetch(`/api/rides/${rideId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setActionNotice({ type: "success", text: "Ride cancelled successfully." });
        setRides((prev) => prev.filter((ride) => ride.id !== rideId));
        closeRideModal();
        return;
      }

      const payload = await response.json().catch(() => null);
      setActionNotice({
        type: "error",
        text: payload?.message ?? payload?.error ?? "Failed to cancel ride.",
      });
    } catch {
      setActionNotice({
        type: "error",
        text: "An error occurred while attempting to cancel the ride.",
      });
    } finally {
      setSubmitting(false);
      setIsConfirmingCancellation(false);
    }
  };

  const openBookingMessages = async (bookingId: string) => {
    setActionNotice(null);
    setOpeningConversationBookingId(bookingId);

    try {
      const result = await openBookingConversationThread(bookingId);
      if (!result.ok) {
        setActionNotice({ type: "error", text: result.message });
        return;
      }

      router.push(result.href);
    } catch (error) {
      setActionNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to open booking messages right now.",
      });
    } finally {
      setOpeningConversationBookingId(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-zinc-100">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">My Rides</h1>
            <p className="text-zinc-500">Manage rides you have posted</p>
          </div>
          <Link
            href="/post-ride"
            className="bg-emerald-800 hover:bg-emerald-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm"
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
            Post a Ride
          </Link>
        </div>

        <RidesViewToggle activeView="my" />

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
            aria-label="Search destinations"
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
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto">
        <div className="w-full min-w-0 bg-white rounded-2xl p-4 md:p-6 lg:p-8 shadow-sm border border-zinc-100">
          <p className="text-sm font-medium text-zinc-500 mb-4 md:mb-6 text-center">
            {filteredRides.length} {filteredRides.length === 1 ? "ride" : "rides"} posted
          </p>
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

          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-32 bg-zinc-100 animate-pulse rounded-2xl"
                ></div>
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
                Unable to load rides
              </h3>
              <p className="text-zinc-500 max-w-sm mx-auto">
                {loadError.message || "Something went wrong while loading your rides."}
              </p>
              <button
                type="button"
                onClick={() => void loadMyRides()}
                className="mt-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 px-5 py-2.5 font-medium text-white transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredRides.length === 0 ? (
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
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No rides found</h3>
              <p className="text-zinc-500 max-w-sm mx-auto">
                We couldn&apos;t find any of your rides matching your current
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
              {filteredRides.map((ride) => (
                <article
                  key={ride.id}
                  className="w-full text-left bg-white border border-zinc-200 rounded-2xl p-5 transition-all relative overflow-hidden hover:border-emerald-500/50 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const activeElement = document.activeElement;
                      lastFocusedElementRef.current =
                        activeElement instanceof HTMLElement ? activeElement : null;
                      setSelectedRide(ride);
                    }}
                    className="group w-full text-left cursor-pointer"
                  >
                    <div className="absolute top-5 right-5 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                      {toTitleCase(ride.distanceCategory)}
                    </div>

                    <div className="pr-20">
                      <div className="flex items-start gap-3 mb-1">
                        <div className="mt-1">
                          <MapPinIcon />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg leading-tight text-zinc-900 group-hover:text-emerald-800 transition-colors">
                            {ride.destinationText}
                          </h3>
                          <p className="text-sm text-zinc-500 mt-0.5">
                            from {ride.originText}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <ClockIcon />
                          {formatTimeRange(ride.earliestDepartAt, ride.latestDepartAt)}
                        </div>
                        <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md">
                          <UsersIcon />
                          {ride.seatsAvailable}{" "}
                          {ride.seatsAvailable === 1 ? "seat" : "seats"} available
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 text-emerald-800">
                        <span className="font-bold text-xl">${(ride.priceCents / 100).toFixed(2)}</span>
                        <ArrowRightIcon />
                      </div>
                    </div>
                  </button>

                  {ride.confirmedBookings.length > 0 ? (
                    <div className="mt-4 border-t border-zinc-200 pt-4">
                      <p className="mb-3 text-sm font-semibold text-zinc-900">
                        Confirmed bookings ({ride.confirmedBookings.length})
                      </p>
                      <div className="space-y-2">
                        {ride.confirmedBookings.map((booking) => {
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
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm"
          onClick={closeRideModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rideDetailsTitle"
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 md:p-8 flex-1">
              <button
                ref={closeRideDialogButtonRef}
                onClick={closeRideModal}
                aria-label="Close ride details"
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
                    <h2 id="rideDetailsTitle" className="text-3xl font-bold text-zinc-900">
                      Ride Updated!
                    </h2>
                    <p className="text-zinc-500 max-w-sm">
                      Your ride details were saved successfully.
                    </p>
                  </motion.div>
                ) : isEditing ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <h2 id="rideDetailsTitle" className="text-2xl font-bold mb-8 pr-12 text-zinc-900">
                      Edit Ride
                    </h2>

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
                              setEditFormData({ ...editFormData, originText: event.target.value })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                          />
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
                        </div>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                          <ClockIcon /> Departure Window
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Earliest
                            </label>
                            <input
                              type="datetime-local"
                              value={editFormData.earliestDepartAt || ""}
                              onChange={(event) =>
                                setEditFormData({
                                  ...editFormData,
                                  earliestDepartAt: event.target.value,
                                })
                              }
                              className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Latest
                            </label>
                            <input
                              type="datetime-local"
                              value={editFormData.latestDepartAt || ""}
                              onChange={(event) =>
                                setEditFormData({
                                  ...editFormData,
                                  latestDepartAt: event.target.value,
                                })
                              }
                              className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <UsersIcon /> Total Seats
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="8"
                            value={editFormData.seatsTotal || 1}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                seatsTotal: Number.parseInt(event.target.value, 10) || 1,
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <span className="font-bold text-lg leading-none">$</span>
                            Price/Seat
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editFormData.priceDollars || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                priceDollars: event.target.value,
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-emerald-800 mb-2">
                            Music Preference
                          </label>
                          <select
                            value={editFormData.musicPreference || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                musicPreference: event.target
                                  .value as EditRideFormData["musicPreference"],
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          >
                            <option value="">Unspecified</option>
                            <option value="MUSIC_ALLOWED">Music allowed</option>
                            <option value="NO_MUSIC">No music</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-emerald-800 mb-2">
                            Vehicle Type
                          </label>
                          <select
                            value={editFormData.vehicleType || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                vehicleType: event.target
                                  .value as EditRideFormData["vehicleType"],
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          >
                            <option value="">Unspecified</option>
                            <option value="SEDAN">Sedan</option>
                            <option value="SUV">SUV</option>
                            <option value="TRUCK">Truck</option>
                            <option value="VAN">Van</option>
                            <option value="COUPE">Coupe</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-emerald-800 mb-2">
                            AC Availability
                          </label>
                          <select
                            value={editFormData.hasAc || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                hasAc: event.target.value as EditRideFormData["hasAc"],
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          >
                            <option value="">Unspecified</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-emerald-800 mb-2">
                            Trunk Space Availability
                          </label>
                          <select
                            value={editFormData.hasTrunkSpace || ""}
                            onChange={(event) =>
                              setEditFormData({
                                ...editFormData,
                                hasTrunkSpace: event.target
                                  .value as EditRideFormData["hasTrunkSpace"],
                              })
                            }
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          >
                            <option value="">Unspecified</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
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
                    <h2 id="rideDetailsTitle" className="text-2xl font-bold mb-8 pr-12 text-zinc-900">
                      Ride Details
                    </h2>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                            <MapPinIcon /> Origin
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-700">
                            {selectedRide.originText}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                            <MapPinIcon /> Destination
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-700">
                            {selectedRide.destinationText}
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                          <ClockIcon /> Departure Window
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Earliest
                            </label>
                            <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                              {format(new Date(selectedRide.earliestDepartAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">
                              Latest
                            </label>
                            <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                              {format(new Date(selectedRide.latestDepartAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <UsersIcon /> Seats Available
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                            {selectedRide.seatsAvailable}
                            <span className="text-zinc-500 font-normal text-sm ml-1">
                              of {selectedRide.seatsTotal}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <span className="font-bold text-lg leading-none">$</span>
                            Price/Seat
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                            ${(selectedRide.priceCents / 100).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                        <h4 className="font-semibold text-zinc-900 mb-4">Ride attributes</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="bg-white border border-zinc-200 rounded-xl p-3">
                            <p className="text-zinc-500">Music</p>
                            <p className="font-medium text-zinc-800">
                              {formatMusicPreference(selectedRide.musicPreference)}
                            </p>
                          </div>
                          <div className="bg-white border border-zinc-200 rounded-xl p-3">
                            <p className="text-zinc-500">Vehicle type</p>
                            <p className="font-medium text-zinc-800">
                              {formatVehicleType(selectedRide.vehicleType)}
                            </p>
                          </div>
                          <div className="bg-white border border-zinc-200 rounded-xl p-3">
                            <p className="text-zinc-500">AC available</p>
                            <p className="font-medium text-zinc-800">
                              {formatOptionalFeature(selectedRide.hasAc)}
                            </p>
                          </div>
                          <div className="bg-white border border-zinc-200 rounded-xl p-3">
                            <p className="text-zinc-500">Trunk space</p>
                            <p className="font-medium text-zinc-800">
                              {formatOptionalFeature(selectedRide.hasTrunkSpace)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {(selectedRide.pickupInstructions || selectedRide.dropoffInstructions) && (
                        <div className="pt-2">
                          <h4 className="font-semibold text-zinc-900 mb-3">Notes</h4>
                          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 space-y-3">
                            {selectedRide.pickupInstructions && (
                              <p>
                                <span className="font-semibold">Pickup:</span>{" "}
                                {selectedRide.pickupInstructions}
                              </p>
                            )}
                      {selectedRide.dropoffInstructions && (
                              <p>
                                <span className="font-semibold">Dropoff:</span>{" "}
                                {selectedRide.dropoffInstructions}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {isConfirmingCancellation ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900">
                          <p className="text-base font-semibold">
                            Cancel this ride?
                          </p>
                          <p className="mt-1 text-sm text-red-800">
                            This will cancel the ride and any confirmed bookings tied
                            to it.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-100 flex gap-3 justify-end items-center">
                      <button
                        onClick={startEditing}
                        disabled={selectedRideEditLocked}
                        title={
                          selectedRideEditLocked
                            ? "Editing is unavailable after a confirmed booking."
                            : undefined
                        }
                        className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl transition-colors"
                      >
                        Edit Ride
                      </button>
                      {isConfirmingCancellation ? (
                        <>
                          <button
                            onClick={() => setIsConfirmingCancellation(false)}
                            disabled={submitting}
                            className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium rounded-xl transition-colors disabled:opacity-60"
                          >
                            Keep Ride
                          </button>
                          <button
                            onClick={() => {
                              void handleCancelRide(selectedRide.id);
                            }}
                            disabled={submitting}
                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
                          >
                            {submitting ? "Cancelling..." : "Confirm Cancel"}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setIsConfirmingCancellation(true)}
                          disabled={submitting}
                          className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors disabled:opacity-60"
                        >
                          Cancel Ride
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
    </>
  );
}
