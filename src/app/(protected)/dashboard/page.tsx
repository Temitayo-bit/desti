"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { format, isToday, isTomorrow } from "date-fns";
import { Bell, MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedShell } from "../_components/ProtectedShell";
import {
  type DashboardOfferSummary,
  type DashboardRideSummary,
  type DashboardResponse,
  dedupeBookingsById,
  filterOffersSentForDashboard,
  formatRelativeTime,
  getSeatDisplayText,
  normalizeDashboardBooking,
  offerOutcomeLabel,
} from "@/lib/dashboard";
import { openBookingConversationThread } from "@/lib/booking-conversation";

const MOSS = "#0d3d2e";
const MOSS_CLASS = "text-[#0d3d2e]";
/** Rounded card with soft lift on hover (driving / primary cards). */
const PAGE_CARD_HERO =
  "rounded-2xl border border-zinc-200/70 bg-white shadow-md shadow-zinc-900/5 ring-1 ring-zinc-900/[0.04]";
const PAGE_CARD =
  "rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-900/[0.03]";

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
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-[#0d3d2e]"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const PaperPlaneIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-[#0d3d2e]"
  >
    <path d="M3.714 3.048a.53.53 0 0 1 .746-.211l18.451 8.281a.53.53 0 0 1 0 .966L4.46 20.365a.53.53 0 0 1-.746-.58l2.065-6.743a.53.53 0 0 0 0-.31z" />
    <path d="M6 12h16" />
  </svg>
);

const InboxIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-[#0d3d2e]"
  >
    <path d="M22 12h-4l-3 3h-6l-3-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const CarIcon = ({ className = "text-[#0d3d2e]" }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 16H9m10 0h1l-1.44-4.32A2 2 0 0 0 16.67 10H7.33a2 2 0 0 0-1.89 1.68L4 16h1" />
    <path d="M5 16v2a1 1 0 0 0 1 1h1" />
    <path d="M19 16v2a1 1 0 0 1-1 1h-1" />
    <path d="M9 19h6" />
    <circle cx="7.5" cy="16.5" r="1.5" />
    <circle cx="16.5" cy="16.5" r="1.5" />
  </svg>
);

const ChevronRightIcon = ({ className = "text-zinc-500" }: { className?: string }) => (
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
    <path d="M9 18l6-6-6-6" />
  </svg>
);

function formatPrice(priceCents: number | null): string | null {
  if (priceCents === null) return null;
  return `$${(priceCents / 100).toFixed(2)}`;
}

function formatRiderTime(startIso: string): { date: string; time: string } {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return { date: "Date TBD", time: "" };
  }
  let datePart = format(start, "EEE, MMM d");
  if (isToday(start)) datePart = "Today";
  else if (isTomorrow(start)) datePart = "Tomorrow";
  return { date: datePart, time: format(start, "h:mm a") };
}

function statusPill(tone: "green" | "blue" | "yellow" | "pink"): string {
  if (tone === "green") {
    return "inline-flex items-center rounded-full bg-[#0d3d2e] px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white";
  }
  if (tone === "blue") {
    return "inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-sky-800";
  }
  if (tone === "pink") {
    return "inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-rose-800";
  }
  return "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-800";
}

function formatVehicleType(v: string | null | undefined): string | null {
  if (!v) return null;
  const labels: Record<string, string> = {
    SEDAN: "Sedan",
    SUV: "SUV",
    TRUCK: "Truck",
    VAN: "Van",
    COUPE: "Coupe",
    OTHER: "Vehicle",
  };
  return labels[v] ?? v;
}

function rideAttributeSummary(ride: DashboardRideSummary): string | null {
  const parts: string[] = [];
  if (ride.hasAc === true) parts.push("AC");
  if (ride.hasTrunkSpace === true) parts.push("Trunk");
  if (ride.musicPreference === "MUSIC_ALLOWED") parts.push("Music ok");
  else if (ride.musicPreference === "NO_MUSIC") parts.push("No music");
  if (ride.vehicleType) parts.push(formatVehicleType(ride.vehicleType) ?? ride.vehicleType);
  if (parts.length === 0) return null;
  return parts.join(" \u00B7 ");
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <article
      className={`${PAGE_CARD} p-4 transition-shadow duration-200 hover:shadow-md hover:shadow-zinc-900/5 md:p-5`}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0d3d2e]/12 to-[#0d3d2e]/6 shadow-inner ring-1 ring-[#0d3d2e]/10">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-zinc-900">{value}</p>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}

/**
 * Branded static trip panel: no map, no Mapbox, no route/ETA/tracking—visual summary only.
 */
function DriverRouteVisual({
  originText,
  destinationText,
  statusLabel = "Active",
}: {
  originText: string;
  destinationText: string;
  statusLabel?: string;
}) {
  return (
    <div
      className="relative min-h-[148px] overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0d3d2e] via-[#0f4a3a] to-[#123d30] p-4 text-white md:min-h-full md:w-[200px] md:shrink-0 md:border-b-0 md:border-r"
      role="img"
      aria-label={`From ${originText} to ${destinationText}. Status ${statusLabel}. Static preview, not a map.`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-emerald-400/15 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-sky-300/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)",
          backgroundSize: "14px 14px",
        }}
        aria-hidden
      />
      <div className="absolute right-3 top-3 opacity-25" aria-hidden>
        <CarIcon className="h-9 w-9 text-white/90" />
      </div>
      <span className="relative z-10 inline-flex items-center rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-sm">
        {statusLabel}
      </span>
      <div className="relative z-10 mt-4 max-w-full space-y-1.5 pr-1">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-200/90">From</p>
        <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-white drop-shadow-sm">
          {originText}
        </p>
        <div
          className="flex items-center gap-1.5 py-1.5 text-emerald-200/60"
          aria-hidden
        >
          <span className="h-px w-4 bg-emerald-200/50" />
          <span className="text-xs font-light">to</span>
          <span className="h-px flex-1 bg-gradient-to-r from-emerald-200/50 to-transparent" />
        </div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-200/90">To</p>
        <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-white">{destinationText}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [userFirstName, setUserFirstName] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});
  const [openingConversationBookingId, setOpeningConversationBookingId] = useState<string | null>(
    null
  );
  /** Curated sent-offer rows (pending / accepted / recent rejected) from GET /api/offers/mine */
  const [sentOffersWidget, setSentOffersWidget] = useState<DashboardOfferSummary[]>([]);

  const refreshDashboard = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const [response, sentMineResponse] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/offers/mine?role=driver&limit=30"),
      ]);

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message ?? payload?.error ?? "Failed to load dashboard.";
        throw new Error(message);
      }

      const payload = (await response.json()) as DashboardResponse;
      setDashboard(payload);
      const now = new Date(payload.now);

      if (sentMineResponse.ok) {
        const sentPayload = (await sentMineResponse.json()) as {
          items?: DashboardOfferSummary[];
        };
        setSentOffersWidget(
          filterOffersSentForDashboard(sentPayload.items ?? [], now)
        );
      } else {
        setSentOffersWidget(
          filterOffersSentForDashboard(payload.upcoming.offers.sent ?? [], now)
        );
      }
    } catch (fetchError: unknown) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load dashboard.";
      setError(message);
      if (!silent) {
        setSentOffersWidget([]);
      }
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

    async function fetchMe() {
      try {
        const response = await fetch("/api/me", { signal: controller.signal });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          clerkUserId?: string;
          localUser?: { name?: string | null } | null;
        };
        if (controller.signal.aborted) return;
        setViewerUserId(payload.clerkUserId ?? null);
        const raw = payload.localUser?.name?.trim();
        if (raw) {
          setUserFirstName(raw.split(/\s+/)[0] ?? "there");
        } else {
          setUserFirstName(null);
        }
      } catch {
        // best-effort
      } finally {
        if (!controller.signal.aborted) {
          setMeLoaded(true);
        }
      }
    }

    void fetchMe();
    return () => controller.abort();
  }, []);

  async function runOfferAction(
    offerId: string,
    endpoint: string,
    busyValue: string,
    successMessage: string
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

  const summary = dashboard?.summary;
  const ridesDriving = dashboard?.upcoming.ridesDriving ?? [];
  const receivedOffers = dashboard?.upcoming.offers.received ?? [];

  const normalizedBookings = useMemo(() => {
    return (dashboard?.upcoming.bookings ?? []).map(normalizeDashboardBooking);
  }, [dashboard?.upcoming.bookings]);

  const confirmedBookings = useMemo(
    () => normalizedBookings.filter((b) => b.status === "CONFIRMED"),
    [normalizedBookings]
  );

  const sortedUpcomingConfirmed = useMemo(() => {
    const unique = dedupeBookingsById(confirmedBookings);
    return unique.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }, [confirmedBookings]);

  /** Bookings as a passenger (rider) only */
  const riderUpcomingBookings = useMemo(() => {
    if (!viewerUserId) {
      return sortedUpcomingConfirmed;
    }
    return sortedUpcomingConfirmed.filter((b) => b.riderUserId === viewerUserId);
  }, [viewerUserId, sortedUpcomingConfirmed]);

  const welcome = userFirstName
    ? `Welcome back, ${userFirstName}`
    : "Welcome back";

  return (
    <ProtectedShell activeNav="dashboard" layout="topnav" topNavActive="dashboard">
      <div className="space-y-8">
        {loading ? (
          <div className="space-y-6">
            <div className="h-10 w-2/3 max-w-sm animate-pulse rounded-lg bg-zinc-200" />
            <div className="h-4 w-1/2 max-w-md animate-pulse rounded bg-zinc-200" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className="h-28 animate-pulse rounded-2xl bg-zinc-200" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-zinc-200" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-800">
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
            <header className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 md:text-4xl">
                {welcome}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-zinc-500 md:text-lg">
                Here is what’s coming up for your Stetson travels.
              </p>
            </header>

            {actionNotice ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                  actionNotice.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-red-300 bg-red-50 text-red-800"
                }`}
              >
                {actionNotice.text}
              </div>
            ) : null}

            <section
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Summary stats"
            >
              <StatCard
                title="Active Rides"
                value={summary?.activeRidesDrivingCount ?? 0}
                subtitle="Upcoming rides you are hosting"
                icon={<CarIcon />}
              />
              <StatCard
                title="Confirmed"
                value={summary?.confirmedBookingsCount ?? 0}
                subtitle="Upcoming trips (rider or driver)"
                icon={<CheckCircleIcon />}
              />
              <StatCard
                title="Offers Sent"
                value={summary?.pendingOffersSentCount ?? 0}
                subtitle="Pending approval"
                icon={<PaperPlaneIcon />}
              />
              <StatCard
                title="Offers Recv"
                value={summary?.pendingOffersReceivedCount ?? 0}
                subtitle="Action required"
                icon={<InboxIcon />}
              />
            </section>

            {refreshing ? (
              <p className="text-center text-sm text-zinc-500" aria-live="polite">
                Refreshing&hellip;
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
              <div className="space-y-8 min-w-0">
                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900 sm:text-lg md:text-xl min-w-0">
                      <span
                        className="h-2 w-1.5 rounded-full bg-[#0d3d2e] shadow-sm shadow-[#0d3d2e]/30"
                        aria-hidden
                      />
                      Your Upcoming Rides (Driving)
                    </h2>
                    <Link
                      href="/my-rides"
                      className={`text-sm font-semibold ${MOSS_CLASS} transition hover:underline`}
                    >
                      View All
                    </Link>
                  </div>

                  {ridesDriving.length === 0 ? (
                    <div
                      className={`${PAGE_CARD} p-6 text-sm leading-relaxed text-zinc-500`}
                    >
                      You haven&apos;t posted any rides yet.{" "}
                      <Link className="font-semibold text-[#0d3d2e] hover:underline" href="/post-ride">
                        Post a ride
                      </Link>{" "}
                      to get started.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {ridesDriving.map((ride) => {
                        const start = new Date(ride.earliestDepartAt);
                        const timeLabel = Number.isNaN(start.getTime())
                          ? "Time TBD"
                          : format(start, "h:mm a");
                        const dayLabel = Number.isNaN(start.getTime())
                          ? "Date TBD"
                          : isToday(start)
                            ? "Today"
                            : isTomorrow(start)
                              ? "Tomorrow"
                              : format(start, "EEEE, MMM d");
                        const filled = Math.max(0, ride.seatsTotal - ride.seatsAvailable);
                        const attrLine = rideAttributeSummary(ride);
                        return (
                          <div
                            key={ride.id}
                            className={`${PAGE_CARD_HERO} group overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-900/10 hover:ring-zinc-900/[0.06]`}
                          >
                            <div className="grid md:grid-cols-[minmax(0,200px)_1fr]">
                              <DriverRouteVisual
                                originText={ride.originText}
                                destinationText={ride.destinationText}
                              />
                              <div className="flex flex-col p-4 md:p-5 md:pl-6">
                                <h3 className="text-balance text-lg font-bold leading-snug tracking-tight text-zinc-900 md:text-xl">
                                  {ride.originText}{" "}
                                  <span className="whitespace-nowrap text-[#0d3d2e]/90">→</span>{" "}
                                  {ride.destinationText}
                                </h3>
                                <p className="mt-0.5 text-xs font-medium text-zinc-400">
                                  When &amp; capacity
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50/90 px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm">
                                    <CalendarIcon className="shrink-0 text-[#0d3d2e]/70" /> {dayLabel}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50/90 px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm">
                                    <ClockIcon className="shrink-0 text-[#0d3d2e]/70" /> {timeLabel}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50/90 px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm">
                                    <UsersIcon className="shrink-0 text-[#0d3d2e]/70" />
                                    {filled}/{ride.seatsTotal} seats
                                  </span>
                                </div>
                                {attrLine ? (
                                  <p className="mt-3 text-sm text-zinc-500">
                                    <span className="font-medium text-zinc-600">Amenities </span>
                                    {attrLine}
                                  </p>
                                ) : null}
                                <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100/90 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex -space-x-1.5" aria-hidden>
                                    <span className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-zinc-100 to-zinc-200 ring-1 ring-zinc-200" />
                                    <span className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-zinc-200 to-zinc-300 ring-1 ring-zinc-200" />
                                    <span className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-zinc-50 to-zinc-100 text-center text-[0.6rem] font-bold leading-8 text-zinc-400 ring-1 ring-zinc-200">
                                      +
                                    </span>
                                  </div>
                                  <Link
                                    href={`/rides/${ride.id}`}
                                    className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#0d3d2e] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#0d3d2e]/25 transition hover:bg-[#0a2f24] sm:w-auto"
                                  >
                                    Manage ride
                                    <ChevronRightIcon className="text-white/90" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 md:text-xl">
                      <span
                        className="h-2 w-1.5 rounded-full bg-[#0d3d2e] shadow-sm shadow-[#0d3d2e]/30"
                        aria-hidden
                      />
                      Your Upcoming Bookings
                    </h2>
                    <Link
                      href="/bookings"
                      className={`text-sm font-semibold ${MOSS_CLASS} transition hover:underline`}
                    >
                      View all
                    </Link>
                  </div>

                  {!meLoaded ? (
                    <div className={`${PAGE_CARD} p-5 text-sm text-zinc-500`}>Loading trips&hellip;</div>
                  ) : riderUpcomingBookings.length === 0 ? (
                    <div className={`${PAGE_CARD} p-5 text-sm text-zinc-500`}>
                      No confirmed trips yet.{" "}
                      <Link href="/browse" className="font-medium text-[#0d3d2e] hover:underline">
                        Find a ride
                      </Link>{" "}
                      or{" "}
                      <Link href="/post-ride" className="font-medium text-[#0d3d2e] hover:underline">
                        post one
                      </Link>
                      .
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {riderUpcomingBookings.map((booking) => {
                        const { date, time } = formatRiderTime(booking.startsAt);
                        const vLabel = formatVehicleType(booking.vehicleType);
                        const openingConversation = openingConversationBookingId === booking.id;
                        const viewerIsDriver =
                          Boolean(viewerUserId) && booking.driverUserId === viewerUserId;
                        const viewerIsRider =
                          Boolean(viewerUserId) && booking.riderUserId === viewerUserId;
                        const roleLabel = !viewerUserId
                          ? "Confirmed trip"
                          : viewerIsDriver
                            ? "You are driving"
                            : "You are a passenger";
                        const rolePill = !viewerUserId
                          ? statusPill("blue")
                          : viewerIsDriver
                            ? statusPill("green")
                            : statusPill("blue");
                        return (
                          <div
                            key={booking.id}
                            className={`${PAGE_CARD} group/card relative overflow-hidden shadow-md shadow-zinc-900/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-zinc-900/8`}
                          >
                            <Link
                              href={`/confirmed/${booking.id}`}
                              className="absolute inset-0 z-[1] rounded-2xl"
                              aria-label={`View trip: ${booking.originText} to ${booking.destinationText}`}
                            />
                            <div className="pointer-events-none relative z-[2] h-1.5 w-full bg-gradient-to-r from-[#0d3d2e]/0 via-[#0d3d2e]/20 to-sky-500/25" />
                            <div className="pointer-events-none relative z-[2] p-4 transition group-hover/card:bg-sky-50/25">
                              <div>
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <p className="text-[0.7rem] font-bold uppercase tracking-wide text-zinc-400">
                                    {roleLabel}
                                  </p>
                                  <span className={rolePill}>Confirmed</span>
                                </div>
                                <h3 className="text-balance text-lg font-bold leading-snug tracking-tight text-zinc-900 line-clamp-2">
                                  {booking.originText}{" "}
                                  <span className="whitespace-nowrap text-[#0d3d2e]/90">→</span>{" "}
                                  {booking.destinationText}
                                </h3>
                                <div className="mt-2 space-y-1.5 text-sm text-zinc-600">
                                  <p className="inline-flex items-center gap-1.5">
                                    <CalendarIcon />
                                    {date}
                                    {time ? ` · ${time}` : ""}
                                  </p>
                                  {viewerIsDriver ? (
                                    <p className="inline-flex items-center gap-1.5">
                                      <UsersIcon />
                                      {getSeatDisplayText(booking, viewerUserId)}
                                    </p>
                                  ) : (
                                    <p className="inline-flex items-center gap-1.5">
                                      <MapPinIcon /> Pickup: {booking.originText}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="pointer-events-none relative z-[2] border-t border-zinc-100 bg-zinc-50/80 px-4 py-3">
                              <div>
                                {viewerIsDriver ? (
                                  <p className="text-sm text-zinc-600">
                                    Manage pickups and messages from your trip page.
                                  </p>
                                ) : viewerIsRider ? (
                                  <p className="text-sm text-zinc-800">
                                    <span className="text-zinc-500">Driver </span>
                                    {booking.driverName ?? "—"}
                                    {vLabel ? (
                                      <>
                                        <span className="text-zinc-400"> &middot; </span>
                                        {vLabel}
                                      </>
                                    ) : null}
                                  </p>
                                ) : null}
                              </div>
                              <div className="mt-2 flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => void openBookingMessages(booking.id)}
                                  disabled={openingConversation}
                                  className="pointer-events-auto relative z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-[#0d3d2e] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Message"
                                >
                                  {openingConversation ? "…" : <MessageCircle size={16} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-4 min-w-0">
                <div
                  className={`${PAGE_CARD} overflow-hidden p-4 shadow-md shadow-zinc-900/5 ring-zinc-900/[0.04]`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-bold tracking-tight text-zinc-900">
                      Pending Offers (
                      {summary?.pendingOffersReceivedCount ?? receivedOffers.length})
                    </h2>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d3d2e]/8 ring-1 ring-[#0d3d2e]/10">
                      <Bell className="h-4 w-4 text-[#0d3d2e]" aria-hidden />
                    </span>
                  </div>
                  {receivedOffers.length === 0 ? (
                    <p className="text-sm text-zinc-500">No pending offers</p>
                  ) : (
                    <ul className="space-y-4">
                      {receivedOffers.map((offer) => {
                        const busy = pendingActions[offer.id] ?? null;
                        const isBusy = Boolean(busy);
                        const driverName = offer.driver?.name?.trim() || "A driver";
                        const price = `$${(offer.priceCents / 100).toFixed(2)}`;
                        const seats = offer.seatsOffered;
                        const route = `${offer.tripRequest.originText} → ${offer.tripRequest.destinationText}`;
                        return (
                          <li
                            key={offer.id}
                            className="rounded-xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50/90 to-white p-3.5 shadow-sm"
                          >
                            <p className="font-semibold text-zinc-900">{driverName}</p>
                            <p className="mt-0.5 text-xs text-zinc-500">Offered a ride on your trip request</p>
                            <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{route}</p>
                            <p className="mt-1 text-sm font-semibold text-[#0d3d2e]">
                              {price} &middot; {seats} {seats === 1 ? "seat" : "seats"}
                            </p>
                            {offer.message && (
                              <p className="mt-1 text-xs text-zinc-500 italic">&ldquo;{offer.message}&rdquo;</p>
                            )}
                            <p className="mt-1 text-xs text-zinc-400">
                              Sent {formatRelativeTime(offer.createdAt)}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void runOfferAction(
                                    offer.id,
                                    `/api/offers/${offer.id}/accept`,
                                    "accept",
                                    "Offer accepted."
                                  )
                                }
                                className="flex-1 rounded-lg bg-[#0d3d2e] py-2.5 text-sm font-semibold text-white hover:bg-[#0a2f24] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busy === "accept" ? "Accepting…" : "Accept"}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void runOfferAction(
                                    offer.id,
                                    `/api/offers/${offer.id}/cancel`,
                                    "decline",
                                    "Offer declined."
                                  )
                                }
                                className="flex-1 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busy === "decline" ? "Declining…" : "Decline"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div
                  className={`${PAGE_CARD} p-4 shadow-md shadow-zinc-900/5 ring-zinc-900/[0.04]`}
                >
                  <h2 className="mb-3 text-base font-bold tracking-tight text-zinc-900">
                    Offers sent
                  </h2>
                  {sentOffersWidget.length === 0 ? (
                    <p className="text-sm text-zinc-500">No offers to show</p>
                  ) : (
                    <ul className="space-y-3">
                      {sentOffersWidget.map((offer) => {
                        const isBusy = Boolean(pendingActions[offer.id]);
                        const line = `${offer.tripRequest.originText} → ${offer.tripRequest.destinationText}`;
                        const label = offerOutcomeLabel(offer.status);
                        const statusTone: "green" | "blue" | "yellow" | "pink" =
                          offer.status === "ACCEPTED"
                            ? "green"
                            : offer.status === "CANCELLED"
                              ? "pink"
                              : "yellow";
                        const subline =
                          offer.status === "PENDING"
                            ? "Waiting for response"
                            : offer.status === "ACCEPTED"
                              ? "Offer accepted"
                              : "Offer declined";
                        return (
                          <li
                            key={offer.id}
                            className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 line-clamp-2">{line}</p>
                              <p className="text-xs text-zinc-500">{subline}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={statusPill(statusTone)}>{label}</span>
                              {offer.status === "PENDING" ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void runOfferAction(
                                      offer.id,
                                      `/api/offers/${offer.id}/cancel`,
                                      "cancel",
                                      "Offer cancelled."
                                    )
                                  }
                                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                                >
                                  {isBusy ? "Cancelling…" : "Cancel"}
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Link
                    href="/offers"
                    className="mt-3 inline-block text-sm font-semibold text-[#0d3d2e] hover:underline"
                  >
                    View All Sent Offers
                  </Link>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d3d2e] p-5 text-white shadow-lg shadow-[#0d3d2e]/25 ring-1 ring-black/5">
                  <p className="text-lg font-bold tracking-tight">Going somewhere?</p>
                  <p className="mt-1 text-sm text-white/80">
                    Post a ride or request one to share gas costs and meet fellow Hatters.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href="/post-ride"
                      className="flex w-full items-center justify-center gap-1 rounded-xl bg-white py-3 text-sm font-bold text-[#0d3d2e] hover:bg-zinc-100"
                    >
                      + Post a Ride
                    </Link>
                    <Link
                      href="/browse"
                      className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-white/40 py-3 text-sm font-bold text-white hover:bg-white/10"
                    >
                      <Search className="h-4 w-4" />
                      Find a Ride
                    </Link>
                  </div>
                </div>
              </aside>
            </div>

            <footer className="mt-10 border-t border-zinc-200 pt-8 text-sm text-zinc-500">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className={`text-base font-bold ${MOSS_CLASS}`}>Desti · Stetson</p>
                  <p className="mt-0.5">
                    © {new Date().getFullYear()} Desti · Stetson University. All rights reserved.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link className="hover:underline" href="/profile">
                    Help
                  </Link>
                  <Link className="hover:underline" href="/profile">
                    Safety
                  </Link>
                  <Link className="hover:underline" href="/profile">
                    Terms
                  </Link>
                </div>
              </div>
            </footer>
          </>
        )}
      </div>

    </ProtectedShell>
  );
}
