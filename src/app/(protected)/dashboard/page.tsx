"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format } from "date-fns";
import { MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProtectedShell } from "../_components/ProtectedShell";
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
import { openBookingConversationThread } from "@/lib/booking-conversation";

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
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-emerald-600"
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
    className="text-emerald-600"
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
    className="text-emerald-600"
  >
    <path d="M22 12h-4l-3 3h-6l-3-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const CarIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-emerald-600"
  >
    <path d="M14 16H9m10 0h1l-1.44-4.32A2 2 0 0 0 16.67 10H7.33a2 2 0 0 0-1.89 1.68L4 16h1" />
    <path d="M5 16v2a1 1 0 0 0 1 1h1" />
    <path d="M19 16v2a1 1 0 0 1-1 1h-1" />
    <path d="M9 19h6" />
    <circle cx="7.5" cy="16.5" r="1.5" />
    <circle cx="16.5" cy="16.5" r="1.5" />
  </svg>
);

const ArrowRightIcon = ({ className = "text-zinc-500" }: { className?: string }) => (
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
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const LightningIcon = ({ className = "text-emerald-700" }: { className?: string }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
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
  icon: ReactNode;
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
  children: ReactNode;
}) {
  return (
    <article className={CARD_CLASS}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start gap-2">
            <MapPinIcon className="mt-1 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                {offer.tripRequest.originText}
              </p>
              <p className="text-sm tracking-tight text-zinc-500">to</p>
              <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                {offer.tripRequest.destinationText}
              </p>
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
            <ClockIcon className="text-zinc-500" />
            {formatRelativeTime(offer.createdAt)}
          </p>
        </div>
        <p className="text-2xl font-bold tracking-tight text-emerald-600">
          {formatPrice(offer.priceCents)}
        </p>
      </div>

      {children}
    </article>
  );
}

function QuickActionButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
    >
      <div>
        <p className="text-sm font-semibold tracking-tight text-zinc-900">{title}</p>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <ArrowRightIcon className="shrink-0 text-zinc-400" />
    </button>
  );
}

function AttentionCard({
  title,
  description,
  label,
  onClick,
  tone = "amber",
}: {
  title: string;
  description: string;
  label: string;
  onClick: () => void;
  tone?: "amber" | "emerald" | "blue";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "blue"
        ? "border-blue-200 bg-blue-50"
        : "border-amber-200 bg-amber-50";

  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/80">
          <LightningIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
          <button
            type="button"
            onClick={onClick}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-emerald-700"
          >
            {label}
            <ArrowRightIcon className="text-current" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<NormalizedDashboardBooking | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});
  const [openingConversationBookingId, setOpeningConversationBookingId] = useState<string | null>(null);
  const tripDialogRef = useRef<HTMLDivElement | null>(null);
  const closeTripButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingOffersSectionRef = useRef<HTMLElement | null>(null);

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

  const normalizedBookings = useMemo(() => {
    const bookings = (dashboard?.upcoming.bookings ?? []) as DashboardBookingItem[];
    return bookings.map(normalizeDashboardBooking);
  }, [dashboard?.upcoming.bookings]);

  const sortedBookings = useMemo(() => {
    return [...normalizedBookings].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }, [normalizedBookings]);

  const nextTrip = sortedBookings[0] ?? null;
  const sentOffers = dashboard?.upcoming.offers.sent ?? [];
  const receivedOffers = dashboard?.upcoming.offers.received ?? [];
  const ridesDriving = dashboard?.upcoming.ridesDriving ?? [];

  const hasAnyActivity =
    normalizedBookings.length > 0 ||
    sentOffers.length > 0 ||
    receivedOffers.length > 0 ||
    ridesDriving.length > 0;

  const needsAttentionCount =
    receivedOffers.length + (nextTrip ? 1 : 0) + (normalizedBookings.length === 0 ? 1 : 0);

  return (
    <ProtectedShell activeNav="dashboard">
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
            Dashboard
          </h1>
          <p className="text-lg text-zinc-500 md:text-xl">
            What needs your attention and what’s coming up next.
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

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Needs attention
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                      Your next actions
                    </h2>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                    {needsAttentionCount} {needsAttentionCount === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {receivedOffers.length > 0 ? (
                    <AttentionCard
                      title={`${receivedOffers.length} incoming ${receivedOffers.length === 1 ? "offer" : "offers"} waiting`}
                      description="Review pending offers so riders are not left waiting."
                      label="Review offers"
                      onClick={() =>
                        pendingOffersSectionRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                      }
                    />
                  ) : null}

                  {nextTrip ? (
                    <AttentionCard
                      title="Your next confirmed trip is coming up"
                      description={`${nextTrip.originText} to ${nextTrip.destinationText} • ${format(
                        new Date(nextTrip.startsAt),
                        "MMM d, h:mm a"
                      )}`}
                      label="View trip details"
                      onClick={() => setSelectedTrip(nextTrip)}
                      tone="blue"
                    />
                  ) : null}

                  {normalizedBookings.length === 0 ? (
                    <AttentionCard
                      title="No confirmed trips yet"
                      description="Browse available rides or post your own ride request to get moving."
                      label="Browse rides"
                      onClick={() => router.push("/browse")}
                      tone="emerald"
                    />
                  ) : null}

                  {receivedOffers.length === 0 && nextTrip && sentOffers.length > 0 ? (
                    <AttentionCard
                      title="You still have offers pending"
                      description={`${sentOffers.length} ${sentOffers.length === 1 ? "offer is" : "offers are"} still awaiting a response.`}
                      label="Check offers"
                      onClick={() =>
                        pendingOffersSectionRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                      }
                      tone="emerald"
                    />
                  ) : null}

                  {!hasAnyActivity ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 md:col-span-2">
                      <p className="text-lg font-semibold tracking-tight text-zinc-900">
                        You’re all set to start.
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">
                        Post a ride, browse rides, or create a trip request to start using Desti.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Quick actions
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                    Jump back in
                  </h2>
                </div>

                <div className="space-y-3">
                  <QuickActionButton
                    title="Browse rides"
                    subtitle="Find your next ride quickly."
                    onClick={() => router.push("/browse")}
                  />
                  <QuickActionButton
                    title="Post a ride"
                    subtitle="Share empty seats with other students."
                    onClick={() => router.push("/post-ride")}
                  />
                  <QuickActionButton
                    title="Browse trip requests"
                    subtitle="See who still needs a ride."
                    onClick={() => router.push("/browse-trip-requests")}
                  />
                  <QuickActionButton
                    title="Post a trip request"
                    subtitle="Let drivers send offers to you."
                    onClick={() => router.push("/post-trip-request")}
                  />
                </div>
              </div>
            </section>

            {nextTrip ? (
              <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Next up
                    </p>
                    <div className="mt-3 flex items-start gap-3">
                      <MapPinIcon className="mt-1 shrink-0 text-emerald-700" />
                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-bold tracking-tight text-zinc-900">
                          {nextTrip.originText}
                        </h2>
                        <p className="text-sm text-zinc-500">to</p>
                        <h3 className="truncate text-2xl font-bold tracking-tight text-zinc-900">
                          {nextTrip.destinationText}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-zinc-600">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
                        <CalendarIcon />
                        {formatTimeRange(nextTrip.startsAt, nextTrip.endsAt)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
                        <UsersIcon />
                        {getSeatDisplayText(nextTrip, viewerUserId)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1.5 shadow-sm">
                        {toDistanceLabel(nextTrip.distanceCategory)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setSelectedTrip(nextTrip)}
                      className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      View trip details
                    </button>
                    <button
                      type="button"
                      onClick={() => void openBookingMessages(nextTrip.id)}
                      disabled={openingConversationBookingId === nextTrip.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MessageCircle size={16} />
                      {openingConversationBookingId === nextTrip.id ? "Opening..." : "Message"}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
                    Your Upcoming Trips
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Confirmed bookings and ride details you can act on now.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {normalizedBookings.length} {normalizedBookings.length === 1 ? "trip" : "trips"}
                </span>
              </div>

              {normalizedBookings.length === 0 ? (
                <div className={`${CARD_CLASS} text-zinc-500`}>
                  You do not have confirmed upcoming trips yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {sortedBookings.map((booking) => {
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
                            <span className={statusPill("blue")}>CONFIRMED</span>
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

            <section ref={pendingOffersSectionRef} className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
                    Pending Offers
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Review offers you sent and decide on offers you received.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {sentOffers.length + receivedOffers.length} open
                </span>
              </div>

              {refreshing ? (
                <p className="text-sm text-zinc-500">Refreshing dashboard data...</p>
              ) : null}

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
                    Offers Sent
                  </h3>

                  {sentOffers.length === 0 ? (
                    <div className={`${CARD_CLASS} text-zinc-500`}>
                      No pending offers sent.
                    </div>
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
                                "Offer cancelled."
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
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
                    Offers Received
                  </h3>

                  {receivedOffers.length === 0 ? (
                    <div className={`${CARD_CLASS} text-zinc-500`}>
                      No pending offers received.
                    </div>
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
                                  "Offer accepted."
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
                                  "Offer declined."
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedTrip(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-details-title"
            tabIndex={-1}
            ref={tripDialogRef}
          >
            <div className="flex-1 p-6 md:p-8">
              <button
                onClick={() => setSelectedTrip(null)}
                aria-label="Close trip details"
                className="absolute right-6 top-6 z-10 rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                ref={closeTripButtonRef}
              >
                <X size={20} />
              </button>

              <div className="mb-8 flex items-center justify-between gap-3 pr-12">
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
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <MapPinIcon /> Origin
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-700">
                      {selectedTrip.originText}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <MapPinIcon /> Destination
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-700">
                      {selectedTrip.destinationText}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:p-6">
                  <div className="mb-4 flex items-center gap-2 text-lg font-bold text-emerald-800">
                    <ClockIcon /> Trip Window
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-600">
                        Earliest
                      </label>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 text-zinc-800 shadow-sm">
                        {format(new Date(selectedTrip.startsAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-600">
                        Latest
                      </label>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 text-zinc-800 shadow-sm">
                        {format(new Date(selectedTrip.endsAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-800">
                      <UsersIcon /> Seats Booked
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-lg font-medium text-zinc-800">
                      {getSeatDisplayText(selectedTrip, viewerUserId)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-800">
                      <span className="text-lg font-bold leading-none">$</span> Price
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-lg font-medium text-zinc-800">
                      {formatPrice(selectedTrip.priceCents) ?? "TBD"}
                    </div>
                  </div>
                </div>

                {selectedTrip.driverName ? (
                  <div className="pt-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-900">
                      <p>
                        <span className="font-semibold">Driver:</span> {selectedTrip.driverName}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 flex items-center justify-end gap-3 border-t border-zinc-100 pt-6">
                <button
                  onClick={() => void openBookingMessages(selectedTrip.id)}
                  disabled={openingConversationBookingId === selectedTrip.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageCircle size={16} />
                  {openingConversationBookingId === selectedTrip.id ? "Opening..." : "Message"}
                </button>
                <button
                  onClick={() => setSelectedTrip(null)}
                  className="rounded-xl bg-emerald-800 px-8 py-2.5 text-lg font-medium text-white shadow-sm transition-colors hover:bg-emerald-900"
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
