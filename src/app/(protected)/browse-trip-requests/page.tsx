"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Calendar, MapPin, Search } from "lucide-react";
import { ProtectedShell } from "../_components/ProtectedShell";
import { TripRequestsViewToggle } from "../_components/TripRequestsViewToggle";
import { MyTripRequestsView } from "../my-trip-requests/MyTripRequestsView";
import { BrowseTripRequestsFilterSidebar } from "./BrowseTripRequestsFilterSidebar";
import { TripRequestOffersView } from "./TripRequestOffersView";
import {
  filterTripRequestsForBrowse,
  getPendingOfferTripRequestIds,
  type BrowseTripRequestsQuickFilter,
  type PendingOfferSummary,
  type TripRequestSummary,
} from "@/lib/browse-trip-requests";
import { normalizeTripRequestsView } from "@/lib/trip-request-view";
import { UserAvatar } from "@/components/UserAvatar";
import {
  type BrowseTimeWindow,
  buildActiveDistanceSet,
  distanceCategoryLabel,
  formatDistanceMilesLabel,
  matchesLocalDepartDate,
  rideDepartureTimeMatchesWindow,
} from "@/lib/browse-ride-filters";
import type { TripRequestsView } from "@/lib/trip-request-view";

export interface BrowseTripRequestsHubProps {
  hubSearchQuery: string;
  departDate: string;
  distShort: boolean;
  distMedium: boolean;
  distLong: boolean;
  timeWindow: BrowseTimeWindow | null;
  sortBy: "earliest" | "seats";
  setSortBy: (v: "earliest" | "seats") => void;
  onClearHubFilters: () => void;
}

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

function BrowseTripRequestsBrowseTab(hub: BrowseTripRequestsHubProps) {
  const [tripRequests, setTripRequests] = useState<TripRequestSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserSummary | null>(null);
  const [activeFilter, setActiveFilter] = useState<BrowseTripRequestsQuickFilter>("All");
  const [loading, setLoading] = useState(true);
  const [pendingOfferTripRequestIds, setPendingOfferTripRequestIds] = useState(
    () => new Set<string>(),
  );

  useEffect(() => {
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
  }, []);

  const quickFilters = ["All", "Soon", "Solo", "Group", "Offer Sent"] as const;

  const filteredTripRequests = useMemo(() => {
    const base = filterTripRequestsForBrowse({
      tripRequests,
      currentUserId: currentUser?.clerkUserId ?? null,
      searchQuery: hub.hubSearchQuery,
      activeFilter,
      pendingOfferTripRequestIds,
    });
    let list = base.filter((tr) =>
      matchesLocalDepartDate(tr.earliestDesiredAt, hub.departDate),
    );
    const dist = buildActiveDistanceSet({
      short: hub.distShort,
      medium: hub.distMedium,
      long: hub.distLong,
    });
    if (dist !== "all") {
      list = list.filter((tr) => dist.has(tr.distanceCategory));
    }
    list = list.filter((tr) =>
      rideDepartureTimeMatchesWindow(tr.earliestDesiredAt, hub.timeWindow),
    );
    if (hub.sortBy === "seats") {
      list = [...list].sort((a, b) => b.seatsNeeded - a.seatsNeeded);
    } else {
      list = [...list].sort(
        (a, b) =>
          new Date(a.earliestDesiredAt).getTime() -
          new Date(b.earliestDesiredAt).getTime(),
      );
    }
    return list;
  }, [
    tripRequests,
    currentUser?.clerkUserId,
    hub.hubSearchQuery,
    hub.departDate,
    hub.distShort,
    hub.distMedium,
    hub.distLong,
    hub.timeWindow,
    hub.sortBy,
    activeFilter,
    pendingOfferTripRequestIds,
  ]);

  return (
    <>
      <div className="mb-1 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-lg font-bold text-zinc-900">
          Available Trip Requests (
          {loading && tripRequests.length === 0 ? "…" : filteredTripRequests.length})
        </h2>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <span className="text-sm text-zinc-500">Sort by:</span>
          <select
            value={hub.sortBy}
            onChange={(e) =>
              hub.setSortBy(e.target.value as "earliest" | "seats")
            }
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800"
          >
            <option value="earliest">Earliest departure</option>
            <option value="seats">Seats needed (high to low)</option>
          </select>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-2 pb-1">
          {quickFilters.map((filterOpt) => (
            <button
              key={filterOpt}
              type="button"
              onClick={() => setActiveFilter(filterOpt)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                activeFilter === filterOpt
                  ? "bg-[#006837] text-white shadow-sm"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {filterOpt}
            </button>
          ))}
        </div>
      </div>

      {loading && tripRequests.length === 0 ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
      ) : filteredTripRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 py-16 text-center">
          <h3 className="text-lg font-bold text-zinc-900">No trip requests found</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
            We couldn&apos;t find any trip requests matching your search and filters. Try a
            different date or clear optional filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveFilter("All");
              hub.onClearHubFilters();
            }}
            className="mt-4 text-sm font-semibold text-[#006837] hover:underline"
          >
            Clear search &amp; filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredTripRequests.map((tripRequest) => (
            <article
              key={tripRequest.id}
              className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white pl-1 text-left shadow-sm transition-all hover:border-[#006837]/50 hover:shadow-md"
            >
              <div
                className="absolute bottom-0 left-0 top-0 w-1 bg-[#006837]"
                aria-hidden
              />
              <div className="p-4 pl-5 sm:p-5 sm:pl-6">
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
                          {tripRequest.originText}
                        </p>
                        <p className="pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-zinc-400">
                          Destination
                        </p>
                        <p className="text-sm font-semibold text-zinc-900">
                          {tripRequest.destinationText}
                        </p>
                        {tripRequest.rider ? (
                          <div className="mt-2 flex items-center gap-2">
                            <UserAvatar
                              src={tripRequest.rider.profilePictureUrl}
                              name={tripRequest.rider.name}
                              size="sm"
                            />
                            <span className="text-xs font-medium text-zinc-600">
                              {tripRequest.rider.name ?? "Rider"}
                            </span>
                          </div>
                        ) : null}
                        {(tripRequest.pickupInstructions || tripRequest.dropoffInstructions) ? (
                          <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                            {tripRequest.pickupInstructions
                              ? `Pickup: ${tripRequest.pickupInstructions}`
                              : ""}
                            {tripRequest.pickupInstructions && tripRequest.dropoffInstructions
                              ? " · "
                              : ""}
                            {tripRequest.dropoffInstructions
                              ? `Dropoff: ${tripRequest.dropoffInstructions}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right sm:pl-4">
                    <p className="text-2xl font-bold text-[#006837]">{tripRequest.seatsNeeded}</p>
                    <p className="text-xs text-zinc-500">seats needed</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Active
                    </p>
                    <p className="text-sm font-semibold text-zinc-800">
                      {tripRequest.hasPendingOffer ? "Offer sent" : "Open"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                      <ClockIcon />
                      {formatTimeRange(
                        tripRequest.earliestDesiredAt,
                        tripRequest.latestDesiredAt,
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" strokeWidth={2} />
                      {distanceCategoryLabel(tripRequest.distanceCategory)} ·{" "}
                      {formatDistanceMilesLabel(tripRequest.distanceCategory)}
                    </span>
                  </div>
                  <Link
                    href={`/trip-requests/${tripRequest.id}`}
                    className="inline-flex items-center justify-center self-start rounded-xl bg-[#006837] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d3d2e] sm:self-auto"
                  >
                    View Request
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

const REQUESTS_SHELL_PROPS = {
  activeNav: "browseTripRequests" as const,
  layout: "topnav" as const,
  topNavActive: "requests" as const,
  topNavPrimaryAction: {
    label: "Create Trip Request",
    href: "/post-trip-request",
  },
};

function tripRequestsHeroCopy(view: TripRequestsView): {
  title: string;
  subtitle: string;
} {
  if (view === "my") {
    return {
      title: "Your posted trip requests from DeLand.",
      subtitle:
        "Filter requests you published, then edit, cancel, or jump to offers and matches.",
    };
  }
  if (view === "offers") {
    return {
      title: "Review driver offers for your trip requests.",
      subtitle:
        "Accept or decline pending offers, then coordinate details in messages.",
    };
  }
  return {
    title: "Browse Trip Requests from DeLand.",
    subtitle:
      "Search by destination and date, then narrow results with distance and time filters.",
  };
}

export default function BrowseTripRequestsPage() {
  const searchParams = useSearchParams();
  const currentView = normalizeTripRequestsView(searchParams.get("view"));
  const forRequestId = searchParams.get("forRequest");

  const [heroDestinationDraft, setHeroDestinationDraft] = useState("");
  const [hubSearchQuery, setHubSearchQuery] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [distShort, setDistShort] = useState(true);
  const [distMedium, setDistMedium] = useState(true);
  const [distLong, setDistLong] = useState(true);
  const [timeWindow, setTimeWindow] = useState<BrowseTimeWindow | null>(null);
  const [sortBy, setSortBy] = useState<"earliest" | "seats">("earliest");

  const applyHeroSearch = useCallback(() => {
    setHubSearchQuery(heroDestinationDraft.trim());
  }, [heroDestinationDraft]);

  const clearHubFilters = () => {
    setDistShort(true);
    setDistMedium(true);
    setDistLong(true);
    setTimeWindow(null);
    setDepartDate("");
    setHubSearchQuery("");
    setHeroDestinationDraft("");
  };

  const hubBrowseProps: BrowseTripRequestsHubProps = {
    hubSearchQuery,
    departDate,
    distShort,
    distMedium,
    distLong,
    timeWindow,
    sortBy,
    setSortBy,
    onClearHubFilters: clearHubFilters,
  };

  const { title: heroTitle, subtitle: heroSubtitle } =
    tripRequestsHeroCopy(currentView);

  return (
    <ProtectedShell {...REQUESTS_SHELL_PROPS}>
      <div className="overflow-hidden rounded-3xl bg-[#006837] shadow-sm">
        <div className="px-5 py-7 md:px-8 md:py-9">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            {heroTitle}
          </h1>
          <p className="mt-1 text-sm text-white/90">{heroSubtitle}</p>
          {currentView !== "offers" ? (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-stretch sm:gap-0 md:p-2">
              <label className="relative flex min-w-0 flex-1 items-center border-b border-zinc-200 px-3 py-2 sm:border-b-0 sm:border-r sm:py-3">
                <MapPin
                  className="mr-2 h-4 w-4 shrink-0 text-zinc-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder="Where to?"
                  value={heroDestinationDraft}
                  onChange={(e) => setHeroDestinationDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyHeroSearch();
                  }}
                  className="w-full min-w-0 border-0 bg-transparent text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
                />
              </label>
              <label className="relative flex min-w-0 flex-1 items-center px-3 py-2 sm:py-3">
                <Calendar
                  className="mr-2 h-4 w-4 shrink-0 text-zinc-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="date"
                  value={departDate}
                  onChange={(e) => setDepartDate(e.target.value)}
                  className="w-full min-w-0 border-0 bg-transparent text-sm font-medium text-zinc-900 focus:outline-none focus:ring-0"
                />
              </label>
              <div className="flex border-t border-zinc-200 px-2 pb-2 pt-1 sm:border-t-0 sm:items-stretch sm:px-2 sm:py-1">
                <button
                  type="button"
                  onClick={applyHeroSearch}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#006837] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d3d2e] sm:w-auto"
                >
                  <Search className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  Search
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <TripRequestsViewToggle activeView={currentView} />

      {currentView === "offers" ? (
        <div className="mt-1 min-w-0">
          <TripRequestOffersView initialRequestId={forRequestId} />
        </div>
      ) : (
        <div className="mt-1 grid min-w-0 gap-6 lg:grid-cols-12">
          <BrowseTripRequestsFilterSidebar
            distShort={distShort}
            distMedium={distMedium}
            distLong={distLong}
            setDistShort={setDistShort}
            setDistMedium={setDistMedium}
            setDistLong={setDistLong}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
          />
          <div className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-9">
            {currentView === "browse" ? (
              <BrowseTripRequestsBrowseTab {...hubBrowseProps} />
            ) : (
              <MyTripRequestsView
                hubLayout
                hubMode
                hubFilters={{
                  hubSearchQuery,
                  departDate,
                  distShort,
                  distMedium,
                  distLong,
                  timeWindow,
                }}
                hubControls={{
                  sortBy,
                  setSortBy,
                  onClearHubFilters: clearHubFilters,
                }}
              />
            )}
          </div>
        </div>
      )}
    </ProtectedShell>
  );
}
