"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, MessageCircle, X } from "lucide-react";
import { ProtectedShell } from "../_components/ProtectedShell";
import { TripVisualizationMap } from "@/components/TripVisualizationMap";
import { openBookingConversationThread } from "@/lib/booking-conversation";
import { deriveDriverTripMapMarker, deriveStaticTripMapMarkers } from "@/lib/trip-map";
import { useBookingLocationTracking } from "@/lib/use-booking-location-tracking";
import {
  type DashboardBookingItem,
  type NormalizedDashboardBooking,
  getSeatDisplayText,
  normalizeDashboardBooking,
  toDistanceLabel,
} from "@/lib/dashboard";

const CARD_CLASS =
  "bg-white border border-zinc-200 rounded-2xl p-4 md:p-6 shadow-sm";

type ActionNotice =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

interface DashboardBookingsResponse {
  now: string;
  items: DashboardBookingItem[];
}

const MapPinIcon = ({ className = "text-zinc-400" }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CalendarIcon = ({ className = "text-zinc-500" }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

const UsersIcon = ({ className = "text-zinc-500" }: { className?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

function formatPrice(priceCents: number | null): string | null {
  if (priceCents === null) return null;
  return `$ ${(priceCents / 100).toFixed(2)}`;
}

function formatTimeRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Time TBD";
    }

    return `${format(start, "MMM d, h:mm a")} -> ${format(end, "MMM d, h:mm a")}`;
  } catch {
    return "Time TBD";
  }
}

function formatLocationTimestamp(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return "No update yet";
  }

  const timestamp = new Date(isoTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return "No update yet";
  }

  return format(timestamp, "MMM d, h:mm:ss a");
}

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<DashboardBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<NormalizedDashboardBooking | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [openingConversationBookingId, setOpeningConversationBookingId] = useState<string | null>(null);
  const tripDialogRef = useRef<HTMLDivElement | null>(null);
  const closeTripButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [bookingsResponse, viewerResponse] = await Promise.all([
          fetch("/api/dashboard/bookings", { signal: controller.signal }),
          fetch("/api/me", { signal: controller.signal }),
        ]);

        if (!bookingsResponse.ok) {
          const payload = await bookingsResponse.json().catch(() => null);
          const message =
            payload?.message ?? payload?.error ?? "Failed to load upcoming trips.";
          throw new Error(message);
        }

        const bookingsPayload =
          (await bookingsResponse.json()) as DashboardBookingsResponse;

        if (!controller.signal.aborted) {
          setBookings(bookingsPayload.items ?? []);
        }

        if (viewerResponse.ok && !controller.signal.aborted) {
          const viewerPayload = (await viewerResponse.json()) as {
            clerkUserId?: string;
          };
          setViewerUserId(viewerPayload.clerkUserId ?? null);
        }
      } catch (fetchError: unknown) {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load upcoming trips."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedTrip) return;
    closeTripButtonRef.current?.focus();
    if (!closeTripButtonRef.current) {
      tripDialogRef.current?.focus();
    }
  }, [selectedTrip]);

  const normalizedBookings = useMemo(
    () => bookings.map(normalizeDashboardBooking),
    [bookings]
  );
  const selectedBookingId = selectedTrip?.id ?? null;
  const viewerIsDriverForSelectedTrip = Boolean(
    selectedTrip && viewerUserId && selectedTrip.driverUserId === viewerUserId
  );
  const trackingEnabled =
    Boolean(selectedBookingId) && selectedTrip?.status === "CONFIRMED";

  const locationTracking = useBookingLocationTracking({
    bookingId: selectedBookingId,
    enabled: trackingEnabled,
    isDriver: viewerIsDriverForSelectedTrip,
    pollIntervalMs: 10_000,
  });
  const locationLatitude = locationTracking.location?.latitude;
  const locationLongitude = locationTracking.location?.longitude;
  const hasLatitude = typeof locationLatitude === "number";
  const hasLongitude = typeof locationLongitude === "number";
  const noLocationYet = !(hasLatitude && hasLongitude);
  const latitudeDisplay = hasLatitude ? locationLatitude.toFixed(5) : "—";
  const longitudeDisplay = hasLongitude ? locationLongitude.toFixed(5) : "—";
  const staticTripMarkers = useMemo(
    () =>
      selectedTrip
        ? deriveStaticTripMapMarkers({
            originLabel: selectedTrip.originText,
            originLatitude: selectedTrip.originLatitude,
            originLongitude: selectedTrip.originLongitude,
            destinationLabel: selectedTrip.destinationText,
            destinationLatitude: selectedTrip.destinationLatitude,
            destinationLongitude: selectedTrip.destinationLongitude,
          })
        : null,
    [selectedTrip]
  );
  const driverTripMarker = useMemo(
    () => deriveDriverTripMapMarker(locationLatitude, locationLongitude),
    [locationLatitude, locationLongitude]
  );
  const liveDriverStatus = useMemo(() => {
    if (!locationTracking.isTripActive) {
      return "stopped" as const;
    }

    if (locationTracking.isSharingActive) {
      return "updating" as const;
    }

    return "unavailable" as const;
  }, [locationTracking.isSharingActive, locationTracking.isTripActive]);
  const sharingBadgeClass = !locationTracking.isTripActive
    ? "bg-amber-100 text-amber-700"
    : locationTracking.isSharingActive
      ? "bg-emerald-100 text-emerald-700"
      : "bg-zinc-200 text-zinc-700";
  const sharingBadgeLabel = !locationTracking.isTripActive
    ? "Trip Inactive"
    : locationTracking.isSharingActive
      ? "Sharing Active"
      : "Sharing Inactive";

  async function openBookingMessages(bookingId: string) {
    setActionNotice(null);
    setOpeningConversationBookingId(bookingId);

    const result = await openBookingConversationThread(bookingId);
    if (!result.ok) {
      setActionNotice({ type: "error", text: result.message });
      setOpeningConversationBookingId(null);
      return;
    }

    router.push(result.href);
  }

  return (
    <ProtectedShell activeNav="dashboard">
      <section className="space-y-8">
        <header className="space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900"
          >
            <ChevronLeft size={16} />
            Back to dashboard
          </Link>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">
                Your Upcoming Trips
              </h1>
              <p className="text-zinc-500 text-lg">
                Every upcoming confirmed trip where you are the rider or driver.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Total upcoming trips</p>
              <p className="text-3xl font-bold tracking-tight text-zinc-900">
                {normalizedBookings.length}
              </p>
            </div>
          </div>
        </header>

        {actionNotice ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              actionNotice.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {actionNotice.text}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-36 rounded-2xl bg-zinc-100 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : normalizedBookings.length === 0 ? (
          <div className={`${CARD_CLASS} text-zinc-500`}>
            You do not have any upcoming confirmed trips right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {normalizedBookings.map((booking) => {
              const bookingPrice = formatPrice(booking.priceCents);
              const openingConversation = openingConversationBookingId === booking.id;

              return (
                <article
                  key={booking.id}
                  className={`${CARD_CLASS} w-full text-left transition-all hover:border-emerald-500/50 hover:shadow-md`}
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <MapPinIcon className="mt-1 shrink-0 text-zinc-400" />
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                            {booking.originText}
                          </p>
                          <p className="text-sm tracking-tight text-zinc-500">to</p>
                          <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                            {booking.destinationText}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openBookingMessages(booking.id);
                        }}
                        disabled={openingConversation}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Open messages for booking"
                      >
                        <MessageCircle size={14} />
                        {openingConversation ? "Opening..." : "Message"}
                      </button>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                        CONFIRMED
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedTrip(booking)}
                    className="w-full text-left"
                  >
                    <div className="space-y-2 text-zinc-600">
                      <p className="flex items-center gap-2 text-sm tracking-tight">
                        <CalendarIcon />
                        {formatTimeRange(booking.startsAt, booking.endsAt)}
                      </p>
                      <p className="flex items-center gap-2 text-sm tracking-tight">
                        <UsersIcon />
                        {getSeatDisplayText(booking, viewerUserId)}
                      </p>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <span className="inline-flex rounded-xl bg-zinc-100 px-3 py-1 text-xs tracking-tight text-zinc-500">
                        {toDistanceLabel(booking.distanceCategory)}
                      </span>
                      {bookingPrice ? (
                        <p className="text-2xl font-bold tracking-tight text-emerald-600">
                          {bookingPrice}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedTrip ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm"
          onClick={() => setSelectedTrip(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-details-title"
            tabIndex={-1}
            ref={tripDialogRef}
          >
            <div className="p-6 md:p-8 flex-1">
              <button
                onClick={() => setSelectedTrip(null)}
                aria-label="Close trip details"
                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors z-10"
                ref={closeTripButtonRef}
              >
                <X size={20} />
              </button>

              <div className="mb-8 pr-12 flex items-center justify-between gap-3">
                <h2 id="trip-details-title" className="text-2xl font-bold text-zinc-900">
                  Trip Details
                </h2>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                  CONFIRMED
                </span>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                      <MapPinIcon /> Origin
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-700">
                      {selectedTrip.originText}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                      <MapPinIcon /> Destination
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-700">
                      {selectedTrip.destinationText}
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                    <CalendarIcon /> Trip Window
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 mb-1">
                        Earliest
                      </label>
                      <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                        {format(new Date(selectedTrip.startsAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 mb-1">
                        Latest
                      </label>
                      <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                        {format(new Date(selectedTrip.endsAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                      <UsersIcon /> Seats Booked
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                      {getSeatDisplayText(selectedTrip, viewerUserId)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                      <span className="font-bold text-lg leading-none">$</span> Price
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                      {formatPrice(selectedTrip.priceCents) ?? "TBD"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">Trip Location Sharing</h3>
                      <p className="text-sm text-zinc-600">
                        Latest-location polling only while the trip is active.
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${sharingBadgeClass}`}
                    >
                      {sharingBadgeLabel}
                    </span>
                  </div>

                  {locationTracking.loading ? (
                    <p className="text-sm text-zinc-500">Loading trip location status...</p>
                  ) : null}

                  {viewerIsDriverForSelectedTrip ? (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          void locationTracking.startSharing();
                        }}
                        disabled={
                          locationTracking.starting ||
                          locationTracking.isSharingActive ||
                          !locationTracking.isTripActive
                        }
                        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {locationTracking.starting
                          ? "Starting..."
                          : locationTracking.isSharingActive
                            ? "Trip Sharing Started"
                            : "Start Trip / Share Location"}
                      </button>
                    </div>
                  ) : null}

                  {locationTracking.error ? (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {locationTracking.error}
                    </div>
                  ) : null}

                  {locationTracking.geolocationError ? (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      {locationTracking.geolocationError}
                    </div>
                  ) : null}

                  <div className="mb-4">
                    <TripVisualizationMap
                      key={selectedTrip.id}
                      originMarker={staticTripMarkers?.origin ?? null}
                      destinationMarker={staticTripMarkers?.destination ?? null}
                      driverMarker={driverTripMarker}
                      liveDriverStatus={liveDriverStatus}
                      lastDriverUpdateAt={
                        locationTracking.location?.locationUpdatedAt
                          ? formatLocationTimestamp(
                              locationTracking.location.locationUpdatedAt
                            )
                          : null
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Latitude
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {latitudeDisplay}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Longitude
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {longitudeDisplay}
                      </p>
                    </div>
                  </div>

                  {noLocationYet ? (
                    <p className="mt-2 text-sm text-zinc-500">No location yet</p>
                  ) : null}

                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Last Updated
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {formatLocationTimestamp(
                        locationTracking.location?.locationUpdatedAt ?? null
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-end items-center">
                <button
                  onClick={() => setSelectedTrip(null)}
                  className="px-8 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl shadow-sm transition-colors text-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ProtectedShell>
  );
}
