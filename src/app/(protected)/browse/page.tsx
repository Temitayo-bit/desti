"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { endOfDay, format, startOfDay } from "date-fns";
import type {
  DistanceCategory,
  MusicPreference,
  VehicleType,
} from "@prisma/client";
import { Calendar, MapPin, Search, User } from "lucide-react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProtectedShell } from "../_components/ProtectedShell";
import { RidesViewToggle } from "../_components/RidesViewToggle";
import { MyRidesView } from "../my-rides/MyRidesView";
import { filterRidesForBrowse } from "@/lib/browse-trip-requests";
import { normalizeRidesView } from "@/lib/ride-view";
import { UserAvatar } from "@/components/UserAvatar";
import {
  type BrowseTimeWindow,
  type SidebarApiFilters,
  buildActiveDistanceSet,
  distanceCategoryLabel,
  EMPTY_SIDEBAR_API,
  formatDistanceMilesLabel,
  rideDepartureTimeMatchesWindow,
} from "@/lib/browse-ride-filters";
import { BrowsePageFooter } from "./BrowsePageFooter";
import { BrowseRidesFilterSidebar } from "./BrowseRidesFilterSidebar";

function buildBrowseListQuery(opts: {
  sidebar: SidebarApiFilters;
  /** When set, narrow the day; API uses earliestAfter default now if unset */
  departDate: string;
  /** Single distance for API; omit when multiple or none */
  distanceCategoryForApi: DistanceCategory | null;
  cursor: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (opts.cursor) params.set("cursor", opts.cursor);

  if (opts.departDate) {
    const d = new Date(`${opts.departDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      params.set("earliestAfter", startOfDay(d).toISOString());
      params.set("latestBefore", endOfDay(d).toISOString());
    }
  }

  if (opts.distanceCategoryForApi) {
    params.set("distanceCategory", opts.distanceCategoryForApi);
  }

  if (opts.sidebar.musicPreference) {
    params.set("musicPreference", opts.sidebar.musicPreference);
  }
  if (opts.sidebar.hasAc) params.set("hasAc", opts.sidebar.hasAc);
  if (opts.sidebar.hasTrunkSpace) {
    params.set("hasTrunkSpace", opts.sidebar.hasTrunkSpace);
  }
  if (opts.sidebar.vehicleType) {
    params.set("vehicleType", opts.sidebar.vehicleType);
  }
  return `?${params.toString()}`;
}

// --- Types ---
type RideStatus = "ACTIVE" | "CANCELLED";
interface RideSummary {
  id: string;
  driverUserId: string;
  originText: string;
  destinationText: string;
  earliestDepartAt: string;
  latestDepartAt: string;
  distanceCategory: DistanceCategory;
  priceCents: number;
  seatsTotal: number;
  seatsAvailable: number;
  musicPreference: MusicPreference | null;
  hasAc: boolean | null;
  hasTrunkSpace: boolean | null;
  vehicleType: VehicleType | null;
  pickupInstructions: string | null;
  dropoffInstructions: string | null;
  preferredDepartAt: string | null;
  status: RideStatus;
  createdAt: string;
  updatedAt: string;
  driver?: {
    name: string | null;
    profilePictureUrl: string | null;
  };
}

interface EditRideFormData {
  originText?: string;
  destinationText?: string;
  earliestDepartAt?: string;
  latestDepartAt?: string;
  seatsTotal?: number;
  priceDollars?: string;
  musicPreference?: "" | MusicPreference;
  hasAc?: "" | "true" | "false";
  hasTrunkSpace?: "" | "true" | "false";
  vehicleType?: "" | VehicleType;
}

interface ConfirmedBookingSummary {
  id: string;
  rideId: string | null;
}

function excludeCancelledRides(items: RideSummary[] | undefined): RideSummary[] {
  return (items ?? []).filter((ride) => ride.status === "ACTIVE");
}

// --- Icons ---
const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

// --- Component ---
export default function BrowseRidesPage() {
  const searchParams = useSearchParams();
  const currentView = normalizeRidesView(searchParams.get("view"));
  const [rides, setRides] = useState<RideSummary[]>([]);
  const [selectedRide, setSelectedRide] = useState<RideSummary | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<EditRideFormData>({});
  const [currentUser, setCurrentUser] = useState<{
    clerkUserId: string;
    primaryVerifiedEmail: string;
    created: boolean;
    localUser: {
      id: string;
      clerkUserId: string;
      name: string | null;
    } | null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroDestinationDraft, setHeroDestinationDraft] = useState("");
  const [departDate, setDepartDate] = useState(""); // yyyy-mm-dd, optional
  const [distShort, setDistShort] = useState(true);
  const [distMedium, setDistMedium] = useState(true);
  const [distLong, setDistLong] = useState(true);
  const [timeWindow, setTimeWindow] = useState<BrowseTimeWindow | null>(null);
  const [sidebarApi, setSidebarApi] = useState<SidebarApiFilters>({ ...EMPTY_SIDEBAR_API });
  const [sortBy, setSortBy] = useState<"earliest" | "price">("earliest");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  /** Incremented to re-run the browse `useEffect` fetch with a fresh AbortController (e.g. Retry). */
  const [browseRefetchKey, setBrowseRefetchKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookingIdempotencyKey, setBookingIdempotencyKey] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<"booking" | "edit" | null>(null);
  const [isConfirmingRideCancellation, setIsConfirmingRideCancellation] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [userBookings, setUserBookings] = useState<Record<string, string>>({}); // rideId -> bookingId
  const closeRideDialogButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const distanceCategoryForQuery = useMemo((): DistanceCategory | null => {
    const s = new Set<DistanceCategory>();
    if (distShort) s.add("SHORT");
    if (distMedium) s.add("MEDIUM");
    if (distLong) s.add("LONG");
    if (s.size === 0 || s.size > 1) return null;
    return [...s][0] ?? null;
  }, [distShort, distMedium, distLong]);

  const fetchRidesList = useCallback(
    async (opts: { cursor: string | null; append: boolean; signal: AbortSignal }) => {
      const qs = buildBrowseListQuery({
        sidebar: sidebarApi,
        departDate,
        distanceCategoryForApi: distanceCategoryForQuery,
        cursor: opts.cursor,
      });
      const res = await fetch(`/api/rides${qs}`, { signal: opts.signal });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errBody?.message ?? "Failed to fetch rides");
      }
      const data = (await res.json()) as {
        items: RideSummary[];
        nextCursor: string | null;
      };
      const next = excludeCancelledRides(data.items);
      if (opts.append) {
        setRides((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const merged = [...prev];
          for (const r of next) {
            if (!seen.has(r.id)) {
              seen.add(r.id);
              merged.push(r);
            }
          }
          return merged;
        });
      } else {
        setRides(next);
      }
      setNextCursor(data.nextCursor);
      setBrowseError(null);
      return next;
    },
    [sidebarApi, departDate, distanceCategoryForQuery],
  );

  useEffect(() => {
    if (currentView !== "browse") {
      return;
    }

    const controller = new AbortController();

    async function run() {
      try {
        setLoading(true);
        setBrowseError(null);
        setRides([]);
        setNextCursor(null);
        await fetchRidesList({ cursor: null, append: false, signal: controller.signal });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching rides:", err);
        if (!controller.signal.aborted) {
          setBrowseError(
            err instanceof Error ? err.message : "Failed to load rides.",
          );
          setRides([]);
          setNextCursor(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      controller.abort();
    };
  }, [currentView, fetchRidesList, browseRefetchKey]);

  useEffect(() => {
    if (currentView !== "browse") {
      return;
    }

    const controller = new AbortController();

    async function fetchUser() {
      try {
        const res = await fetch("/api/me", { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (!controller.signal.aborted) {
            setCurrentUser(data);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching user:", err);
      }
    }

    async function fetchUserBookings() {
      try {
        const res = await fetch("/api/bookings/mine?status=CONFIRMED", {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as {
            items?: ConfirmedBookingSummary[];
          };
          const mapping: Record<string, string> = {};
          data.items?.forEach((booking) => {
            if (booking.rideId) {
              mapping[booking.rideId] = booking.id;
            }
          });
          if (!controller.signal.aborted) {
            setUserBookings(mapping);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching user bookings:", err);
      }
    }

    fetchUser();
    fetchUserBookings();

    return () => {
      controller.abort();
    };
  }, [currentView]);

  useEffect(() => {
    if (!selectedRide) return;

    if (selectedRide.seatsAvailable <= 0) {
      if (selectedSeats !== 0) {
        setSelectedSeats(0);
      }
      return;
    }

    if (selectedSeats < 1 || selectedSeats > selectedRide.seatsAvailable) {
      setSelectedSeats(Math.min(Math.max(selectedSeats, 1), selectedRide.seatsAvailable));
    }
  }, [selectedRide, selectedSeats]);

  useEffect(() => {
    if (!selectedRide) return;

    window.requestAnimationFrame(() => {
      closeRideDialogButtonRef.current?.focus();
    });
  }, [selectedRide]);

  const filteredRides = useMemo(() => {
    let list = filterRidesForBrowse({
      rides: excludeCancelledRides(rides),
      currentUserId: currentUser?.clerkUserId ?? null,
      searchQuery,
      activeFilter: "All",
    });
    const dist = buildActiveDistanceSet({
      short: distShort,
      medium: distMedium,
      long: distLong,
    });
    if (dist !== "all") {
      list = list.filter((r) => dist.has(r.distanceCategory));
    }
    list = list.filter((r) =>
      rideDepartureTimeMatchesWindow(r.earliestDepartAt, timeWindow),
    );
    if (sortBy === "price") {
      list = [...list].sort((a, b) => a.priceCents - b.priceCents);
    } else {
      list = [...list].sort(
        (a, b) =>
          new Date(a.earliestDepartAt).getTime() -
          new Date(b.earliestDepartAt).getTime(),
      );
    }
    return list;
  }, [
    rides,
    currentUser?.clerkUserId,
    searchQuery,
    distShort,
    distMedium,
    distLong,
    timeWindow,
    sortBy,
  ]);

  const applyHeroSearch = useCallback(() => {
    setSearchQuery(heroDestinationDraft.trim());
  }, [heroDestinationDraft]);

  const loadMoreRides = useCallback(async () => {
    if (!nextCursor || loadMoreLoading || loading) return;
    const ac = new AbortController();
    try {
      setLoadMoreLoading(true);
      await fetchRidesList({
        cursor: nextCursor,
        append: true,
        signal: ac.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setBrowseError(
        err instanceof Error ? err.message : "Could not load more rides.",
      );
    } finally {
      setLoadMoreLoading(false);
    }
  }, [nextCursor, loadMoreLoading, loading, fetchRidesList]);

  const formatTimeRange = (earliest: string, latest: string) => {
    try {
      const d1 = new Date(earliest);
      const d2 = new Date(latest);

      // If same day
      if (d1.toDateString() === d2.toDateString()) {
        // Check if it's today
        if (d1.toDateString() === new Date().toDateString()) {
          return `Today ${format(d1, 'h:mm a')} - ${format(d2, 'h:mm a')}`;
        }
        return `${format(d1, 'MMM d, h:mm a')} - ${format(d2, 'h:mm a')}`;
      }
      return `${format(d1, 'MMM d, h:mm a')} - ${format(d2, 'MMM d, h:mm a')}`;
    } catch {
      return "Time TBD";
    }
  };

  const toTitleCase = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const toNullableBooleanSelectValue = (value: boolean | null): "" | "true" | "false" => {
    if (value === true) return "true";
    if (value === false) return "false";
    return "";
  };

  const formatOptionalFeature = (value: boolean | null) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "Unspecified";
  };

  const formatMusicPreference = (value: MusicPreference | null) => {
    if (value === "MUSIC_ALLOWED") return "Music allowed";
    if (value === "NO_MUSIC") return "No music";
    return "Unspecified";
  };

  const formatVehicleType = (value: VehicleType | null) => {
    if (!value) return "Unspecified";
    return toTitleCase(value);
  };

  const closeRideModal = () => {
    setSelectedRide(null);
    setSuccessState(null);
    setSelectedSeats(1);
    setIsEditing(false);
    setEditFormData({});
    setIsConfirmingRideCancellation(false);

    const previouslyFocusedElement = lastFocusedElementRef.current;
    if (previouslyFocusedElement) {
      window.requestAnimationFrame(() => {
        previouslyFocusedElement.focus();
      });
    }
    lastFocusedElementRef.current = null;
  };

  const handleBookRide = async (rideId: string) => {
    if (bookingInProgress) return;

    const rideForBooking = rides.find((r) => r.id === rideId) ?? selectedRide;
    if (!rideForBooking || rideForBooking.seatsAvailable <= 0) {
      alert("No seats available for this ride.");
      return;
    }

    const seatsToBook = Math.min(
      Math.max(selectedSeats, 1),
      rideForBooking.seatsAvailable
    );
    const idempotencyKey = crypto.randomUUID();
    setBookingInProgress(true);
    setBookingIdempotencyKey(idempotencyKey);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          rideId: rideId,
          seatsBooked: seatsToBook,
        }),
      });

      if (res.ok) {
        const booking = await res.json();
        setUserBookings(prev => ({ ...prev, [rideId]: booking.id }));
        setRides((prev) =>
          prev.map((r) =>
            r.id === rideId
              ? { ...r, seatsAvailable: Math.max(0, r.seatsAvailable - seatsToBook) }
              : r
          )
        );
        setSelectedRide((prev) =>
          prev && prev.id === rideId
            ? { ...prev, seatsAvailable: Math.max(0, prev.seatsAvailable - seatsToBook) }
            : prev
        );
        setSuccessState("booking");
        setTimeout(() => {
          closeRideModal();
        }, 2500);
        // Seat counts for this ride are updated in place via setRides / setSelectedRide above.
      } else {
        const data = await res.json();
        alert(`Failed to book: ${data.message || data.error}`);
      }
    } catch (err: unknown) {
      alert(`Error booking ride: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBookingInProgress(false);
      setBookingIdempotencyKey(null);
    }
  };

  const handleCancelBooking = async (rideId: string, bookingId: string) => {
    if (!confirm("Are you sure you want to cancel your booking for this ride?")) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST"
      });

      if (res.ok) {
        alert("Booking cancelled successfully.");
        setUserBookings(prev => {
          const next = { ...prev };
          delete next[rideId];
          return next;
        });
        const ac = new AbortController();
        const refreshed = await fetchRidesList({
          cursor: null,
          append: false,
          signal: ac.signal,
        });
        const updated = refreshed?.find((r) => r.id === rideId);
        if (updated) setSelectedRide(updated);
      } else {
        const data = await res.json();
        alert(`Failed to cancel booking: ${data.message || data.error}`);
      }
    } catch {
      alert("An error occurred while cancelling your booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRide = async (rideId: string) => {
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Ride cancelled successfully.");
        setRides((prev) => prev.filter((r) => r.id !== rideId));
        closeRideModal();
      } else if (res.status === 501) {
        alert("Cancellation not implemented on server.");
      } else {
        const payload = await res.json().catch(() => null);
        alert(payload?.message ?? payload?.error ?? "Failed to cancel ride.");
      }
    } catch {
      alert("An error occurred while attempting to cancel the ride.");
    } finally {
      setIsConfirmingRideCancellation(false);
    }
  };

  const startEditing = () => {
    if (!selectedRide) return;
    setEditFormData({
      originText: selectedRide.originText,
      destinationText: selectedRide.destinationText,
      earliestDepartAt: format(new Date(selectedRide.earliestDepartAt), "yyyy-MM-dd'T'HH:mm"),
      latestDepartAt: format(new Date(selectedRide.latestDepartAt), "yyyy-MM-dd'T'HH:mm"),
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
    const parsedPriceCents = Math.round(parsedPriceDollars * 100);

    try {
      setSubmitting(true);
      const res = await fetch(`/api/rides/${selectedRide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originText: editFormData.originText,
          destinationText: editFormData.destinationText,
          earliestDepartAt: editFormData.earliestDepartAt ? new Date(editFormData.earliestDepartAt).toISOString() : undefined,
          latestDepartAt: editFormData.latestDepartAt ? new Date(editFormData.latestDepartAt).toISOString() : undefined,
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
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update ride");
      }

      const updatedRide = await res.json();

      // Update local state
      setSelectedRide(updatedRide);
      setRides(prev => prev.map(r => r.id === updatedRide.id ? updatedRide : r));
      setIsEditing(false);
      setSuccessState("edit");
      setTimeout(() => {
        closeRideModal();
      }, 2500);

    } catch (err: unknown) {
      alert(`Error updating ride: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const isMy = currentView === "my";

  const clearBrowseFilters = () => {
    setDistShort(true);
    setDistMedium(true);
    setDistLong(true);
    setTimeWindow(null);
    setSidebarApi({ ...EMPTY_SIDEBAR_API });
    setDepartDate("");
    setSearchQuery("");
    setHeroDestinationDraft("");
  };

  return (
    <ProtectedShell
      activeNav="browse"
      layout="topnav"
      topNavActive="rides"
      topNavPrimaryAction={{ label: "Create Ride", href: "/post-ride" }}
    >
        <div className="overflow-hidden rounded-3xl bg-[#006837] shadow-sm">
          <div className="px-5 py-7 md:px-8 md:py-9">
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {isMy
                ? "Your posted rides from DeLand."
                : "Find your next journey from DeLand."}
            </h1>
            <p className="mt-1 text-sm text-white/90">
              {isMy
                ? "Filter trips you are offering, then manage or update each listing."
                : "Search by destination and date, then narrow results in the filters."}
            </p>
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
          </div>
        </div>

        <RidesViewToggle activeView={isMy ? "my" : "browse"} />

        <div className="mt-1 grid min-w-0 gap-6 lg:grid-cols-12">
          <BrowseRidesFilterSidebar
            distShort={distShort}
            distMedium={distMedium}
            distLong={distLong}
            setDistShort={setDistShort}
            setDistMedium={setDistMedium}
            setDistLong={setDistLong}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
            sidebarApi={sidebarApi}
            setSidebarApi={setSidebarApi}
          />

          <div className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-9">
            {isMy ? (
              <MyRidesView
                embedded
                hubMode
                hubFilters={{
                  hubSearchQuery: searchQuery,
                  departDate,
                  distShort,
                  distMedium,
                  distLong,
                  timeWindow,
                  sidebarApi,
                }}
                hubControls={{
                  sortBy,
                  setSortBy,
                  onClearHubFilters: clearBrowseFilters,
                }}
              />
            ) : null}
            {!isMy && (
            <>
            {browseError ? (
              <div
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {browseError}
                <button
                  type="button"
                  onClick={() => {
                    setBrowseError(null);
                    setBrowseRefetchKey((k) => k + 1);
                  }}
                  className="ml-2 font-semibold text-red-900 underline"
                >
                  Retry
                </button>
              </div>
            ) : null}
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-bold text-zinc-900">
                Available Rides (
                {loading && rides.length === 0
                  ? "…"
                  : filteredRides.length}
                )
              </h2>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <span className="text-sm text-zinc-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "earliest" | "price")
                  }
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800"
                >
                  <option value="earliest">Earliest Departure</option>
                  <option value="price">Lowest price (loaded results)</option>
                </select>
              </div>
            </div>

            {loading && rides.length === 0 ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-36 animate-pulse rounded-2xl bg-zinc-100"
                  />
                ))}
              </div>
            ) : filteredRides.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 py-16 text-center">
                <h3 className="text-lg font-bold text-zinc-900">No rides found</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                  We couldn&apos;t find any rides matching your search and
                  filters. Try a different date or clear optional filters.
                </p>
                <button
                  type="button"
                  onClick={clearBrowseFilters}
                  className="mt-4 text-sm font-semibold text-[#006837] hover:underline"
                >
                  Clear search & filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredRides.map((ride) => {
                  const mvp2Bits = [
                    ride.hasAc === true ? "A/C" : null,
                    ride.hasTrunkSpace === true ? "Trunk" : null,
                    ride.musicPreference === "MUSIC_ALLOWED"
                      ? "Music"
                      : ride.musicPreference === "NO_MUSIC"
                        ? "No music"
                        : null,
                    ride.vehicleType ? formatVehicleType(ride.vehicleType) : null,
                  ].filter(Boolean) as string[];
                  return (
                    <div
                      key={ride.id}
                      className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white pl-1 shadow-sm"
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
                                <span className="my-0.5 w-px flex-1 min-h-[1.5rem] bg-zinc-200" />
                                <span className="h-2.5 w-2.5 rounded-full bg-[#006837]" />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-zinc-400">
                                  Origin
                                </p>
                                <p className="text-sm font-semibold text-zinc-900">
                                  {ride.originText}
                                </p>
                                <p className="pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-zinc-400">
                                  Destination
                                </p>
                                <p className="text-sm font-semibold text-zinc-900">
                                  {ride.destinationText}
                                </p>
                                {ride.driver ? (
                                  <div className="mt-2 flex items-center gap-2">
                                    <UserAvatar
                                      src={ride.driver.profilePictureUrl}
                                      name={ride.driver.name}
                                      size="sm"
                                    />
                                    <span className="text-xs font-medium text-zinc-600">
                                      {ride.driver.name ?? "Driver"}
                                    </span>
                                  </div>
                                ) : null}
                                {mvp2Bits.length > 0 ? (
                                  <p className="mt-1 text-xs text-zinc-500">
                                    {mvp2Bits.join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {ride.status !== "ACTIVE" ? (
                              <p className="mt-2 text-xs font-medium text-amber-700">
                                {ride.status}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right sm:pl-4">
                            <p className="text-2xl font-bold text-[#006837]">
                              ${(ride.priceCents / 100).toFixed(0)}
                            </p>
                            <p className="text-xs text-zinc-500">per seat</p>
                            <div className="mt-1 flex items-center justify-end gap-0.5">
                              {Array.from({ length: ride.seatsTotal }).map(
                                (_, i) => (
                                  <User
                                    key={i}
                                    className={`h-3.5 w-3.5 ${
                                      i < ride.seatsAvailable
                                        ? "text-[#006837]"
                                        : "text-zinc-200"
                                    }`}
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                ),
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {ride.seatsAvailable}/{ride.seatsTotal} seats
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                              <ClockIcon />
                              {formatTimeRange(ride.earliestDepartAt, ride.latestDepartAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
                              <MapPinIcon />
                              {distanceCategoryLabel(ride.distanceCategory)} · {formatDistanceMilesLabel(ride.distanceCategory)}
                            </span>
                          </div>
                          <Link
                            href={`/rides/${ride.id}`}
                            className="inline-flex items-center justify-center self-end rounded-xl bg-[#006837] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d3d2e] sm:self-auto"
                          >
                            View Ride
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {nextCursor ? (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => void loadMoreRides()}
                      disabled={loadMoreLoading}
                      className="rounded-xl border-2 border-[#006837] bg-white px-6 py-2.5 text-sm font-semibold text-[#006837] transition hover:bg-[#006837] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadMoreLoading ? "Loading…" : "Load More Rides"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            </>
            )}
          </div>
        </div>

      {/* Ride Details Modal Overlay */}
      {selectedRide && !isMy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rideDetailsTitle"
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
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
                        width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                      >
                        <motion.polyline points="20 6 9 17 4 12" />
                      </motion.svg>
                    </motion.div>
                    <h2 id="rideDetailsTitle" className="text-3xl font-bold text-zinc-900">
                      {successState === "edit" ? "Ride Updated!" : "Ride Confirmed!"}
                    </h2>
                    <p className="text-zinc-500 max-w-sm">
                      {successState === "edit"
                        ? "Your ride details were saved successfully."
                        : "Your seat has been successfully booked. The driver has been notified."}
                    </p>
                  </motion.div>
                ) : isEditing ? (
                  <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h2 id="rideDetailsTitle" className="text-2xl font-bold mb-8 pr-12 text-zinc-900">Edit Ride</h2>
                    {/* --- EDIT MODE --- */}
                    <div className="space-y-6">
                      {/* Origin & Destination */}
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="editOrigin" className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                            <MapPinIcon /> Origin
                          </label>
                          <input
                            id="editOrigin"
                            type="text"
                            title="Origin"
                            placeholder="Enter origin location..."
                            value={editFormData.originText || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, originText: e.target.value })}
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="editDestination" className="flex items-center gap-2 mb-2 text-sm font-semibold text-emerald-800">
                            <MapPinIcon /> Destination
                          </label>
                          <input
                            id="editDestination"
                            type="text"
                            title="Destination"
                            placeholder="Enter destination location..."
                            value={editFormData.destinationText || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, destinationText: e.target.value })}
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                          />
                        </div>
                      </div>

                      {/* Departure Window */}
                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                          <ClockIcon /> Departure Window
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="editEarliest" className="block text-sm font-medium text-zinc-600 mb-1">Earliest</label>
                            <input
                              id="editEarliest"
                              type="datetime-local"
                              title="Earliest Departure"
                              value={editFormData.earliestDepartAt || ""}
                              onChange={(e) => setEditFormData({ ...editFormData, earliestDepartAt: e.target.value })}
                              className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor="editLatest" className="block text-sm font-medium text-zinc-600 mb-1">Latest</label>
                            <input
                              id="editLatest"
                              type="datetime-local"
                              title="Latest Departure"
                              value={editFormData.latestDepartAt || ""}
                              onChange={(e) => setEditFormData({ ...editFormData, latestDepartAt: e.target.value })}
                              className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Seats & Price */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="editSeats" className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <UsersIcon /> Total Seats
                          </label>
                          <input
                            id="editSeats"
                            type="number"
                            title="Total Seats"
                            placeholder="Seats"
                            min="1" max="8"
                            value={editFormData.seatsTotal || 1}
                            onChange={(e) => setEditFormData({ ...editFormData, seatsTotal: parseInt(e.target.value) || 1 })}
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="editPrice" className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <span className="font-bold text-lg leading-none">$</span> Price/Seat
                          </label>
                          <input
                            id="editPrice"
                            type="number"
                            title="Price per Seat (dollars)"
                            placeholder="Price in dollars"
                            min="0" step="0.01"
                            value={editFormData.priceDollars || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, priceDollars: e.target.value })}
                            className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="editMusicPreference" className="block text-sm font-semibold text-emerald-800 mb-2">
                            Music Preference
                          </label>
                          <select
                            id="editMusicPreference"
                            value={editFormData.musicPreference || ""}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                musicPreference: e.target.value as EditRideFormData["musicPreference"],
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
                          <label htmlFor="editVehicleType" className="block text-sm font-semibold text-emerald-800 mb-2">
                            Vehicle Type
                          </label>
                          <select
                            id="editVehicleType"
                            value={editFormData.vehicleType || ""}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                vehicleType: e.target.value as EditRideFormData["vehicleType"],
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
                          <label htmlFor="editHasAc" className="block text-sm font-semibold text-emerald-800 mb-2">
                            AC Availability
                          </label>
                          <select
                            id="editHasAc"
                            value={editFormData.hasAc || ""}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                hasAc: e.target.value as EditRideFormData["hasAc"],
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
                          <label htmlFor="editHasTrunkSpace" className="block text-sm font-semibold text-emerald-800 mb-2">
                            Trunk Space Availability
                          </label>
                          <select
                            id="editHasTrunkSpace"
                            value={editFormData.hasTrunkSpace || ""}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                hasTrunkSpace: e.target.value as EditRideFormData["hasTrunkSpace"],
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
                        onClick={handleEditSubmit}
                        disabled={submitting}
                        className="px-8 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl shadow-sm transition-colors text-lg disabled:opacity-70 flex items-center gap-2"
                      >
                        {submitting ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h2 id="rideDetailsTitle" className="text-2xl font-bold mb-4 pr-12 text-zinc-900">Ride Details</h2>
                    {selectedRide.driver && (
                      <div className="flex items-center gap-3 mb-6 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <UserAvatar src={selectedRide.driver.profilePictureUrl} name={selectedRide.driver.name} size="md" />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{selectedRide.driver.name ?? "Driver"}</p>
                          <p className="text-xs text-zinc-500">Driver</p>
                        </div>
                      </div>
                    )}
                    {/* --- VIEW MODE --- */}
                    <div className="space-y-6">
                      {/* Origin & Destination */}
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

                      {/* Departure Window */}
                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                          <ClockIcon /> Departure Window
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">Earliest</label>
                            <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                              {format(new Date(selectedRide.earliestDepartAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 mb-1">Latest</label>
                            <div className="bg-white border border-zinc-200 rounded-xl p-3 text-zinc-800 shadow-sm">
                              {format(new Date(selectedRide.latestDepartAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Seats & Price */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <UsersIcon /> Seats Available
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 font-medium text-lg">
                            {selectedRide.seatsAvailable} <span className="text-zinc-500 font-normal text-sm ml-1">of {selectedRide.seatsTotal}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold">
                            <span className="font-bold text-lg leading-none">$</span> Price/Seat
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
                            <p className="font-medium text-zinc-800">{formatMusicPreference(selectedRide.musicPreference)}</p>
                          </div>
                          <div className="bg-white border border-zinc-200 rounded-xl p-3">
                            <p className="text-zinc-500">Vehicle type</p>
                            <p className="font-medium text-zinc-800">{formatVehicleType(selectedRide.vehicleType)}</p>
                          </div>
                          <div className="bg-white border border-zinc-200 rounded-xl p-3">
                            <p className="text-zinc-500">AC available</p>
                            <p className="font-medium text-zinc-800">{formatOptionalFeature(selectedRide.hasAc)}</p>
                          </div>
                          <div className="bg-white border border-zinc-200 rounded-xl p-3">
                            <p className="text-zinc-500">Trunk space</p>
                            <p className="font-medium text-zinc-800">{formatOptionalFeature(selectedRide.hasTrunkSpace)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Instructions if available */}
                      {(selectedRide.pickupInstructions || selectedRide.dropoffInstructions) && (
                        <div className="pt-2">
                          <h4 className="font-semibold text-zinc-900 mb-3">Notes from driver</h4>
                          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 space-y-3">
                            {selectedRide.pickupInstructions && (
                              <p><span className="font-semibold">Pickup:</span> {selectedRide.pickupInstructions}</p>
                            )}
                            {selectedRide.dropoffInstructions && (
                              <p><span className="font-semibold">Dropoff:</span> {selectedRide.dropoffInstructions}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {isConfirmingRideCancellation ? (
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
                      {/* Check if the current user is the driver */}
                      {currentUser?.localUser?.clerkUserId === selectedRide.driverUserId ? (
                        <>
                          <button
                            onClick={startEditing}
                            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl transition-colors"
                          >
                            Edit Ride
                          </button>
                          {isConfirmingRideCancellation ? (
                            <>
                              <button
                                onClick={() => setIsConfirmingRideCancellation(false)}
                                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium rounded-xl transition-colors"
                              >
                                Keep Ride
                              </button>
                              <button
                                onClick={() => handleCancelRide(selectedRide.id)}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
                              >
                                Confirm Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setIsConfirmingRideCancellation(true)}
                              className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors"
                            >
                              Cancel Ride
                            </button>
                          )}
                        </>
                      ) : userBookings[selectedRide.id] ? (
                        <div className="flex flex-col items-end gap-3 w-full">
                          <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl text-sm font-medium border border-emerald-100 flex items-center gap-2">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 bg-emerald-500 rounded-full"
                            />
                            You have a confirmed booking for this ride
                          </div>
                          <button
                            onClick={() => handleCancelBooking(selectedRide.id, userBookings[selectedRide.id])}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            <X size={18} />
                            Cancel My Booking
                          </button>
                        </div>
                      ) : selectedRide.seatsAvailable <= 0 ? (
                        <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-xl text-sm font-medium border border-amber-200">
                          Sold out: no seats remaining for this ride.
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label htmlFor="seatSelect" className="text-sm font-medium text-zinc-600 whitespace-nowrap">
                              Seats to book:
                            </label>
                            <select
                              id="seatSelect"
                              title="Number of seats to book"
                              value={selectedSeats}
                              onChange={(e) =>
                                setSelectedSeats(
                                  Math.min(
                                    Math.max(parseInt(e.target.value, 10) || 1, 1),
                                    selectedRide.seatsAvailable
                                  )
                                )
                              }
                              className="bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium min-w-[4rem]"
                            >
                              {Array.from({ length: selectedRide.seatsAvailable }, (_, i) => i + 1).map((num) => (
                                <option key={num} value={num}>{num}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => {
                              if (selectedRide.seatsAvailable <= 0) {
                                alert("No seats available for this ride.");
                                return;
                              }
                              handleBookRide(selectedRide.id);
                            }}
                            disabled={bookingInProgress}
                            className="px-8 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl shadow-sm transition-colors text-lg whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {bookingInProgress && bookingIdempotencyKey ? "Booking..." : "Book Ride"}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      <BrowsePageFooter />
    </ProtectedShell>
  );
}
