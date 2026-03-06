"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { ProtectedShell } from "./_components/ProtectedShell";
import {
  type DashboardOfferSummary,
  type DashboardBookingItem,
  type NormalizedDashboardBooking,
  type DashboardResponse,
  formatRelativeTime,
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

const ClockIcon = ({ className = "text-zinc-500" }: { className?: string }) => (
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
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
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

const CheckCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const PaperPlaneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
    <path d="M3.714 3.048a.53.53 0 0 1 .746-.211l18.451 8.281a.53.53 0 0 1 0 .966L4.46 20.365a.53.53 0 0 1-.746-.58l2.065-6.743a.53.53 0 0 0 0-.31z" />
    <path d="M6 12h16" />
  </svg>
);

const InboxIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
    <path d="M22 12h-4l-3 3h-6l-3-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const CarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
    <path d="M14 16H9m10 0h1l-1.44-4.32A2 2 0 0 0 16.67 10H7.33a2 2 0 0 0-1.89 1.68L4 16h1" />
    <path d="M5 16v2a1 1 0 0 0 1 1h1" />
    <path d="M19 16v2a1 1 0 0 1-1 1h-1" />
    <path d="M9 19h6" />
    <circle cx="7.5" cy="16.5" r="1.5" />
    <circle cx="16.5" cy="16.5" r="1.5" />
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

    if (start.toDateString() === end.toDateString()) {
      return `${format(start, "MMM d, h:mm a")} -> ${format(end, "MMM d, h:mm a")}`;
    }

    return `${format(start, "MMM d, h:mm a")} -> ${format(end, "MMM d, h:mm a")}`;
  } catch {
    return "Time TBD";
  }
}

function statusPill(tone: "green" | "blue" | "yellow"): string {
  if (tone === "green") {
    return "inline-flex items-center rounded-2xl bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700";
  }
  if (tone === "blue") {
    return "inline-flex items-center rounded-2xl bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700";
  }
  return "inline-flex items-center rounded-2xl bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700";
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="w-[280px] shrink-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50">
          {icon}
        </div>
        <div>
          <p className="text-lg font-medium tracking-tight text-zinc-600">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-zinc-900">{value}</p>
        </div>
      </div>
    </article>
  );
}

function OfferCard({
  offer,
  children,
}: {
  offer: DashboardOfferSummary;
  children: React.ReactNode;
}) {
  return (
    <article className={CARD_CLASS}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start gap-2">
            <MapPinIcon className="mt-1 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">{offer.tripRequest.originText}</p>
              <p className="text-sm tracking-tight text-zinc-500">to</p>
              <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">{offer.tripRequest.destinationText}</p>
            </div>
          </div>
        </div>
        <span className={statusPill("yellow")}>PENDING</span>
      </div>

      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2 text-zinc-600">
          <p className="flex items-center gap-2 text-sm tracking-tight">
            <UsersIcon className="text-zinc-500" />
            {offer.seatsOffered} {offer.seatsOffered === 1 ? "seat" : "seats"}
          </p>
          <p className="flex items-center gap-2 text-sm tracking-tight">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatRelativeTime(offer.createdAt)}
          </p>
        </div>
        <p className="text-2xl font-bold tracking-tight text-emerald-600">{formatPrice(offer.priceCents)}</p>
      </div>

      {children}
    </article>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<NormalizedDashboardBooking | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});
  const tripDialogRef = useRef<HTMLDivElement | null>(null);
  const closeTripButtonRef = useRef<HTMLButtonElement | null>(null);

  const refreshDashboard = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message ?? payload?.error ?? "Failed to load dashboard.";
        throw new Error(message);
      }

      const payload = (await response.json()) as DashboardResponse;
      setDashboard(payload);
    } catch (fetchError: unknown) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load dashboard.";
      setError(message);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchViewer() {
      try {
        const response = await fetch("/api/me", { signal: controller.signal });
        if (!response.ok) return;
        const payload = (await response.json()) as { clerkUserId?: string };
        if (!controller.signal.aborted) {
          setViewerUserId(payload.clerkUserId ?? null);
        }
      } catch {
        // Best-effort lookup for role-aware seat labels.
      }
    }

    void fetchViewer();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedTrip) return;
    closeTripButtonRef.current?.focus();
    if (!closeTripButtonRef.current) {
      tripDialogRef.current?.focus();
    }
  }, [selectedTrip]);

  async function runOfferAction(
    offerId: string,
    endpoint: string,
    busyValue: string,
    successMessage: string,
  ) {
    setActionNotice(null);
    setPendingActions((prev) => ({ ...prev, [offerId]: busyValue }));

    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message ?? payload?.error ?? "Could not complete offer action.";
        throw new Error(message);
      }

      setActionNotice({ type: "success", text: successMessage });
      await refreshDashboard({ silent: true });
    } catch (actionError: unknown) {
      const message =
        actionError instanceof Error ? actionError.message : "Offer action failed.";
      setActionNotice({ type: "error", text: message });
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[offerId];
        return next;
      });
    }
  }

  const summary = dashboard?.summary;
  const normalizedBookings = useMemo(() => {
    const bookings = (dashboard?.upcoming.bookings ?? []) as DashboardBookingItem[];
    return bookings.map(normalizeDashboardBooking);
  }, [dashboard?.upcoming.bookings]);
  const sentOffers = dashboard?.upcoming.offers.sent ?? [];
  const receivedOffers = dashboard?.upcoming.offers.received ?? [];

  return (
    <ProtectedShell activeNav="dashboard">
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-zinc-500 text-lg md:text-xl">
            Your upcoming trips and offers
          </p>
        </header>

        {loading ? (
          <div className="space-y-5">
            <div className="h-32 animate-pulse rounded-3xl bg-zinc-200" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="h-72 animate-pulse rounded-3xl bg-zinc-200" />
              <div className="h-72 animate-pulse rounded-3xl bg-zinc-200" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-300 bg-red-50 p-6 text-red-700">
            <p className="text-lg font-semibold">Unable to load dashboard</p>
            <p className="mt-2 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex min-w-max gap-4 pb-2">
                <MetricCard
                  title="Active Rides Driving"
                  value={summary?.activeRidesDrivingCount ?? 0}
                  icon={<CarIcon />}
                />
                <MetricCard
                  title="Confirmed Bookings"
                  value={summary?.confirmedBookingsCount ?? 0}
                  icon={<CheckCircleIcon />}
                />
                <MetricCard
                  title="Offers Sent"
                  value={summary?.pendingOffersSentCount ?? 0}
                  icon={<PaperPlaneIcon />}
                />
                <MetricCard
                  title="Offers Received"
                  value={summary?.pendingOffersReceivedCount ?? 0}
                  icon={<InboxIcon />}
                />
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">Your Upcoming Trips</h2>
                {/* TODO: Wire this to a dedicated bookings list route when available. */}
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-400"
                >
                  View All
                </button>
              </div>

              {normalizedBookings.length === 0 ? (
                <div className={`${CARD_CLASS} text-zinc-500`}>
                  You do not have confirmed upcoming trips yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {normalizedBookings.map((booking) => {
                    const bookingPrice = formatPrice(booking.priceCents);
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedTrip(booking)}
                        className={`${CARD_CLASS} w-full text-left transition-all hover:border-emerald-500/50 hover:shadow-md`}
                      >
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-start gap-2">
                              <MapPinIcon className="mt-1 shrink-0 text-zinc-400" />
                              <div className="min-w-0">
                                <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">{booking.originText}</p>
                                <p className="text-sm tracking-tight text-zinc-500">to</p>
                                <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">{booking.destinationText}</p>
                              </div>
                            </div>
                          </div>
                          <span className={statusPill("blue")}>CONFIRMED</span>
                        </div>

                        <div className="space-y-2 text-zinc-600">
                          <p className="flex items-center gap-2 text-sm tracking-tight">
                            <CalendarIcon />
                            {formatTimeRange(booking.startsAt, booking.endsAt)}
                          </p>
                          {booking.driverName ? (
                            <p className="flex items-center gap-2 text-sm tracking-tight">
                              <UsersIcon />
                              Driver: {booking.driverName}
                            </p>
                          ) : null}
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
                            <p className="text-2xl font-bold tracking-tight text-emerald-600">{bookingPrice}</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">Pending Offers</h2>
                {/* TODO: Wire this to a dedicated offers list route when available. */}
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-400"
                >
                  View All
                </button>
              </div>

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

              {refreshing ? (
                <p className="text-sm text-zinc-500">Refreshing dashboard data...</p>
              ) : null}

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900">Offers Sent</h3>
                  {sentOffers.length === 0 ? (
                    <div className={`${CARD_CLASS} text-zinc-500`}>No pending offers sent.</div>
                  ) : (
                    sentOffers.map((offer) => {
                      const isBusy = Boolean(pendingActions[offer.id]);
                      return (
                        <OfferCard key={offer.id} offer={offer}>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void runOfferAction(
                                offer.id,
                                `/api/offers/${offer.id}/cancel`,
                                "cancel",
                                "Offer cancelled.",
                              )
                            }
                            className="w-full rounded-2xl border border-zinc-300 px-5 py-3 text-lg font-semibold tracking-tight text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? "Cancelling..." : "Cancel Offer"}
                          </button>
                        </OfferCard>
                      );
                    })
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900">Offers Received</h3>
                  {receivedOffers.length === 0 ? (
                    <div className={`${CARD_CLASS} text-zinc-500`}>No pending offers received.</div>
                  ) : (
                    receivedOffers.map((offer) => {
                      const busyAction = pendingActions[offer.id] ?? null;
                      const isBusy = Boolean(busyAction);
                      return (
                        <OfferCard key={offer.id} offer={offer}>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void runOfferAction(
                                  offer.id,
                                  `/api/offers/${offer.id}/accept`,
                                  "accept",
                                  "Offer accepted.",
                                )
                              }
                              className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-lg font-semibold tracking-tight text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyAction === "accept" ? "Accepting..." : "Accept"}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void runOfferAction(
                                  offer.id,
                                  `/api/offers/${offer.id}/cancel`,
                                  "decline",
                                  "Offer declined.",
                                )
                              }
                              className="w-full rounded-2xl border border-zinc-300 px-5 py-3 text-lg font-semibold tracking-tight text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyAction === "decline" ? "Declining..." : "Decline"}
                            </button>
                          </div>
                        </OfferCard>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </>
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
                <h2 id="trip-details-title" className="text-2xl font-bold text-zinc-900">Trip Details</h2>
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
                    <ClockIcon /> Trip Window
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 mb-1">Earliest</label>
                      <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                        {format(new Date(selectedTrip.startsAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 mb-1">Latest</label>
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

                {selectedTrip.driverName ? (
                  <div className="pt-2">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
                      <p><span className="font-semibold">Driver:</span> {selectedTrip.driverName}</p>
                    </div>
                  </div>
                ) : null}
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
