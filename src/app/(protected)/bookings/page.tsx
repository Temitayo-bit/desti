"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, Clock, MapPin, MessageCircle, Users } from "lucide-react";
import { ProtectedShell } from "../_components/ProtectedShell";
import { openBookingConversationThread } from "@/lib/booking-conversation";
import { formatDistanceMiles } from "@/lib/distance-category";
import {
  type DashboardBookingItem,
  getSeatDisplayText,
  normalizeDashboardBooking,
} from "@/lib/dashboard";

type ActionNotice =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

interface DashboardBookingsResponse {
  now: string;
  items: DashboardBookingItem[];
}

function formatPrice(priceCents: number | null): string | null {
  if (priceCents === null) return null;
  return `$${(priceCents / 100).toFixed(2)}`;
}

function formatTripWindow(startIso: string, endIso: string): string {
  try {
    const d1 = new Date(startIso);
    const d2 = new Date(endIso);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
      return "Time TBD";
    }
    if (d1.toDateString() === d2.toDateString()) {
      if (d1.toDateString() === new Date().toDateString()) {
        return `Today ${format(d1, "h:mm a")} – ${format(d2, "h:mm a")}`;
      }
      return `${format(d1, "MMM d, h:mm a")} – ${format(d2, "h:mm a")}`;
    }
    return `${format(d1, "MMM d, h:mm a")} – ${format(d2, "MMM d, h:mm a")}`;
  } catch {
    return "Time TBD";
  }
}

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<DashboardBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [openingConversationBookingId, setOpeningConversationBookingId] = useState<string | null>(null);

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

  const normalizedBookings = useMemo(
    () => bookings.map(normalizeDashboardBooking),
    [bookings]
  );

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
    <ProtectedShell
      activeNav="dashboard"
      layout="topnav"
      topNavActive="dashboard"
    >
      <div className="overflow-hidden rounded-3xl bg-[#006837] shadow-sm">
        <div className="px-5 py-7 md:px-8 md:py-9">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Your upcoming trips from DeLand.
          </h1>
          <p className="mt-1 text-sm text-white/90">
            Every confirmed trip where you&apos;re the rider or driver—open a trip to message,
            start, and track the ride.
          </p>
          <div className="mt-5 rounded-2xl bg-white p-3 sm:px-4 sm:py-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-900">
                  {loading ? "…" : normalizedBookings.length}
                </span>{" "}
                {loading
                  ? "trips"
                  : normalizedBookings.length === 1
                    ? "upcoming trip"
                    : "upcoming trips"}{" "}
                on your calendar
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-[#006837] transition hover:underline sm:self-auto"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {actionNotice ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
            actionNotice.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {actionNotice.text}
        </div>
      ) : null}

      <div className="mt-1 min-w-0 space-y-4">
        <div className="mb-1 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="text-lg font-bold text-zinc-900">
            Confirmed trips (
            {loading && normalizedBookings.length === 0
              ? "…"
              : normalizedBookings.length}
            )
          </h2>
        </div>

        {loading && normalizedBookings.length === 0 ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : normalizedBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 py-16 text-center">
            <h3 className="text-lg font-bold text-zinc-900">No upcoming trips</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
              You don&apos;t have any confirmed trips scheduled yet. Book a ride or post one from
              the dashboard.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm font-semibold text-[#006837] hover:underline"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {normalizedBookings.map((booking) => {
              const bookingPrice = formatPrice(booking.priceCents);
              const openingConversation = openingConversationBookingId === booking.id;
              const timeLabel = formatTripWindow(booking.startsAt, booking.endsAt);
              const distLabel = formatDistanceMiles(booking.originLatitude, booking.originLongitude, booking.destinationLatitude, booking.destinationLongitude) ?? booking.distanceCategory.toLowerCase();

              return (
                <article
                  key={booking.id}
                  className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white pl-1 text-left shadow-sm transition-all hover:border-[#006837]/50 hover:shadow-md"
                >
                  <Link
                    href={`/confirmed/${booking.id}`}
                    className="absolute inset-0 z-[1] rounded-2xl"
                    aria-label={`View trip: ${booking.originText} to ${booking.destinationText}`}
                  />
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 w-1 bg-[#006837]"
                    aria-hidden
                  />
                  <div className="pointer-events-none relative z-[2] p-4 pl-5 sm:p-5 sm:pl-6">
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
                              {booking.originText}
                            </p>
                            <p className="pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-zinc-400">
                              Destination
                            </p>
                            <p className="text-sm font-semibold text-zinc-900">
                              {booking.destinationText}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right sm:pl-4">
                        {bookingPrice ? (
                          <>
                            <p className="text-2xl font-bold text-[#006837]">{bookingPrice}</p>
                            <p className="text-xs text-zinc-500">trip total</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-zinc-400">—</p>
                            <p className="text-xs text-zinc-500">Price TBD</p>
                          </>
                        )}
                        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Status
                        </p>
                        <p className="text-sm font-semibold text-zinc-800">Confirmed</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" strokeWidth={2} />
                          {timeLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                          <Users className="h-3.5 w-3.5 shrink-0 text-zinc-500" strokeWidth={2} />
                          {getSeatDisplayText(booking, viewerUserId)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                          <MapPin
                            className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                            strokeWidth={2}
                          />
                          {distLabel}
                        </span>
                      </div>
                      <div className="flex w-full justify-end sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            void openBookingMessages(booking.id);
                          }}
                          disabled={openingConversation}
                          className="pointer-events-auto relative z-20 inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden />
                          {openingConversation ? "Opening…" : "Message"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedShell>
  );
}
