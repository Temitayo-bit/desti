"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Calendar, Check, ChevronRight, MapPin, MoreHorizontal, Shield } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { StaticRouteMap } from "@/components/StaticRouteMap";
import { getMapboxPublicAccessToken } from "@/lib/mapbox-location-autocomplete";

interface OfferTripRequestSnippet {
  id: string;
  originText: string;
  destinationText: string;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  earliestDesiredAt: string;
  latestDesiredAt: string;
  preferredDepartAt: string | null;
  distanceCategory: string;
  seatsNeeded: number;
  status: string;
}

export interface RiderIncomingOfferRow {
  id: string;
  tripRequestId: string;
  driverUserId: string;
  riderUserId: string;
  seatsOffered: number;
  priceCents: number;
  message: string | null;
  status: string;
  createdAt: string;
  tripRequest: OfferTripRequestSnippet;
}

interface TripRequestMine {
  id: string;
  originText: string;
  destinationText: string;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  earliestDesiredAt: string;
  latestDesiredAt: string;
  distanceCategory: string;
  seatsNeeded: number;
  pickupInstructions: string | null;
  dropoffInstructions: string | null;
  preferredDepartAt: string | null;
  status: string;
}

interface DriverRatingSummary {
  userId: string;
  averageRating: number | null;
  ratingCount: number;
}

type OfferActionType = "accept" | "cancel";

interface TripRequestOffersViewProps {
  initialRequestId: string | null;
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

async function parseOfferActionError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return (
    payload?.message ??
    payload?.error ??
    "Unable to complete offer action. Please try again."
  );
}

async function fetchMyTripRequests(signal?: AbortSignal): Promise<TripRequestMine[]> {
  const response = await fetch("/api/trip-requests/mine", { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch your trip requests");
  }
  const payload = (await response.json()) as { items?: TripRequestMine[] };
  return payload.items ?? [];
}

async function fetchPendingIncomingOffers(
  signal?: AbortSignal,
): Promise<RiderIncomingOfferRow[]> {
  const allOffers: RiderIncomingOfferRow[] = [];
  let nextCursor: string | null = null;
  let pages = 0;

  do {
    if (pages > 100) throw new Error("Too many offer pages.");
    const search = new URLSearchParams({
      role: "rider",
      status: "PENDING",
      limit: "50",
    });
    if (nextCursor) search.set("cursor", nextCursor);

    const response = await fetch(`/api/offers/mine?${search.toString()}`, { signal });
    if (!response.ok) throw new Error("Failed to fetch offers");

    const payload = (await response.json()) as {
      items?: RiderIncomingOfferRow[];
      nextCursor?: string | null;
    };
    allOffers.push(...(payload.items ?? []));
    nextCursor = payload.nextCursor ?? null;
    pages += 1;
  } while (nextCursor);

  return allOffers;
}

async function fetchDriverRating(
  driverUserId: string,
  signal?: AbortSignal,
): Promise<DriverRatingSummary | null> {
  const response = await fetch(`/api/users/${driverUserId}/rating-summary`, {
    signal,
  });
  if (!response.ok) return null;
  return (await response.json()) as DriverRatingSummary;
}

function TripRequestMapPanel({
  originText,
  destinationText,
  originLatitude,
  originLongitude,
  destinationLatitude,
  destinationLongitude,
}: {
  originText: string;
  destinationText: string;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
}) {
  const token = getMapboxPublicAccessToken();
  const hasCoords =
    (originLatitude != null && originLongitude != null) ||
    (destinationLatitude != null && destinationLongitude != null);

  if (token && hasCoords) {
    return (
      <div className="overflow-hidden rounded-2xl shadow-md ring-1 ring-zinc-200/80">
        <StaticRouteMap
          originLatitude={originLatitude}
          originLongitude={originLongitude}
          destinationLatitude={destinationLatitude}
          destinationLongitude={destinationLongitude}
        />
      </div>
    );
  }

  return (
    <OffersMapFallback originLabel={originText} destLabel={destinationText} />
  );
}

function OffersMapFallback({
  originLabel,
  destLabel,
}: {
  originLabel: string;
  destLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/80 shadow-sm">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-[12%] top-[20%] h-16 w-20 rounded-full bg-emerald-200/90 blur-[2px]" />
        <div className="absolute right-[18%] bottom-[24%] h-20 w-24 rounded-full bg-emerald-300/70 blur-[2px]" />
      </div>
      <div className="relative flex min-h-[160px] items-center justify-between px-6 py-8">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0d3d2e] bg-white shadow">
            <MapPin className="h-5 w-5 text-[#0d3d2e]" strokeWidth={2.2} />
          </div>
          <span className="max-w-[100px] truncate text-center text-[10px] font-semibold text-zinc-700">
            Pickup
          </span>
        </div>
        <div className="flex flex-1 justify-center px-2">
          <div className="h-0.5 w-full max-w-[120px] border-t-2 border-dotted border-emerald-400" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0d3d2e] bg-white shadow">
            <MapPin className="h-5 w-5 text-emerald-700" strokeWidth={2.2} />
          </div>
          <span className="max-w-[100px] truncate text-center text-[10px] font-semibold text-zinc-700">
            Dropoff
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-zinc-200/80 bg-white/90 px-4 py-2.5 text-xs">
        <span className="truncate font-medium text-zinc-600">
          {originLabel} → {destLabel}
        </span>
        <span className="shrink-0 font-semibold text-[#0d3d2e]">Illustration</span>
      </div>
    </div>
  );
}

export function TripRequestOffersView({ initialRequestId }: TripRequestOffersViewProps) {
  const [tripRequests, setTripRequests] = useState<TripRequestMine[]>([]);
  const [offers, setOffers] = useState<RiderIncomingOfferRow[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverRatings, setDriverRatings] = useState<
    Record<string, DriverRatingSummary | null>
  >({});
  const [pendingActions, setPendingActions] = useState<
    Partial<Record<string, OfferActionType>>
  >({});
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const loadAll = useCallback(async (options?: { signal?: AbortSignal; silent?: boolean }) => {
    const { signal, silent = false } = options ?? {};
    setError(null);
    if (!silent) setLoading(true);
    try {
      const [mine, incoming] = await Promise.all([
        fetchMyTripRequests(signal),
        fetchPendingIncomingOffers(signal),
      ]);
      if (signal?.aborted) return;
      setTripRequests(mine);
      setOffers(incoming);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load offers.");
    } finally {
      if (!signal?.aborted && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadAll({ signal: ac.signal });
    return () => ac.abort();
  }, [loadAll]);

  const requestIdsWithOffers = useMemo(() => {
    return new Set(offers.map((o) => o.tripRequestId));
  }, [offers]);

  const offerCountByTripRequest = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of offers) {
      m[o.tripRequestId] = (m[o.tripRequestId] ?? 0) + 1;
    }
    return m;
  }, [offers]);

  useEffect(() => {
    if (loading) return;
    if (tripRequests.length === 0) {
      setSelectedRequestId(null);
      return;
    }
    setSelectedRequestId((prev) => {
      if (prev && tripRequests.some((t) => t.id === prev)) {
        return prev;
      }
      if (initialRequestId && tripRequests.some((t) => t.id === initialRequestId)) {
        return initialRequestId;
      }
      const firstWithOffers = tripRequests.find((t) => requestIdsWithOffers.has(t.id));
      if (firstWithOffers) return firstWithOffers.id;
      const firstActive = tripRequests.find((t) => t.status === "ACTIVE");
      return firstActive?.id ?? tripRequests[0]?.id ?? null;
    });
  }, [loading, tripRequests, requestIdsWithOffers, initialRequestId]);

  const selectedTripMine = tripRequests.find((t) => t.id === selectedRequestId) ?? null;
  const selectedTripSnippet =
    offers.find((o) => o.tripRequestId === selectedRequestId)?.tripRequest ?? null;

  const mergedSelectedTrip: (TripRequestMine | (OfferTripRequestSnippet & {
    pickupInstructions: string | null;
    dropoffInstructions: string | null;
  })) | null = selectedTripMine
    ? selectedTripMine
    : selectedTripSnippet
      ? {
          ...selectedTripSnippet,
          pickupInstructions: null,
          dropoffInstructions: null,
        }
      : null;

  const offersForSelected = useMemo(() => {
    if (!selectedRequestId) return [];
    return offers.filter((o) => o.tripRequestId === selectedRequestId);
  }, [offers, selectedRequestId]);

  const uniqueDriverIds = useMemo(
    () => [...new Set(offersForSelected.map((o) => o.driverUserId))],
    [offersForSelected],
  );

  const driverIdsKey = uniqueDriverIds.slice().sort().join(",");

  useEffect(() => {
    if (uniqueDriverIds.length === 0) return;
    const ac = new AbortController();
    const ids = [...uniqueDriverIds];
    (async () => {
      const entries = await Promise.all(
        ids.map(
          async (id) =>
            [id, await fetchDriverRating(id, ac.signal)] as const,
        ),
      );
      if (!ac.signal.aborted) {
        setDriverRatings((prev) => {
          const next = { ...prev };
          for (const [id, r] of entries) {
            next[id] = r;
          }
          return next;
        });
      }
    })();
    return () => ac.abort();
  }, [driverIdsKey]);

  const runOfferAction = async (offerId: string, action: OfferActionType) => {
    setNotice(null);
    setPendingActions((p) => ({ ...p, [offerId]: action }));
    const endpoint =
      action === "accept" ? `/api/offers/${offerId}/accept` : `/api/offers/${offerId}/cancel`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey() },
      });
      if (!response.ok) {
        throw new Error(await parseOfferActionError(response));
      }
      setNotice({
        type: "success",
        text: action === "accept" ? "Offer accepted. Your trip is confirmed." : "Offer declined.",
      });
      await loadAll({ silent: true });
    } catch (e) {
      setNotice({
        type: "error",
        text: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setPendingActions((p) => {
        const n = { ...p };
        delete n[offerId];
        return n;
      });
    }
  };

  const departureLabel = mergedSelectedTrip
    ? format(
        new Date(
          mergedSelectedTrip.preferredDepartAt ??
            mergedSelectedTrip.earliestDesiredAt,
        ),
        "EEEE, MMM d · h:mm a",
      ) + " Departure"
    : "";

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <p className="font-semibold text-red-800">{error}</p>
        <button
          type="button"
          onClick={() => void loadAll({ silent: false })}
          className="mt-4 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tripRequests.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-14 text-center shadow-sm">
        <p className="text-lg font-bold text-zinc-900">No trip requests yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Post a trip request to receive offers from drivers.
        </p>
        <Link
          href="/post-trip-request"
          className="mt-6 inline-flex rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
        >
          Create Trip Request
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
          <Link
            href="/browse-trip-requests?view=my"
            className="font-medium text-[#0d3d2e] hover:underline"
          >
            My Requests
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="truncate text-zinc-800">
            {mergedSelectedTrip?.destinationText ?? "Select a request"}
          </span>
        </nav>

        {tripRequests.length > 1 ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50/80 to-white p-4 shadow-sm">
            <p className="mb-3 px-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Switch trip request
            </p>
            <div
              className="flex gap-2.5 overflow-x-auto pb-0.5 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="listbox"
              aria-label="Choose a trip request"
            >
              {tripRequests.map((t) => {
                const isSelected = t.id === selectedRequestId;
                const offerCount = offerCountByTripRequest[t.id] ?? 0;
                const statusLabel =
                  t.status === "ACTIVE"
                    ? "Active"
                    : t.status === "CLOSED"
                      ? "Closed"
                      : t.status;
                const when = format(new Date(t.earliestDesiredAt), "MMM d");

                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedRequestId(t.id)}
                    className={`flex min-w-[228px] max-w-[280px] shrink-0 flex-col rounded-2xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? "border-[#0d3d2e] bg-white shadow-md ring-2 ring-[#0d3d2e]/20"
                        : "border-zinc-200/90 bg-white/90 hover:border-emerald-800/25 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    <span className="line-clamp-2 text-sm font-bold leading-snug text-zinc-900">
                      {t.destinationText}
                    </span>
                    <span className="mt-1 line-clamp-1 text-xs text-zinc-500">
                      From {t.originText}
                    </span>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          t.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                        {when}
                      </span>
                      {offerCount > 0 ? (
                        <span className="rounded-full bg-[#0d3d2e] px-2 py-0.5 text-[10px] font-bold text-white">
                          {offerCount} offer{offerCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                          No offers yet
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
              Trip Offers
            </h1>
            {mergedSelectedTrip ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
                <Calendar className="h-4 w-4 shrink-0" strokeWidth={2} />
                {departureLabel}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {mergedSelectedTrip?.status === "ACTIVE" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                Active Request
              </span>
            ) : mergedSelectedTrip ? (
              <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-700">
                {mergedSelectedTrip.status}
              </span>
            ) : null}
            <button
              type="button"
              aria-label="More options"
              className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {notice ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-900">Available Offers</h2>
          <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#0d3d2e] px-2 text-xs font-bold text-white">
            {offersForSelected.length}
          </span>
        </div>

        {offersForSelected.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
            <p className="font-semibold text-zinc-800">No pending offers for this request</p>
            <p className="mt-2 text-sm text-zinc-500">
              When drivers send offers, they will appear here. You can also browse matching rides from
              your trip request detail page.
            </p>
            {mergedSelectedTrip ? (
              <Link
                href={`/trip-requests/${selectedRequestId}`}
                className="mt-4 inline-block text-sm font-semibold text-[#0d3d2e] hover:underline"
              >
                View trip request
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {offersForSelected.map((offer) => {
              const rating = driverRatings[offer.driverUserId];
              const showStars = rating && rating.ratingCount > 0 && rating.averageRating != null;
              const busy = Boolean(pendingActions[offer.id]);

              return (
                <li
                  key={offer.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <UserAvatar size="lg" name="Driver" />
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-900">Driver</p>
                        <p className="text-sm text-zinc-500">Verified Stetson rider</p>
                        {showStars ? (
                          <p className="mt-1 text-sm font-semibold text-amber-700">
                            {rating!.averageRating!.toFixed(1)} ★
                            <span className="ml-1 font-normal text-zinc-500">
                              ({rating!.ratingCount})
                            </span>
                          </p>
                        ) : (
                          <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                            New Driver
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-2xl font-bold text-[#0d3d2e]">{formatPrice(offer.priceCents)}</p>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        per person
                      </p>
                    </div>
                  </div>

                  {offer.message ? (
                    <blockquote className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm italic text-zinc-700 border border-zinc-100">
                      {offer.message}
                    </blockquote>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-600">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium">
                      {offer.seatsOffered} seat{offer.seatsOffered === 1 ? "" : "s"} offered
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
                      Student ID Verified
                    </span>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={busy || mergedSelectedTrip?.status !== "ACTIVE"}
                      onClick={() => void runOfferAction(offer.id, "accept")}
                      className="flex-1 rounded-xl bg-[#1B6B42] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#155a38] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingActions[offer.id] === "accept" ? "Accepting…" : "Accept Offer"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || mergedSelectedTrip?.status !== "ACTIVE"}
                      onClick={() => void runOfferAction(offer.id, "cancel")}
                      className="flex-1 rounded-xl border-2 border-zinc-200 bg-white py-3 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingActions[offer.id] === "cancel" ? "Declining…" : "Decline"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-[340px]">
        {mergedSelectedTrip ? (
          <>
            <TripRequestMapPanel
              originText={mergedSelectedTrip.originText}
              destinationText={mergedSelectedTrip.destinationText}
              originLatitude={mergedSelectedTrip.originLatitude ?? null}
              originLongitude={mergedSelectedTrip.originLongitude ?? null}
              destinationLatitude={mergedSelectedTrip.destinationLatitude ?? null}
              destinationLongitude={mergedSelectedTrip.destinationLongitude ?? null}
            />

            <div className="rounded-2xl bg-[#0d3d2e] p-5 text-white shadow-md">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                Request details
              </p>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  <div>
                    <p className="text-xs font-semibold text-white/60">Pickup</p>
                    <p className="font-medium">{mergedSelectedTrip.originText}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  <div>
                    <p className="text-xs font-semibold text-white/60">Dropoff</p>
                    <p className="font-medium">{mergedSelectedTrip.destinationText}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-sm">
                <div>
                  <p className="text-xs text-white/60">Seats needed</p>
                  <p className="font-semibold">
                    {mergedSelectedTrip.seatsNeeded} passenger
                    {mergedSelectedTrip.seatsNeeded === 1 ? "" : "s"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Details</p>
                  <p className="font-semibold capitalize">
                    {mergedSelectedTrip.distanceCategory?.toLowerCase() ?? "—"} trip
                  </p>
                </div>
              </div>
              {(mergedSelectedTrip.pickupInstructions || mergedSelectedTrip.dropoffInstructions) ? (
                <div className="mt-4 border-t border-white/15 pt-4 text-xs text-white/85">
                  {mergedSelectedTrip.pickupInstructions ? (
                    <p className="mb-2">
                      <span className="font-semibold text-white">Pickup notes: </span>
                      {mergedSelectedTrip.pickupInstructions}
                    </p>
                  ) : null}
                  {mergedSelectedTrip.dropoffInstructions ? (
                    <p>
                      <span className="font-semibold text-white">Dropoff notes: </span>
                      {mergedSelectedTrip.dropoffInstructions}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-[#0d3d2e]">
                  <Shield className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">Stetson Safety First</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    Confirm your driver&apos;s identity before you leave. Share your trip status with a
                    friend and keep Desti messaging open for coordination.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
