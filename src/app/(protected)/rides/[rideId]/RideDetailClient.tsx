"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { User, MapPin, Calendar, Check, X, CarFront, Flag } from "lucide-react";
import { ProtectedShell } from "../../_components/ProtectedShell";
import { StaticRouteMap } from "@/components/StaticRouteMap";
import { UserAvatar } from "@/components/UserAvatar";
import type { DistanceCategory, MusicPreference, VehicleType } from "@prisma/client";
import { LocationAutocompleteInput } from "@/components/LocationAutocompleteInput";
import {
  createEmptyLocationField,
  createLocationFieldFromSelection,
  updateLocationFieldInput,
  hasValidLocationFieldSelection,
} from "@/lib/location-field";
import { partitionPrismaMatches } from "@/lib/match-lifecycle-partition";
import { MatchLifecycleBadge } from "@/components/MatchLifecycleBadge";

interface RideDetailClientProps {
  ride: any;
  currentUserClerkId: string;
}

const STOP_REQUEST_STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-900" },
  QUOTED: { label: "Quoted", className: "bg-sky-100 text-sky-900" },
  ACCEPTED: { label: "Accepted", className: "bg-emerald-100 text-emerald-900" },
  REJECTED: { label: "Rejected", className: "bg-zinc-200 text-zinc-700" },
};

function StopRequestStatusBadge({ state }: { state: string }) {
  const s = STOP_REQUEST_STATUS_STYLES[state] ?? STOP_REQUEST_STATUS_STYLES.PENDING;
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${s.className}`}>
      {s.label}
    </span>
  );
}

export function RideDetailClient({ ride, currentUserClerkId }: RideDetailClientProps) {
  const router = useRouter();
  const isOwner = ride.driverUserId === currentUserClerkId;
  const isCancelled = ride.status === "CANCELLED";

  // Action States
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Stop Request Modal
  const [isStopRequestModalOpen, setIsStopRequestModalOpen] = useState(false);
  const [stopRequestSuccess, setStopRequestSuccess] = useState(false);
  const [stopRequestData, setStopRequestData] = useState({
    pickup: createEmptyLocationField(),
    dropoff: createEmptyLocationField(),
    note: "",
  });

  // Offer Modal
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");

  // Stop Request – driver quote modal / reject; rider accept
  const [quoteModalForId, setQuoteModalForId] = useState<string | null>(null);
  const [quoteModalPrice, setQuoteModalPrice] = useState("");
  const [quoteModalSubmitting, setQuoteModalSubmitting] = useState(false);
  const [quoteModalError, setQuoteModalError] = useState<string | null>(null);
  const [acceptStopRequestId, setAcceptStopRequestId] = useState<string | null>(null);
  const [acceptStopError, setAcceptStopError] = useState<string | null>(null);
  const [stopActionPending, setStopActionPending] = useState<Record<string, boolean>>({});
  const [offerActionPending, setOfferActionPending] = useState<Record<string, boolean>>({});
  const [offerActionNotice, setOfferActionNotice] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [bookingNotice, setBookingNotice] = useState<string | null>(null);

  // Edit Modal State
  const [editFormData, setEditFormData] = useState({
    originText: ride.originText,
    destinationText: ride.destinationText,
    earliestDepartAt: format(new Date(ride.earliestDepartAt), "yyyy-MM-dd'T'HH:mm"),
    latestDepartAt: format(new Date(ride.latestDepartAt), "yyyy-MM-dd'T'HH:mm"),
    seatsTotal: ride.seatsTotal,
    priceDollars: (ride.priceCents / 100).toFixed(2),
    musicPreference: ride.musicPreference ?? "",
    hasAc: ride.hasAc === true ? "true" : ride.hasAc === false ? "false" : "",
    hasTrunkSpace: ride.hasTrunkSpace === true ? "true" : ride.hasTrunkSpace === false ? "false" : "",
    vehicleType: ride.vehicleType ?? "",
    pickupInstructions: ride.pickupInstructions ?? "",
    dropoffInstructions: ride.dropoffInstructions ?? "",
  });

  const hasConfirmedBooking =
    ride.bookings &&
    ride.bookings.some((b: any) => b.status === "CONFIRMED" || b.status === "COMPLETED");

  const stopRequestsChronological = [...(ride.stopRequests ?? [])].sort(
    (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const myConfirmedBookingOnRide = ride.bookings?.find(
    (b: any) =>
      b.riderUserId === currentUserClerkId &&
      (b.status === "CONFIRMED" || b.status === "COMPLETED")
  );

  const { suggested: suggestedMatches, accepted: acceptedMatches, expired: expiredMatches } =
    useMemo(
      () => partitionPrismaMatches(ride.matches ?? []),
      [ride.matches],
    );

  const handleBookRide = async () => {
    if (bookingInProgress || ride.seatsAvailable <= 0 || isOwner) return;

    setBookingInProgress(true);
    setBookingNotice(null);
    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          rideId: ride.id,
          seatsBooked: 1,
        }),
      });

      if (res.ok) {
        setBookingNotice("Booking successful!");
        router.refresh();
      } else {
        const text = await res.text();
        let message = "Failed to book ride.";
        try { message = (JSON.parse(text) as any).message || (JSON.parse(text) as any).error || message; } catch { message = text || message; }
        setBookingNotice(message);
      }
    } catch (err) {
      console.error("[handleBookRide]", err);
      setBookingNotice("Network error. Please try again.");
    } finally {
      setBookingInProgress(false);
    }
  };

  const handleSendOffer = async () => {
    const cents = Math.round(Number(offerPrice) * 100);
    if (!offerPrice || isNaN(cents) || cents < 1) {
      alert("Please enter a valid price (minimum $0.01).");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/rides/${ride.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offeredPriceCents: cents }),
      });
      if (res.ok) {
        alert("Offer sent!");
        setIsOfferModalOpen(false);
        router.refresh();
      } else {
        const text = await res.text();
        let message = "Failed to send offer";
        try { message = (JSON.parse(text) as any).message || message; } catch { message = text || message; }
        alert(message);
      }
    } catch (e) {
      alert("Error sending offer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateStopRequest = async () => {
    if (!hasValidLocationFieldSelection(stopRequestData.pickup) || !hasValidLocationFieldSelection(stopRequestData.dropoff)) {
      alert("Please select valid pickup and dropoff locations from the suggestions.");
      return;
    }
    try {
      setSubmitting(true);
      // We assume basic string passing for MVP; no geocoding locally here as backend handles or we mock.
      // Normally we'd use Mapbox autocomplete, but for scope we'll pass text and let backend throw if needed.
      const res = await fetch(`/api/rides/${ride.id}/stop-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedPickupText: stopRequestData.pickup.inputText,
          requestedPickupLatitude: stopRequestData.pickup.latitude,
          requestedPickupLongitude: stopRequestData.pickup.longitude,
          requestedDropoffText: stopRequestData.dropoff.inputText,
          requestedDropoffLatitude: stopRequestData.dropoff.latitude,
          requestedDropoffLongitude: stopRequestData.dropoff.longitude,
          riderNote: stopRequestData.note || undefined,
        }),
      });
      if (res.ok) {
        setStopRequestSuccess(true);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to create stop request");
      }
    } catch (e) {
      alert("Error creating stop request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    const parsedPriceCents = Math.round(Number(editFormData.priceDollars) * 100);
    if (!editFormData.priceDollars || isNaN(parsedPriceCents) || parsedPriceCents < 1) {
      setEditError("Please enter a valid price greater than $0.");
      return;
    }
    setEditError(null);
    try {
      setSubmitting(true);
      const res = await fetch(`/api/rides/${ride.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originText: editFormData.originText,
          destinationText: editFormData.destinationText,
          earliestDepartAt: new Date(editFormData.earliestDepartAt).toISOString(),
          latestDepartAt: new Date(editFormData.latestDepartAt).toISOString(),
          seatsTotal: editFormData.seatsTotal,
          priceCents: parsedPriceCents,
          musicPreference: editFormData.musicPreference || null,
          hasAc: editFormData.hasAc === "true" ? true : editFormData.hasAc === "false" ? false : null,
          hasTrunkSpace: editFormData.hasTrunkSpace === "true" ? true : editFormData.hasTrunkSpace === "false" ? false : null,
          vehicleType: editFormData.vehicleType || null,
          pickupInstructions: editFormData.pickupInstructions || null,
          dropoffInstructions: editFormData.dropoffInstructions || null,
        })
      });

      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const text = await res.text();
        let message = "Failed to update ride";
        try { message = (JSON.parse(text) as any).message || message; } catch { message = text || message; }
        setEditError(message);
      }
    } catch {
      setEditError("Network error updating ride.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRide = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/rides/${ride.id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Ride cancelled successfully.");
        setIsCancelling(false);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to cancel ride");
      }
    } catch (err) {
      alert("Error cancelling ride.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeRange = (earliest: string, latest: string) => {
    try {
      const d1 = new Date(earliest);
      const d2 = new Date(latest);
      if (d1.toDateString() === d2.toDateString()) {
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
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  return (
    <ProtectedShell
      activeNav="browse"
      layout="topnav"
      topNavActive="rides"
      topNavPrimaryAction={{ label: "Create Ride", href: "/post-ride" }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-sm font-semibold text-[#006837] hover:underline">
            &larr; Back
          </button>
          {isCancelled && <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">CANCELLED</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-100">
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-2">
                {ride.originText} to {ride.destinationText}
              </h1>
              <p className="text-zinc-500 mb-8 font-medium">
                {formatTimeRange(ride.earliestDepartAt, ride.latestDepartAt)}
              </p>

              <div className="relative pl-6 border-l-2 border-dashed border-zinc-200 space-y-8 mb-8">
                <div className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-4 border-white bg-[#006837] shadow-sm" />
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Origin</p>
                  <p className="text-base font-semibold text-zinc-900">{ride.originText}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-4 border-white bg-[#006837] shadow-sm" />
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Destination</p>
                  <p className="text-base font-semibold text-zinc-900">{ride.destinationText}</p>
                </div>
              </div>

              <StaticRouteMap
                originLatitude={ride.originLatitude}
                originLongitude={ride.originLongitude}
                destinationLatitude={ride.destinationLatitude}
                destinationLongitude={ride.destinationLongitude}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
                <h3 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#006837]" /> Instructions
                </h3>
                <div className="space-y-3 text-sm text-zinc-600">
                  <div>
                    <span className="font-semibold block text-zinc-800">Pickup:</span>
                    {ride.pickupInstructions || "None specified."}
                  </div>
                  <div>
                    <span className="font-semibold block text-zinc-800">Dropoff:</span>
                    {ride.dropoffInstructions || "None specified."}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
                <h3 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  <CarFront className="w-5 h-5 text-[#006837]" /> Ride Rules
                </h3>
                <ul className="space-y-2 text-sm text-zinc-600">
                  <li><span className="font-medium">Music:</span> {formatMusicPreference(ride.musicPreference)}</li>
                  <li><span className="font-medium">A/C:</span> {formatOptionalFeature(ride.hasAc)}</li>
                  <li><span className="font-medium">Trunk Space:</span> {formatOptionalFeature(ride.hasTrunkSpace)}</li>
                  <li><span className="font-medium">Vehicle:</span> {formatVehicleType(ride.vehicleType)}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Driver & Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Your Driver</h3>
              <div className="flex items-center gap-4 mb-4">
                <UserAvatar src={ride.driver?.profilePictureUrl} name={ride.driver?.name} size="lg" />
                <div>
                  <p className="font-bold text-zinc-900 text-lg">{ride.driver?.name || "Driver"}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#006837] rounded-3xl p-6 text-white shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">Availability</p>
                  <p className="text-3xl font-bold">{ride.seatsAvailable} <span className="text-lg font-normal opacity-80">Seats Left</span></p>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl">
                  <User className="w-6 h-6 text-white" />
                </div>
              </div>
              
              <div className="flex justify-between items-end mb-6">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">Price per seat</p>
                  <p className="text-3xl font-bold">${(ride.priceCents / 100).toFixed(0)}</p>
                </div>
              </div>

              {!isOwner && !isCancelled && ride.seatsAvailable > 0 && (
                <div className="space-y-3">
                  {bookingNotice && (
                    <p className="text-sm font-medium text-white/90 bg-white/10 rounded-xl px-3 py-2">{bookingNotice}</p>
                  )}
                  <button
                    onClick={handleBookRide}
                    disabled={bookingInProgress}
                    className="w-full bg-white text-[#006837] hover:bg-zinc-50 font-bold py-4 rounded-xl transition shadow-sm disabled:opacity-50"
                  >
                    {bookingInProgress ? "Booking..." : "Book Ride"}
                  </button>
                  <button
                    onClick={() => setIsOfferModalOpen(true)}
                    className="w-full bg-[#005a2f] text-white hover:bg-[#004d28] font-semibold py-3 rounded-xl transition border border-white/20"
                  >
                    Send Ride Offer
                  </button>
                  <button
                    onClick={() => setIsStopRequestModalOpen(true)}
                    className="w-full bg-[#005a2f] text-white hover:bg-[#004d28] font-semibold py-3 rounded-xl transition border border-white/20"
                  >
                    Create Stop Request
                  </button>
                </div>
              )}

              {isOwner && !isCancelled && (
                <div className="space-y-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full bg-white text-[#006837] hover:bg-zinc-50 font-bold py-3 rounded-xl transition shadow-sm"
                  >
                    Edit Ride
                  </button>
                  <button
                    onClick={() => setIsCancelling(true)}
                    className="w-full bg-red-500 text-white hover:bg-red-600 font-bold py-3 rounded-xl transition shadow-sm"
                  >
                    Cancel Ride
                  </button>
                </div>
              )}

              {isCancelled && (
                <div className="mt-4 bg-white/10 rounded-xl p-4 text-center">
                  <p className="font-medium text-white/90">This ride has been cancelled.</p>
                </div>
              )}
            </div>

            {!isOwner && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100">
                <h3 className="font-bold text-zinc-900 mb-4">Your stop request</h3>
                {stopRequestsChronological.length === 0 ? (
                  <p className="text-sm text-zinc-500">No stop request yet for this ride.</p>
                ) : (
                  <div className="space-y-4">
                    {stopRequestsChronological.map((req: any) => {
                      const busyAccept = acceptStopRequestId === req.id;
                      return (
                        <div key={req.id} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Status</p>
                            <StopRequestStatusBadge state={req.state} />
                          </div>
                          <p className="text-xs text-zinc-600 mt-1">
                            <span className="font-semibold text-zinc-800">Pickup:</span>{" "}
                            {req.requestedPickupText}
                          </p>
                          <p className="text-xs text-zinc-600">
                            <span className="font-semibold text-zinc-800">Dropoff:</span>{" "}
                            {req.requestedDropoffText}
                          </p>
                          {req.riderNote ? (
                            <p className="text-xs text-zinc-500 italic mt-2">&ldquo;{req.riderNote}&rdquo;</p>
                          ) : null}

                          {req.state === "QUOTED" && req.quotedPriceCents != null && (
                            <div className="mt-4 space-y-2">
                              <p className="text-sm font-semibold text-zinc-900">
                                Quoted price:{" "}
                                <span className="text-[#006837]">
                                  ${(req.quotedPriceCents / 100).toFixed(2)}
                                </span>
                              </p>
                              {acceptStopError && (
                                <p className="text-xs text-red-600">{acceptStopError}</p>
                              )}
                              <button
                                type="button"
                                disabled={busyAccept}
                                onClick={async () => {
                                  setAcceptStopError(null);
                                  setAcceptStopRequestId(req.id);
                                  try {
                                    const res = await fetch(`/api/stop-requests/${req.id}/accept`, {
                                      method: "POST",
                                    });
                                    if (res.ok) {
                                      setAcceptStopError(null);
                                      router.refresh();
                                    } else {
                                      const d = await res.json().catch(() => ({}));
                                      setAcceptStopError(
                                        d.message || "Could not accept this quote."
                                      );
                                    }
                                  } catch {
                                    setAcceptStopError("Network error. Please try again.");
                                  } finally {
                                    setAcceptStopRequestId(null);
                                  }
                                }}
                                className="w-full bg-[#006837] text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50"
                              >
                                {busyAccept ? "Accepting…" : "Accept quote"}
                              </button>
                            </div>
                          )}

                          {req.state === "ACCEPTED" && (
                            <div className="mt-4 space-y-1 text-sm text-zinc-700">
                              <p className="font-medium text-emerald-800">Your stop is confirmed.</p>
                              {myConfirmedBookingOnRide ? (
                                <p className="text-xs text-zinc-600">
                                  Confirmed booking{" "}
                                  {myConfirmedBookingOnRide.priceCents != null
                                    ? `at $${(myConfirmedBookingOnRide.priceCents / 100).toFixed(2)} per seat`
                                    : ""}
                                  .
                                </p>
                              ) : (
                                <p className="text-xs text-zinc-500">
                                  Your seat is booked. Refresh if details are still updating.
                                </p>
                              )}
                            </div>
                          )}

                          {req.state === "REJECTED" && (
                            <p className="mt-4 text-sm font-semibold text-zinc-700">Request declined</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Owner Management Section */}
            {isOwner && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100">
                  <h3 className="font-bold text-zinc-900 mb-4">Pending Offers</h3>
                  {bookingNotice && (
                    <p className="mb-3 text-xs font-medium text-emerald-700">{bookingNotice}</p>
                  )}
                  {offerActionNotice && (
                    <p className="mb-3 text-xs text-emerald-700 font-medium">{offerActionNotice}</p>
                  )}
                  {(() => {
                    const pendingOffers = ride.rideOffers?.filter((o: any) => o.state === "PENDING") ?? [];
                    return pendingOffers.length > 0 ? (
                      <div className="space-y-4">
                        {pendingOffers.map((offer: any) => {
                          const busy = !!offerActionPending[offer.id];
                          return (
                            <div key={offer.id} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                              <p className="font-medium text-sm text-zinc-900 mb-1">
                                {offer.rider.name} offered ${(offer.offeredPriceCents / 100).toFixed(2)}
                              </p>
                              <div className="flex gap-2 mt-3">
                                <button
                                  disabled={busy}
                                  onClick={async () => {
                                    setOfferActionPending(p => ({ ...p, [offer.id]: true }));
                                    setOfferActionNotice(null);
                                    try {
                                      const res = await fetch(`/api/ride-offers/${offer.id}/accept`, { method: "POST" });
                                      if (res.ok) { setOfferActionNotice("Offer accepted!"); router.refresh(); }
                                      else { const d = await res.json(); setOfferActionNotice(d.message || "Failed to accept."); }
                                    } catch { setOfferActionNotice("Network error."); }
                                    finally { setOfferActionPending(p => { const n = {...p}; delete n[offer.id]; return n; }); }
                                  }}
                                  className="flex-1 bg-[#006837] text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                                >
                                  {busy ? "..." : "Accept"}
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={async () => {
                                    setOfferActionPending(p => ({ ...p, [offer.id]: true }));
                                    setOfferActionNotice(null);
                                    try {
                                      const res = await fetch(`/api/ride-offers/${offer.id}/reject`, { method: "POST" });
                                      if (res.ok) { setOfferActionNotice("Offer declined."); router.refresh(); }
                                      else { const d = await res.json(); setOfferActionNotice(d.message || "Failed to decline."); }
                                    } catch { setOfferActionNotice("Network error."); }
                                    finally { setOfferActionPending(p => { const n = {...p}; delete n[offer.id]; return n; }); }
                                  }}
                                  className="flex-1 bg-zinc-200 text-zinc-700 text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                                >
                                  {busy ? "..." : "Decline"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No pending offers.</p>
                    );
                  })()}
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100">
                  <h3 className="font-bold text-zinc-900 mb-4">Stop Requests</h3>
                  {stopRequestsChronological.length === 0 ? (
                    <p className="text-sm text-zinc-500">No stop requests yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {stopRequestsChronological.map((req: any) => (
                        <div key={req.id} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-sm text-zinc-900">{req.rider?.name ?? "Rider"}</p>
                            <StopRequestStatusBadge state={req.state} />
                          </div>
                          <p className="text-xs text-zinc-500">Pickup: {req.requestedPickupText}</p>
                          <p className="text-xs text-zinc-500">Dropoff: {req.requestedDropoffText}</p>
                          {req.riderNote && (
                            <p className="text-xs text-zinc-500 italic mt-1">&ldquo;{req.riderNote}&rdquo;</p>
                          )}

                          {req.state === "PENDING" && (
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                disabled={!!stopActionPending[req.id]}
                                onClick={() => {
                                  setQuoteModalForId(req.id);
                                  setQuoteModalPrice("");
                                  setQuoteModalError(null);
                                }}
                                className="flex-1 bg-[#006837] text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                              >
                                Quote price
                              </button>
                              <button
                                type="button"
                                disabled={!!stopActionPending[req.id]}
                                onClick={async () => {
                                  if (!confirm("Reject this stop request?")) return;
                                  setStopActionPending((p) => ({ ...p, [req.id]: true }));
                                  try {
                                    const res = await fetch(`/api/stop-requests/${req.id}/reject`, {
                                      method: "POST",
                                    });
                                    if (res.ok) {
                                      router.refresh();
                                    } else {
                                      const d = await res.json();
                                      alert(d.message || "Failed to reject.");
                                    }
                                  } catch {
                                    alert("Error rejecting stop request.");
                                  } finally {
                                    setStopActionPending((p) => {
                                      const n = { ...p };
                                      delete n[req.id];
                                      return n;
                                    });
                                  }
                                }}
                                className="flex-1 bg-zinc-200 text-zinc-700 text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                              >
                                {stopActionPending[req.id] ? "…" : "Reject"}
                              </button>
                            </div>
                          )}

                          {req.state === "QUOTED" && (
                            <p className="mt-3 text-xs font-medium text-zinc-600">
                              Waiting for rider response
                              {req.quotedPriceCents != null && (
                                <>
                                  {" "}
                                  · Quoted ${(req.quotedPriceCents / 100).toFixed(2)}
                                </>
                              )}
                            </p>
                          )}

                          {req.state === "ACCEPTED" && (
                            <p className="mt-3 text-xs font-medium text-emerald-800">Accepted — booking confirmed</p>
                          )}

                          {req.state === "REJECTED" && (
                            <p className="mt-3 text-xs font-medium text-zinc-600">You declined this request</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 space-y-6">
                  <div>
                    <h3 className="font-bold text-zinc-900 mb-1">Suggested trip requests</h3>
                    <p className="text-xs text-zinc-500 mb-4">
                      Active suggestions only. Rejected matches stay hidden.
                    </p>
                    {suggestedMatches.length > 0 ? (
                      <div className="space-y-4">
                        {suggestedMatches.map((match: any) => (
                          <div
                            key={match.id}
                            className="border border-zinc-100 rounded-xl p-4 bg-zinc-50"
                          >
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <MatchLifecycleBadge state="SUGGESTED" />
                            </div>
                            <p className="font-medium text-sm text-zinc-900 mb-1">
                              {match.tripRequest?.rider?.name
                                ? `Match with ${match.tripRequest.rider.name}`
                                : "Trip request match"}
                            </p>
                            <p className="text-xs text-zinc-500">
                              From: {match.tripRequest?.originText}
                            </p>
                            <p className="text-xs text-zinc-500">
                              To: {match.tripRequest?.destinationText}
                            </p>
                            <p className="text-xs font-semibold text-[#006837] mt-1">
                              Score: {Math.round(match.scoreSnapshot * 100)}%
                            </p>
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                className="w-full bg-[#006837] text-white text-xs font-bold py-2 rounded-lg"
                                onClick={() =>
                                  router.push(`/trip-requests/${match.tripRequestId}`)
                                }
                              >
                                View request
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No suggested matches yet.</p>
                    )}
                  </div>

                  {acceptedMatches.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-bold text-zinc-800 mb-3">Accepted pairing</h4>
                      <p className="text-xs text-zinc-500 mb-3">
                        The rider confirmed this route match. Open the trip request to send or
                        manage offers—not an open suggestion anymore.
                      </p>
                      <div className="space-y-4">
                        {acceptedMatches.map((match: any) => (
                          <div
                            key={match.id}
                            className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/40"
                          >
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <MatchLifecycleBadge state="ACCEPTED" />
                            </div>
                            <p className="font-medium text-sm text-zinc-900 mb-1">
                              {match.tripRequest?.rider?.name ?? "Trip request"}
                            </p>
                            <p className="text-xs text-zinc-500">
                              From: {match.tripRequest?.originText}
                            </p>
                            <p className="text-xs text-zinc-500">
                              To: {match.tripRequest?.destinationText}
                            </p>
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                className="w-full bg-[#006837] text-white text-xs font-bold py-2 rounded-lg"
                                onClick={() =>
                                  router.push(`/trip-requests/${match.tripRequestId}`)
                                }
                              >
                                Open trip request
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {expiredMatches.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-bold text-zinc-800 mb-3">Expired suggestions</h4>
                      <div className="space-y-4 opacity-90">
                        {expiredMatches.map((match: any) => (
                          <div
                            key={match.id}
                            className="border border-amber-100 rounded-xl p-4 bg-amber-50/30"
                          >
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <MatchLifecycleBadge state="EXPIRED" />
                            </div>
                            <p className="font-medium text-sm text-zinc-900 mb-1">
                              {match.tripRequest?.rider?.name ?? "Trip request"}
                            </p>
                            <p className="text-xs text-zinc-500">
                              From: {match.tripRequest?.originText}
                            </p>
                            <p className="text-xs text-zinc-500">
                              To: {match.tripRequest?.destinationText}
                            </p>
                            <p className="text-xs text-zinc-600 mt-2">
                              This suggestion is no longer active.
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
            <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-bold mb-6 text-zinc-900">Edit Ride</h2>
            
            {hasConfirmedBooking ? (
              <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium">
                This ride has confirmed bookings and cannot be edited. Please cancel the ride if you need to make changes.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Seats Total</label>
                    <input type="number" value={editFormData.seatsTotal} onChange={e => setEditFormData({...editFormData, seatsTotal: Number(e.target.value)})} className="w-full border rounded-xl p-3" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Price per Seat ($)</label>
                    <input type="number" min="0.01" step="0.01" value={editFormData.priceDollars} onChange={e => setEditFormData({...editFormData, priceDollars: e.target.value})} className="w-full border rounded-xl p-3" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Pickup Instructions</label>
                  <textarea value={editFormData.pickupInstructions} onChange={e => setEditFormData({...editFormData, pickupInstructions: e.target.value})} className="w-full border rounded-xl p-3" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Dropoff Instructions</label>
                  <textarea value={editFormData.dropoffInstructions} onChange={e => setEditFormData({...editFormData, dropoffInstructions: e.target.value})} className="w-full border rounded-xl p-3" />
                </div>
                {editError && <p className="text-sm text-red-600">{editError}</p>}
                <button onClick={handleEditSubmit} disabled={submitting} className="w-full bg-[#006837] text-white font-bold py-3 rounded-xl mt-4">
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative text-center">
            <h2 className="text-xl font-bold mb-4 text-zinc-900">Cancel Ride?</h2>
            <p className="text-zinc-500 mb-6 text-sm">Are you sure you want to cancel this ride? This action cannot be undone and will notify any booked passengers.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsCancelling(false)} className="flex-1 bg-zinc-100 text-zinc-700 font-bold py-3 rounded-xl">No, keep it</button>
              <button onClick={handleCancelRide} disabled={submitting} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl">
                {submitting ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            <button onClick={() => setIsOfferModalOpen(false)} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 text-zinc-900">Send Offer</h2>
            <p className="text-zinc-500 text-sm mb-4">Propose a new price per seat to the driver.</p>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Proposed Price ($)</label>
              <input type="number" placeholder="15.00" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} className="w-full border rounded-xl p-3" />
            </div>
            <button onClick={handleSendOffer} disabled={submitting} className="w-full bg-[#006837] text-white font-bold py-3 rounded-xl">
              {submitting ? "Sending..." : "Send Offer"}
            </button>
          </div>
        </div>
      )}

      {/* Driver: quote stop request (price only; backend has no message field) */}
      {quoteModalForId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            <button
              type="button"
              onClick={() => {
                if (!quoteModalSubmitting) {
                  setQuoteModalForId(null);
                  setQuoteModalPrice("");
                  setQuoteModalError(null);
                }
              }}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-2 text-zinc-900">Quote stop request</h2>
            <p className="text-zinc-500 text-sm mb-4">Set a price for this custom stop. The rider will accept or decline.</p>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Price ($)</label>
              <div className="flex items-center gap-0 rounded-lg bg-zinc-100 ring-1 ring-inset ring-zinc-200 focus-within:ring-2 focus-within:ring-[#006837]/30">
                <span className="pl-3 text-sm text-zinc-500">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={quoteModalPrice}
                  onChange={(e) => setQuoteModalPrice(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-3 text-sm text-zinc-900 outline-none"
                />
              </div>
            </div>
            {quoteModalError && <p className="text-sm text-red-600 mb-3">{quoteModalError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!quoteModalSubmitting) {
                    setQuoteModalForId(null);
                    setQuoteModalPrice("");
                    setQuoteModalError(null);
                  }
                }}
                className="flex-1 bg-zinc-100 text-zinc-800 font-bold py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={quoteModalSubmitting}
                onClick={async () => {
                  const id = quoteModalForId;
                  if (!id) return;
                  const cents = Math.round(Number(quoteModalPrice) * 100);
                  if (!cents || cents < 1) {
                    setQuoteModalError("Enter a valid price (minimum $0.01).");
                    return;
                  }
                  setQuoteModalSubmitting(true);
                  setQuoteModalError(null);
                  setStopActionPending((p) => ({ ...p, [id]: true }));
                  try {
                    const res = await fetch(`/api/stop-requests/${id}/quote`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ quotedPriceCents: cents }),
                    });
                    if (res.ok) {
                      setQuoteModalForId(null);
                      setQuoteModalPrice("");
                      router.refresh();
                    } else {
                      const d = await res.json().catch(() => ({}));
                      setQuoteModalError(d.message || "Failed to send quote.");
                    }
                  } catch {
                    setQuoteModalError("Error sending quote.");
                  } finally {
                    setQuoteModalSubmitting(false);
                    setStopActionPending((p) => {
                      const n = { ...p };
                      delete n[id];
                      return n;
                    });
                  }
                }}
                className="flex-1 bg-[#006837] text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {quoteModalSubmitting ? "Sending…" : "Send quote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Request Modal */}
      {isStopRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => {
                setIsStopRequestModalOpen(false);
                setStopRequestSuccess(false);
                setStopRequestData({ pickup: createEmptyLocationField(), dropoff: createEmptyLocationField(), note: "" });
              }}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={20} />
            </button>

            {stopRequestSuccess ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
                  <Check className="h-8 w-8 text-[#006837]" strokeWidth={2.5} />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 mb-2">Request Sent!</h2>
                <p className="text-sm text-zinc-500 mb-6">The driver will review your stop request and get back to you with a quote.</p>
                <button
                  onClick={() => {
                    setIsStopRequestModalOpen(false);
                    setStopRequestSuccess(false);
                    setStopRequestData({ pickup: createEmptyLocationField(), dropoff: createEmptyLocationField(), note: "" });
                  }}
                  className="w-full bg-[#006837] text-white font-bold py-3 rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4 text-zinc-900">Request a Stop</h2>
                <p className="text-zinc-500 text-sm mb-4">Ask the driver to make a custom stop along their route. They will review and quote a price.</p>
                <div className="space-y-4">
                  <div>
                    <LocationAutocompleteInput
                      id="stopPickup"
                      label="Pickup Location"
                      labelClassName="block text-sm font-semibold mb-1"
                      placeholder="e.g. Target on Main St"
                      locationField={stopRequestData.pickup}
                      startAdornment={<MapPin className="h-4 w-4" strokeWidth={2} />}
                      onInputChange={(nextValue) =>
                        setStopRequestData({
                          ...stopRequestData,
                          pickup: updateLocationFieldInput(stopRequestData.pickup, nextValue),
                        })
                      }
                      onSuggestionSelect={(selection) =>
                        setStopRequestData({
                          ...stopRequestData,
                          pickup: createLocationFieldFromSelection(selection),
                        })
                      }
                    />
                  </div>
                  <div>
                    <LocationAutocompleteInput
                      id="stopDropoff"
                      label="Dropoff Location"
                      labelClassName="block text-sm font-semibold mb-1"
                      placeholder="e.g. Orlando Airport Terminal A"
                      locationField={stopRequestData.dropoff}
                      startAdornment={<Flag className="h-4 w-4" strokeWidth={2} />}
                      onInputChange={(nextValue) =>
                        setStopRequestData({
                          ...stopRequestData,
                          dropoff: updateLocationFieldInput(stopRequestData.dropoff, nextValue),
                        })
                      }
                      onSuggestionSelect={(selection) =>
                        setStopRequestData({
                          ...stopRequestData,
                          dropoff: createLocationFieldFromSelection(selection),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Message (Optional)</label>
                    <textarea placeholder="Any specific details..." value={stopRequestData.note} onChange={e => setStopRequestData({...stopRequestData, note: e.target.value})} className="w-full border rounded-xl p-3 text-sm" />
                  </div>
                  <button onClick={handleCreateStopRequest} disabled={submitting} className="w-full bg-[#006837] text-white font-bold py-3 rounded-xl">
                    {submitting ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ProtectedShell>
  );
}
