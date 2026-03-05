"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { DistanceCategory } from "@/generated/prisma/client";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProtectedShell } from "./_components/ProtectedShell";

// --- Types ---
type RideStatus = "ACTIVE";
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
  pickupInstructions: string | null;
  dropoffInstructions: string | null;
  preferredDepartAt: string | null;
  status: RideStatus;
  createdAt: string;
  updatedAt: string;
}

interface EditRideFormData {
  originText?: string;
  destinationText?: string;
  earliestDepartAt?: string;
  latestDepartAt?: string;
  seatsTotal?: number;
  priceDollars?: string;
}

interface ConfirmedBookingSummary {
  id: string;
  rideId: string | null;
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

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 group-hover:text-emerald-600 transition-colors">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

// --- Component ---
export default function BrowseRidesPage() {
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
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<"booking" | "edit" | null>(null);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [userBookings, setUserBookings] = useState<Record<string, string>>({}); // rideId -> bookingId

  useEffect(() => {
    const controller = new AbortController();

    async function fetchRides() {
      try {
        setLoading(true);
        const res = await fetch("/api/rides", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch rides");
        const data = await res.json();
        if (!controller.signal.aborted) {
          setRides(data.items || []);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching rides:", err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

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

    fetchRides();
    fetchUser();
    fetchUserBookings();

    return () => {
      controller.abort();
    };
  }, []);

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

  // Filter rides based on search query (client-side as requested if no API)
  const filteredRides = rides.filter((ride) => {
    const matchesSearch = ride.destinationText.toLowerCase().includes(searchQuery.toLowerCase());

    // Quick filters logic
    if (activeFilter === "All") return matchesSearch;
    if (activeFilter === "Today") {
      const now = new Date();
      const rideDate = new Date(ride.earliestDepartAt);
      const isSameLocalDate =
        rideDate.getFullYear() === now.getFullYear() &&
        rideDate.getMonth() === now.getMonth() &&
        rideDate.getDate() === now.getDate();
      return matchesSearch && isSameLocalDate;
    }
    if (activeFilter === "Short") return matchesSearch && ride.distanceCategory === "SHORT";
    if (activeFilter === "Medium") return matchesSearch && ride.distanceCategory === "MEDIUM";
    if (activeFilter === "Long") return matchesSearch && ride.distanceCategory === "LONG";

    return matchesSearch;
  });
  const quickFilters = ["All", "Today", "Short", "Medium", "Long"] as const;

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

  const handleBookRide = async (rideId: string) => {
    try {
      const rideForBooking = rides.find((r) => r.id === rideId) ?? selectedRide;
      if (!rideForBooking || rideForBooking.seatsAvailable <= 0) {
        alert("No seats available for this ride.");
        return;
      }

      const seatsToBook = Math.min(
        Math.max(selectedSeats, 1),
        rideForBooking.seatsAvailable
      );

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
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
          setSelectedRide(null);
          setSuccessState(null);
        }, 2500);
        // In a real app we'd refresh the rides list here
      } else {
        const data = await res.json();
        alert(`Failed to book: ${data.message || data.error}`);
      }
    } catch (err: unknown) {
      alert(`Error booking ride: ${err instanceof Error ? err.message : String(err)}`);
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
        // We might want to refresh rides since seatsAvailable increased
        const refreshRes = await fetch("/api/rides");
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setRides(data.items || []);
          // Update selected ride if still open
          const updated = data.items.find((r: RideSummary) => r.id === rideId);
          if (updated) setSelectedRide(updated);
        }
      } else {
        const data = await res.json();
        alert(`Failed to cancel booking: ${data.message || data.error}`);
      }
    } catch (err) {
      alert("An error occurred while cancelling your booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRide = async (rideId: string) => {
    if (confirm("Are you sure you want to cancel this ride?")) {
      try {
        const res = await fetch(`/api/rides/${rideId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          alert("Ride cancelled successfully.");
          setRides((prev) => prev.filter((r) => r.id !== rideId));
          setSelectedRide(null);
        } else if (res.status === 501) {
          alert("Cancellation not implemented on server.");
        } else {
          alert("Failed to cancel ride.");
        }
      } catch (err: unknown) {
        alert("An error occurred while attempting to cancel the ride.");
      }
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
    });
    setIsEditing(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedRide) return;

    const parsedPriceDollars =
      editFormData.priceDollars !== undefined
        ? Number(editFormData.priceDollars)
        : NaN;
    if (!Number.isFinite(parsedPriceDollars) || parsedPriceDollars < 0) {
      alert("Price/Seat must be a valid non-negative dollar amount.");
      return;
    }

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
          priceCents: Math.round(parsedPriceDollars * 100),
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
        setSelectedRide(null);
        setSuccessState(null);
      }, 2500);

    } catch (err: unknown) {
      alert(`Error updating ride: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedShell activeNav="browse">

        {/* Top Header Section */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-zinc-100">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Browse Available Rides</h1>
              <p className="text-zinc-500">Find rides from verified Stetson students</p>
            </div>
            <Link
              href="/post-ride"
              className="bg-emerald-800 hover:bg-emerald-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Post a Ride
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <input
              type="text"
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium placeholder:font-normal"
            />
          </div>

          <div className="mt-5 -mx-1 px-1 overflow-x-auto">
            <div className="flex min-w-max gap-2 pb-1">
              {quickFilters.map((filterOpt) => (
                <button
                  key={filterOpt}
                  onClick={() => setActiveFilter(filterOpt)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeFilter === filterOpt
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
                    }`}
                >
                  {filterOpt}
                </button>
              ))}
              {/* TODO: Implement advanced filtering functionality
                  - Add modal/dropdown for advanced filter options
                  - Include filters for: price range, specific departure times, distance category combinations
                  - Add state management for advanced filter selections
                  - Update filteredRides logic to apply advanced filters */}
              <button className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap bg-white border border-emerald-800 text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                Advanced Filters
              </button>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="w-full max-w-5xl mx-auto">
          <div className="w-full min-w-0 bg-white rounded-2xl p-4 md:p-6 lg:p-8 shadow-sm border border-zinc-100">
            <p className="text-sm font-medium text-zinc-500 mb-4 md:mb-6 text-center">
              {filteredRides.length} {filteredRides.length === 1 ? 'ride' : 'rides'} available
            </p>

            {loading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-zinc-100 animate-pulse rounded-2xl"></div>
                ))}
              </div>
            ) : filteredRides.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1">No rides found</h3>
                <p className="text-zinc-500 max-w-sm mx-auto">We couldn&apos;t find any rides matching your current search and filter criteria.</p>
                {activeFilter !== "All" && (
                  <button
                    onClick={() => setActiveFilter("All")}
                    className="mt-4 text-emerald-700 font-medium hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredRides.map((ride) => (
                  <button
                    type="button"
                    key={ride.id}
                    onClick={() => {
                      setSelectedRide(ride);
                      setSelectedSeats(ride.seatsAvailable > 0 ? 1 : 0);
                    }}
                    className={`group w-full text-left bg-white border border-zinc-200 rounded-2xl p-5 transition-all relative overflow-hidden ${
                      ride.seatsAvailable <= 0
                        ? "opacity-70"
                        : "hover:border-emerald-500/50 hover:shadow-md cursor-pointer"
                    }`}
                  >
                    {/* Distance Badge */}
                    <div className="absolute top-5 right-5 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 shadow-sm">
                      {toTitleCase(ride.distanceCategory)}
                    </div>

                    <div className="pr-20">
                      <div className="flex items-start gap-3 mb-1">
                        <div className="mt-1">
                          <MapPinIcon />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg leading-tight text-zinc-900 group-hover:text-emerald-800 transition-colors">{ride.destinationText}</h3>
                          <p className="text-sm text-zinc-500 mt-0.5">from {ride.originText}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <ClockIcon />
                          {formatTimeRange(ride.earliestDepartAt, ride.latestDepartAt)}
                        </div>
                        <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md">
                          <UsersIcon />
                          {ride.seatsAvailable} {ride.seatsAvailable === 1 ? 'seat' : 'seats'}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 text-emerald-800">
                        <span className="font-bold text-xl">${(ride.priceCents / 100).toFixed(2)}</span>
                        <ArrowRightIcon />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      {/* Ride Details Modal Overlay */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 md:p-8 flex-1">
              <button
                onClick={() => {
                  setSelectedRide(null);
                  setSuccessState(null);
                  setSelectedSeats(1);
                  setIsEditing(false);
                  setEditFormData({});
                }}
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
                    <h2 className="text-3xl font-bold text-zinc-900">
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
                    <h2 className="text-2xl font-bold mb-8 pr-12 text-zinc-900">Edit Ride</h2>
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
                    <h2 className="text-2xl font-bold mb-8 pr-12 text-zinc-900">Ride Details</h2>
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
                          <button
                            onClick={() => handleCancelRide(selectedRide.id)}
                            className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors"
                          >
                            Cancel Ride
                          </button>
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
                            className="px-8 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl shadow-sm transition-colors text-lg whitespace-nowrap"
                          >
                            Book Ride
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

    </ProtectedShell>
  );
}