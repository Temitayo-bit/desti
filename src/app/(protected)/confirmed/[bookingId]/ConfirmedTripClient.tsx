"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, Loader2, Play, Shield, Star } from "lucide-react";
import { ProtectedShell } from "../../_components/ProtectedShell";
import { TripVisualizationMap } from "@/components/TripVisualizationMap";
import { openBookingConversationThread } from "@/lib/booking-conversation";
import { deriveDriverTripMapMarker, deriveStaticTripMapMarkers } from "@/lib/trip-map";
import { useBookingLocationTracking } from "@/lib/use-booking-location-tracking";

const CARD =
  "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6";

/** Top bar (no left sidebar) — matches dashboard home + your trip-detail mockups. */
const TRIP_PAGE_SHELL = {
  activeNav: "dashboard" as const,
  layout: "topnav" as const,
};

export interface ConfirmedTripDetailResponse {
  booking: {
    id: string;
    status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
    seatsBooked: number;
    totalSeatsBooked: number;
    priceCents: number | null;
    completedAt: string | null;
    tripStartedAt: string | null;
    isLocationSharingActive: boolean;
    currentLatitude: number | null;
    currentLongitude: number | null;
    locationUpdatedAt: string | null;
    createdAt: string;
  };
  participantRole: "driver" | "rider";
  source: "ride" | "trip_request";
  parentStatus: string;
  rider: { clerkUserId: string; name: string | null };
  driver: { clerkUserId: string; name: string | null } | null;
  route: {
    originText: string;
    originLatitude: number | null;
    originLongitude: number | null;
    destinationText: string;
    destinationLatitude: number | null;
    destinationLongitude: number | null;
    startsAt: string;
    endsAt: string;
    preferredDepartAt: string | null;
    distanceCategory: string;
    pickupInstructions: string | null;
    dropoffInstructions: string | null;
  };
  preferences: {
    hasAc: boolean | null;
    hasTrunkSpace: boolean | null;
    musicPreference: string | null;
    vehicleType: string | null;
  };
  hasRating: boolean;
  canRate: boolean;
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatMusic(p: string | null): string {
  if (!p) return "—";
  if (p === "MUSIC_ALLOWED") return "Allowed";
  if (p === "NO_MUSIC") return "No music";
  return p;
}

function formatVehicle(v: string | null): string {
  if (!v) return "—";
  return v.replace(/_/g, " ");
}

export function ConfirmedTripClient() {
  const params = useParams();
  const router = useRouter();
  const bookingId = typeof params.bookingId === "string" ? params.bookingId : "";

  const [detail, setDetail] = useState<ConfirmedTripDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingDone, setRatingDone] = useState(false);

  const [openingChat, setOpeningChat] = useState(false);

  const loadDetail = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!bookingId) {
      if (!silent) {
        setLoading(false);
      }
      setNotFound(true);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);
    setNotFound(false);

    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (res.status === 404) {
        setNotFound(true);
        setDetail(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (!silent) {
          setLoadError(
            typeof body?.message === "string"
              ? body.message
              : "Could not load this trip."
          );
          setDetail(null);
        }
        return;
      }
      const data = (await res.json()) as ConfirmedTripDetailResponse;
      setDetail(data);
    } catch {
      if (!silent) {
        setLoadError("Could not load this trip.");
        setDetail(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [bookingId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  /** Poll booking detail while the trip is still confirmed so driver completion syncs to the rider (and vice versa) without a manual refresh. */
  useEffect(() => {
    if (!bookingId || detail?.booking.status !== "CONFIRMED") {
      return;
    }
    const id = window.setInterval(() => {
      void loadDetail({ silent: true });
    }, 6_000);
    return () => {
      window.clearInterval(id);
    };
  }, [bookingId, detail?.booking.status, loadDetail]);

  const viewerIsDriver = detail?.participantRole === "driver";
  const trackingEnabled =
    Boolean(bookingId) && detail?.booking.status === "CONFIRMED";

  const locationTracking = useBookingLocationTracking({
    bookingId: bookingId || null,
    isDriver: viewerIsDriver,
    enabled: trackingEnabled,
    pollIntervalMs: 8_000,
  });

  /** When the driver completes the trip, the location API flips to inactive before GET booking is refetched—refresh booking detail for both sides. */
  const refetchedAfterLocationInactive = useRef(false);
  useEffect(() => {
    if (detail?.booking.status !== "CONFIRMED") {
      refetchedAfterLocationInactive.current = false;
      return;
    }
    if (!locationTracking.isTripActive) {
      if (!refetchedAfterLocationInactive.current) {
        refetchedAfterLocationInactive.current = true;
        void loadDetail({ silent: true });
      }
    } else {
      refetchedAfterLocationInactive.current = false;
    }
  }, [detail?.booking.status, locationTracking.isTripActive, loadDetail]);

  const displayLat =
    locationTracking.location?.latitude ?? detail?.booking.currentLatitude ?? null;
  const displayLng =
    locationTracking.location?.longitude ?? detail?.booking.currentLongitude ?? null;

  const showLiveDriverOnMap = detail?.booking.status === "CONFIRMED";

  // Depend on route scalars, not `detail` identity — otherwise every silent poll creates new
  // marker object references and trips Mapbox re-init in TripVisualizationMap.
  const staticMarkers = useMemo(() => {
    if (!detail) return null;
    return deriveStaticTripMapMarkers({
      originLabel: detail.route.originText,
      originLatitude: detail.route.originLatitude,
      originLongitude: detail.route.originLongitude,
      destinationLabel: detail.route.destinationText,
      destinationLatitude: detail.route.destinationLatitude,
      destinationLongitude: detail.route.destinationLongitude,
    });
  }, [
    detail?.route.destinationLatitude,
    detail?.route.destinationLongitude,
    detail?.route.destinationText,
    detail?.route.originLatitude,
    detail?.route.originLongitude,
    detail?.route.originText,
  ]);

  const driverMarker = useMemo(() => {
    if (!showLiveDriverOnMap) {
      return null;
    }
    return deriveDriverTripMapMarker(displayLat, displayLng);
  }, [displayLat, displayLng, showLiveDriverOnMap]);

  const liveDriverStatus = useMemo(() => {
    if (!detail || detail.booking.status !== "CONFIRMED") {
      return "stopped" as const;
    }
    if (!locationTracking.isTripActive) {
      return "stopped" as const;
    }
    if (locationTracking.isSharingActive) {
      return "updating" as const;
    }
    return "unavailable" as const;
  }, [
    detail,
    locationTracking.isSharingActive,
    locationTracking.isTripActive,
  ]);

  const liveStatusOverride = useMemo(() => {
    if (!detail || detail.booking.status !== "CONFIRMED") {
      return null;
    }
    if (!locationTracking.isTripActive) {
      return null;
    }
    if (!locationTracking.isSharingActive) {
      return "Live driver location is not available yet.";
    }
    if (
      locationTracking.isSharingActive &&
      (displayLat === null || displayLng === null)
    ) {
      return "Live tracking is active. Waiting for the first driver location update.";
    }
    return null;
  }, [
    detail,
    displayLat,
    displayLng,
    locationTracking.isSharingActive,
    locationTracking.isTripActive,
  ]);

  const tripHeadline = useMemo(() => {
    if (!detail) return "";
    if (detail.booking.status === "CANCELLED") return "Trip cancelled";
    if (detail.booking.status === "COMPLETED") return "Trip completed";
    if (detail.booking.isLocationSharingActive) return "Active trip";
    return "Confirmed trip";
  }, [detail]);

  const statusBadge = useMemo(() => {
    if (!detail) return "";
    if (detail.booking.status === "CANCELLED") return "CANCELLED";
    if (detail.booking.status === "COMPLETED") return "COMPLETED";
    if (detail.booking.isLocationSharingActive) return "ACTIVE";
    return "CONFIRMED";
  }, [detail]);

  async function handleStartTrip() {
    setCompleteError(null);
    await locationTracking.startSharing();
    await loadDetail({ silent: true });
  }

  async function handleMarkComplete() {
    if (!bookingId) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setCompleteError(
          typeof body?.message === "string"
            ? body.message
            : "Could not complete trip."
        );
        return;
      }
      await loadDetail({ silent: true });
    } catch {
      setCompleteError("Could not complete trip.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSubmitRating() {
    if (!bookingId || ratingScore === null || ratingScore < 1 || ratingScore > 5) {
      setRatingError("Choose a rating from 1 to 5 stars.");
      return;
    }
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: ratingScore,
          comment: ratingComment.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRatingError(
          typeof body?.message === "string"
            ? body.message
            : "Could not submit feedback."
        );
        return;
      }
      setRatingDone(true);
      await loadDetail({ silent: true });
    } catch {
      setRatingError("Could not submit feedback.");
    } finally {
      setRatingSubmitting(false);
    }
  }

  async function handleMessage() {
    if (!bookingId) return;
    setOpeningChat(true);
    const result = await openBookingConversationThread(bookingId);
    setOpeningChat(false);
    if (!result.ok) {
      return;
    }
    router.push(result.href);
  }

  if (loading) {
    return (
      <ProtectedShell {...TRIP_PAGE_SHELL}>
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading trip…
        </div>
      </ProtectedShell>
    );
  }

  if (notFound) {
    return (
      <ProtectedShell {...TRIP_PAGE_SHELL}>
        <div className={`${CARD} max-w-lg`}>
          <h1 className="text-lg font-semibold text-zinc-900">Trip not found</h1>
          <p className="mt-2 text-sm text-zinc-600">
            This booking does not exist or you do not have access to it.
          </p>
          <Link
            href="/bookings"
            className="mt-4 inline-flex text-sm font-semibold text-emerald-800 hover:underline"
          >
            Back to your trips
          </Link>
        </div>
      </ProtectedShell>
    );
  }

  if (loadError || !detail) {
    return (
      <ProtectedShell {...TRIP_PAGE_SHELL}>
        <div className={`${CARD} max-w-lg border-red-200 bg-red-50 text-red-800`}>
          {loadError ?? "Something went wrong."}
          <button
            type="button"
            onClick={() => void loadDetail()}
            className="mt-3 block text-sm font-semibold underline"
          >
            Try again
          </button>
        </div>
      </ProtectedShell>
    );
  }

  const r = detail.route;
  const showStartTrip =
    viewerIsDriver &&
    detail.booking.status === "CONFIRMED" &&
    !detail.booking.isLocationSharingActive &&
    locationTracking.isTripActive;

  const showMarkComplete =
    viewerIsDriver &&
    detail.booking.status === "CONFIRMED" &&
    detail.booking.isLocationSharingActive &&
    locationTracking.isTripActive;

  const showRatingForm = detail.canRate && !ratingDone && !detail.hasRating;

  return (
    <ProtectedShell {...TRIP_PAGE_SHELL}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/bookings"
              className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900"
            >
              <ChevronLeft className="h-4 w-4" />
              Your trips
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">
                {tripHeadline}
              </h1>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
                {statusBadge}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              {r.originText} → {r.destinationText}
            </p>
            {detail.booking.status === "COMPLETED" && detail.booking.completedAt ? (
              <p className="mt-1 text-sm text-zinc-500">
                Completed{" "}
                {format(new Date(detail.booking.completedAt), "MMM d, yyyy h:mm a")}
              </p>
            ) : null}
          </div>
          <a
            href="https://www.stetson.edu/publicsafety/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Shield className="h-4 w-4" />
            Safety
          </a>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className={CARD}>
              <h2 className="text-lg font-semibold text-zinc-900">Trip details</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">Pickup</p>
                  <p className="mt-1 font-medium text-zinc-900">{r.originText}</p>
                  {r.pickupInstructions ? (
                    <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-sm text-zinc-800">
                      {r.pickupInstructions}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">Drop-off</p>
                  <p className="mt-1 font-medium text-zinc-900">{r.destinationText}</p>
                  {r.dropoffInstructions ? (
                    <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                      {r.dropoffInstructions}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500">When</p>
                    <p className="text-sm text-zinc-800">
                      {format(new Date(r.startsAt), "EEE, MMM d")} —{" "}
                      {format(new Date(r.startsAt), "h:mm a")}
                      <span className="text-zinc-500"> to </span>
                      {format(new Date(r.endsAt), "h:mm a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500">Seats</p>
                    <p className="text-sm text-zinc-800">{detail.booking.seatsBooked}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-500">Price</p>
                    <p className="text-sm text-zinc-800">
                      {formatPrice(detail.booking.priceCents)}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  Booking: {detail.booking.status} ·{" "}
                  {detail.parentStatus === "ACTIVE" ? "Ride" : "Trip"} status:{" "}
                  {detail.parentStatus}
                </div>
              </div>
            </section>

            <section className={CARD}>
              <h2 className="text-lg font-semibold text-zinc-900">Live map</h2>
              <div className="mt-4">
                {locationTracking.loading && detail.booking.status === "CONFIRMED" ? (
                  <p className="mb-3 text-sm text-zinc-500">Syncing live location…</p>
                ) : null}
                {locationTracking.error ? (
                  <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {locationTracking.error}
                  </p>
                ) : null}
                {locationTracking.geolocationError && viewerIsDriver ? (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {locationTracking.geolocationError}
                  </p>
                ) : null}
                <TripVisualizationMap
                  key={detail.booking.id}
                  originMarker={staticMarkers?.origin ?? null}
                  destinationMarker={staticMarkers?.destination ?? null}
                  driverMarker={driverMarker}
                  liveDriverStatus={liveDriverStatus}
                  liveStatusOverride={liveStatusOverride}
                  lastDriverUpdateAt={
                    locationTracking.location?.locationUpdatedAt
                      ? format(
                          new Date(locationTracking.location.locationUpdatedAt),
                          "MMM d, h:mm:ss a"
                        )
                      : detail.booking.locationUpdatedAt
                        ? format(
                            new Date(detail.booking.locationUpdatedAt),
                            "MMM d, h:mm:ss a"
                          )
                        : null
                  }
                />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {viewerIsDriver && detail.booking.status === "CONFIRMED" ? (
              <section
                className={`${CARD} border-emerald-200 bg-gradient-to-b from-emerald-900 to-emerald-950 text-white`}
              >
                <h2 className="text-lg font-semibold">Driver controls</h2>
                {showStartTrip ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleStartTrip()}
                      disabled={locationTracking.starting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-base font-bold text-emerald-900 shadow hover:bg-zinc-100 disabled:opacity-60"
                    >
                      {locationTracking.starting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                      {locationTracking.starting ? "Starting…" : "Start trip"}
                    </button>
                    <p className="mt-2 text-xs text-emerald-100/90">
                      Starts live location sharing. Only begin when riders are in the
                      vehicle.
                    </p>
                  </div>
                ) : null}
                {showMarkComplete ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleMarkComplete()}
                      disabled={completing}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-base font-bold text-emerald-900 shadow hover:bg-zinc-100 disabled:opacity-60"
                    >
                      {completing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : null}
                      {completing ? "Completing…" : "Mark trip complete"}
                    </button>
                    {completeError ? (
                      <p className="mt-2 text-sm text-amber-200">{completeError}</p>
                    ) : null}
                  </div>
                ) : null}
                {!showStartTrip && !showMarkComplete && !locationTracking.isTripActive ? (
                  <p className="mt-3 text-sm text-emerald-100/90">
                    Live tracking and trip start are only available when this booking
                    is in an active trip window on the server.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className={CARD}>
              <h2 className="text-lg font-semibold text-zinc-900">People</h2>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">Driver</p>
                  <p className="mt-1 font-medium text-zinc-900">
                    {detail.driver?.name?.trim() || "Driver"}
                    {detail.participantRole === "driver" ? " (you)" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">Rider</p>
                  <p className="mt-1 font-medium text-zinc-900">
                    {detail.rider.name?.trim() || "Rider"}
                    {detail.participantRole === "rider" ? " (you)" : ""}
                  </p>
                </div>
                {detail.booking.status === "CONFIRMED" ? (
                  <button
                    type="button"
                    onClick={() => void handleMessage()}
                    disabled={openingChat}
                    className="w-full rounded-xl border border-zinc-300 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {openingChat ? "Opening…" : "Message"}
                  </button>
                ) : null}
              </div>
            </section>

            <section className={CARD}>
              <h2 className="text-lg font-semibold text-zinc-900">Ride preferences</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">A/C</dt>
                  <dd className="text-right text-zinc-900">
                    {detail.preferences.hasAc === null
                      ? "—"
                      : detail.preferences.hasAc
                        ? "Cool / on"
                        : "Off"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Trunk</dt>
                  <dd className="text-right text-zinc-900">
                    {detail.preferences.hasTrunkSpace === null
                      ? "—"
                      : detail.preferences.hasTrunkSpace
                        ? "Yes"
                        : "Limited"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Music</dt>
                  <dd className="text-right text-zinc-900">
                    {formatMusic(detail.preferences.musicPreference)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Vehicle</dt>
                  <dd className="text-right text-zinc-900">
                    {formatVehicle(detail.preferences.vehicleType)}
                  </dd>
                </div>
              </dl>
            </section>

            {showRatingForm ? (
              <section className={CARD}>
                <h2 className="text-lg font-semibold text-zinc-900">How was your ride?</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Your feedback helps improve Desti.
                </p>
                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatingScore(n)}
                      className="rounded-lg p-1 text-amber-400 hover:bg-amber-50"
                      aria-label={`${n} stars`}
                    >
                      <Star
                        className="h-8 w-8"
                        fill={ratingScore !== null && n <= ratingScore ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Optional comment"
                  className="mt-3 w-full rounded-xl border border-zinc-200 p-3 text-sm"
                  rows={3}
                />
                {ratingError ? (
                  <p className="mt-2 text-sm text-red-600">{ratingError}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSubmitRating()}
                  disabled={ratingSubmitting || ratingScore === null}
                  className="mt-3 w-full rounded-xl bg-emerald-800 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  {ratingSubmitting ? "Submitting…" : "Submit feedback"}
                </button>
              </section>
            ) : null}

            {detail.hasRating || ratingDone ? (
              <p className="text-sm text-zinc-500">Thanks — your feedback was recorded.</p>
            ) : null}

            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="flex gap-2">
                <Shield className="h-5 w-5 shrink-0 text-zinc-500" />
                <p>
                  Buckle up, avoid phone use while driving, and use Safety resources if
                  you feel unsafe. Share your trip with someone you trust.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </ProtectedShell>
  );
}
