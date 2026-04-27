"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProtectedShell } from "../_components/ProtectedShell";
import {
  type DashboardOfferSummary,
  formatRelativeTime,
  toDistanceLabel,
} from "@/lib/dashboard";

const CARD_CLASS =
  "bg-white border border-zinc-200 rounded-2xl p-4 md:p-6 shadow-sm";

type ActionNotice =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

interface OffersMineApiResponse {
  items: DashboardOfferSummary[];
  nextCursor: string | null;
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

function formatPrice(priceCents: number): string {
  return `$ ${(priceCents / 100).toFixed(2)}`;
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
        <span className="inline-flex items-center rounded-2xl bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
          PENDING
        </span>
      </div>

      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2 text-zinc-600">
          <p className="flex items-center gap-2 text-sm tracking-tight">
            <ClockIcon />
            {new Date(offer.tripRequest.earliestDesiredAt).toLocaleString()} {"->"}{" "}
            {new Date(offer.tripRequest.latestDesiredAt).toLocaleString()}
          </p>
          <p className="flex items-center gap-2 text-sm tracking-tight">
            <UsersIcon />
            {offer.seatsOffered} {offer.seatsOffered === 1 ? "seat" : "seats"} offered
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {toDistanceLabel(offer.tripRequest.distanceCategory)}
          </p>
          <p className="flex items-center gap-2 text-sm tracking-tight text-zinc-500">
            <ClockIcon className="text-zinc-400" />
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

export default function OffersPage() {
  const [sentOffers, setSentOffers] = useState<DashboardOfferSummary[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<DashboardOfferSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});

  const fetchPendingOffersByRole = useCallback(
    async (role: "driver" | "rider") => {
      const items: DashboardOfferSummary[] = [];
      let nextCursor: string | null = null;

      do {
        const search = new URLSearchParams({
          role,
          status: "PENDING",
          limit: "50",
        });

        if (nextCursor) {
          search.set("cursor", nextCursor);
        }

        const response = await fetch(`/api/offers/mine?${search.toString()}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload?.message ?? payload?.error ?? "Failed to load pending offers.";
          throw new Error(message);
        }

        const payload = (await response.json()) as OffersMineApiResponse;
        items.push(...(payload.items ?? []));
        nextCursor = payload.nextCursor ?? null;
      } while (nextCursor);

      return items;
    },
    []
  );

  const refreshOffers = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const [sent, received] = await Promise.all([
          fetchPendingOffersByRole("driver"),
          fetchPendingOffersByRole("rider"),
        ]);

        setSentOffers(sent);
        setReceivedOffers(received);
      } catch (fetchError: unknown) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load pending offers."
        );
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [fetchPendingOffersByRole]
  );

  useEffect(() => {
    void refreshOffers();
  }, [refreshOffers]);

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
        const message =
          payload?.message ?? payload?.error ?? "Could not complete offer action.";
        throw new Error(message);
      }

      setActionNotice({ type: "success", text: successMessage });
      await refreshOffers({ silent: true });
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

  return (
    <ProtectedShell
      activeNav="dashboard"
    >
      <section className="space-y-6 md:space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900"
        >
          <ChevronLeft size={16} />
          Back to dashboard
        </Link>

        <div className="overflow-hidden rounded-3xl bg-[#006837] shadow-sm">
          <div className="px-5 py-7 md:px-8 md:py-9">
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Pending Offers
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Review every outstanding offer you have sent or received.
            </p>
            <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                <p className="text-sm font-medium text-white/80">Sent</p>
                <p className="text-2xl font-bold tracking-tight md:text-3xl">
                  {sentOffers.length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                <p className="text-sm font-medium text-white/80">Received</p>
                <p className="text-2xl font-bold tracking-tight md:text-3xl">
                  {receivedOffers.length}
                </p>
              </div>
            </div>
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

        {refreshing ? (
          <p className="text-sm text-zinc-500">Refreshing offers...</p>
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
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900">
                Offers Sent
              </h2>
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
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900">
                Offers Received
              </h2>
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
        )}
      </section>
    </ProtectedShell>
  );
}
