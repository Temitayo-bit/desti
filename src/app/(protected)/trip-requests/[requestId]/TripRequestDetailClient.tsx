"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { User, MapPin, Calendar, Check, X } from "lucide-react";
import { ProtectedShell } from "../../_components/ProtectedShell";
import { StaticRouteMap } from "@/components/StaticRouteMap";
import { UserAvatar } from "@/components/UserAvatar";
import { distanceCategoryLabel, formatDistanceMilesLabel } from "@/lib/browse-ride-filters";
import type { DistanceCategory } from "@prisma/client";

interface TripRequestDetailClientProps {
  tripRequest: any;
  currentUserClerkId: string;
}

export function TripRequestDetailClient({ tripRequest, currentUserClerkId }: TripRequestDetailClientProps) {
  const router = useRouter();
  const isOwner = tripRequest.riderUserId === currentUserClerkId;
  const isCancelled = tripRequest.status === "CANCELLED";

  // Action States
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Offer Modal
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerData, setOfferData] = useState({
    priceDollars: "",
    seatsOffered: "1",
    message: "",
  });
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState(false);

  // Edit Modal State
  const [editFormData, setEditFormData] = useState({
    originText: tripRequest.originText,
    destinationText: tripRequest.destinationText,
    earliestDesiredAt: format(new Date(tripRequest.earliestDesiredAt), "yyyy-MM-dd'T'HH:mm"),
    latestDesiredAt: format(new Date(tripRequest.latestDesiredAt), "yyyy-MM-dd'T'HH:mm"),
    seatsNeeded: tripRequest.seatsNeeded,
    pickupInstructions: tripRequest.pickupInstructions ?? "",
    dropoffInstructions: tripRequest.dropoffInstructions ?? "",
  });

  const hasConfirmedBooking =
    tripRequest.bookings &&
    tripRequest.bookings.some((b: any) => b.status === "CONFIRMED" || b.status === "COMPLETED");

  const handleSendOffer = async () => {
    const priceCents = Math.round(Number(offerData.priceDollars) * 100);
    const seatsOffered = parseInt(offerData.seatsOffered, 10);

    if (!offerData.priceDollars || isNaN(priceCents) || priceCents < 1) {
      setOfferError("Please enter a valid price (minimum $0.01).");
      return;
    }
    if (!seatsOffered || seatsOffered < 1 || seatsOffered > 8) {
      setOfferError("Please enter a valid number of seats (1–8).");
      return;
    }

    setOfferError(null);
    setOfferSubmitting(true);

    try {
      const res = await fetch(`/api/trip-requests/${tripRequest.id}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          seatsOffered,
          priceCents,
          message: offerData.message.trim() || null,
        }),
      });

      if (res.ok) {
        setOfferSuccess(true);
        router.refresh();
      } else {
        const text = await res.text();
        let message = "Failed to send offer.";
        try { message = (JSON.parse(text) as any).message || message; } catch { message = text || message; }
        setOfferError(message);
      }
    } catch {
      setOfferError("Network error. Please try again.");
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/trip-requests/${tripRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originText: editFormData.originText,
          destinationText: editFormData.destinationText,
          earliestDesiredAt: new Date(editFormData.earliestDesiredAt).toISOString(),
          latestDesiredAt: new Date(editFormData.latestDesiredAt).toISOString(),
          seatsNeeded: editFormData.seatsNeeded,
          pickupInstructions: editFormData.pickupInstructions || null,
          dropoffInstructions: editFormData.dropoffInstructions || null,
        })
      });

      if (res.ok) {
        alert("Trip Request updated!");
        setIsEditing(false);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to update request");
      }
    } catch (err) {
      alert("Error updating request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/trip-requests/${tripRequest.id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Trip Request cancelled successfully.");
        setIsCancelling(false);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to cancel request");
      }
    } catch (err) {
      alert("Error cancelling request.");
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

  return (
    <ProtectedShell activeNav="browse" layout="topnav" topNavActive="browse">
      <div className="max-w-5xl mx-auto px-4 py-8 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push("/browse-trip-requests");
            }}
            className="text-sm font-semibold text-[#006837] hover:underline"
          >
            &larr; Back
          </button>
          {isCancelled && <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">CANCELLED</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-100">
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider rounded-full">
                Trip Request
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-2">
                {tripRequest.originText} to {tripRequest.destinationText}
              </h1>
              <p className="text-zinc-500 mb-8 font-medium">
                Desired: {formatTimeRange(tripRequest.earliestDesiredAt, tripRequest.latestDesiredAt)}
              </p>

              <div className="relative pl-6 border-l-2 border-dashed border-zinc-200 space-y-8 mb-8">
                <div className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-4 border-white bg-amber-500 shadow-sm" />
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Origin</p>
                  <p className="text-base font-semibold text-zinc-900">{tripRequest.originText}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-4 border-white bg-amber-500 shadow-sm" />
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Destination</p>
                  <p className="text-base font-semibold text-zinc-900">{tripRequest.destinationText}</p>
                </div>
              </div>

              <StaticRouteMap
                originLatitude={tripRequest.originLatitude}
                originLongitude={tripRequest.originLongitude}
                destinationLatitude={tripRequest.destinationLatitude}
                destinationLongitude={tripRequest.destinationLongitude}
              />
            </div>

            <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
              <h3 className="font-bold text-zinc-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" /> Additional Notes
              </h3>
              <div className="space-y-3 text-sm text-zinc-600">
                <div>
                  <span className="font-semibold block text-zinc-800">Pickup Instructions:</span>
                  {tripRequest.pickupInstructions || "None specified."}
                </div>
                <div>
                  <span className="font-semibold block text-zinc-800">Dropoff Instructions:</span>
                  {tripRequest.dropoffInstructions || "None specified."}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Requester & Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Requester</h3>
              <div className="flex items-center gap-4">
                <UserAvatar src={tripRequest.rider?.profilePictureUrl} name={tripRequest.rider?.name} size="lg" />
                <div>
                  <p className="font-bold text-zinc-900 text-lg">{tripRequest.rider?.name || "Rider"}</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-600 rounded-3xl p-6 text-white shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">Seats Needed</p>
                  <p className="text-3xl font-bold">{tripRequest.seatsNeeded}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl">
                  <User className="w-6 h-6 text-white" />
                </div>
              </div>

              {!isOwner && !isCancelled && (
                <div className="space-y-3">
                  <button
                    onClick={() => { setIsOfferModalOpen(true); setOfferSuccess(false); setOfferError(null); }}
                    className="w-full bg-white text-amber-700 hover:bg-zinc-50 font-bold py-4 rounded-xl transition shadow-sm"
                  >
                    Offer a Ride
                  </button>
                </div>
              )}

              {isOwner && !isCancelled && (
                <div className="space-y-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full bg-white text-amber-700 hover:bg-zinc-50 font-bold py-3 rounded-xl transition shadow-sm"
                  >
                    Edit Request
                  </button>
                  <button
                    onClick={() => setIsCancelling(true)}
                    className="w-full bg-red-500 text-white hover:bg-red-600 font-bold py-3 rounded-xl transition shadow-sm"
                  >
                    Cancel Request
                  </button>
                </div>
              )}

              {isCancelled && (
                <div className="mt-4 bg-white/10 rounded-xl p-4 text-center">
                  <p className="font-medium text-white/90">This request has been cancelled.</p>
                </div>
              )}
            </div>

            {/* Owner Management Section */}
            {isOwner && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100">
                  <h3 className="font-bold text-zinc-900 mb-4">Offers Received</h3>
                  {tripRequest.offers?.filter((o: any) => o.status === "PENDING").length > 0 ? (
                    <div className="space-y-4">
                      {tripRequest.offers.filter((o: any) => o.status === "PENDING").map((offer: any) => (
                        <div key={offer.id} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                          <p className="font-medium text-sm text-zinc-900 mb-1">
                            {offer.driver?.name} offered a ride for ${(offer.priceCents / 100).toFixed(2)}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/offers/${offer.id}/accept`, { method: "POST" });
                                  if (res.ok) router.refresh();
                                  else { const d = await res.json(); alert(d.message || "Failed to accept."); }
                                } catch { alert("Network error."); }
                              }}
                              className="flex-1 bg-amber-600 text-white text-xs font-bold py-2 rounded-lg"
                            >
                              Accept
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/offers/${offer.id}/cancel`, { method: "POST" });
                                  if (res.ok) router.refresh();
                                  else { const d = await res.json(); alert(d.message || "Failed to decline."); }
                                } catch { alert("Network error."); }
                              }}
                              className="flex-1 bg-zinc-200 text-zinc-700 text-xs font-bold py-2 rounded-lg"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No pending offers.</p>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100">
                  <h3 className="font-bold text-zinc-900 mb-4">Matches Found</h3>
                  {tripRequest.matches?.length > 0 ? (
                    <div className="space-y-4">
                      {tripRequest.matches.map((match: any) => (
                        <div key={match.id} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                          <p className="font-medium text-sm text-zinc-900 mb-1">Match with {match.ride?.driver?.name}</p>
                          <p className="text-xs text-zinc-500">From: {match.ride?.originText}</p>
                          <p className="text-xs text-zinc-500">To: {match.ride?.destinationText}</p>
                          <p className="text-xs font-semibold text-amber-700 mt-1">Score: {Math.round(match.scoreSnapshot * 100)}%</p>
                          <div className="flex gap-2 mt-3">
                            <button className="w-full bg-amber-600 text-white text-xs font-bold py-2 rounded-lg" onClick={() => router.push(`/rides/${match.rideId}`)}>View Ride</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No matches found yet.</p>
                  )}
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
            <h2 className="text-2xl font-bold mb-6 text-zinc-900">Edit Trip Request</h2>
            
            {hasConfirmedBooking ? (
              <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium">
                This request is confirmed and cannot be edited.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Seats Needed</label>
                    <input type="number" value={editFormData.seatsNeeded} onChange={e => setEditFormData({...editFormData, seatsNeeded: Number(e.target.value)})} className="w-full border rounded-xl p-3" />
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
                <button onClick={handleEditSubmit} disabled={submitting} className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl mt-4">
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
            <h2 className="text-xl font-bold mb-4 text-zinc-900">Cancel Request?</h2>
            <p className="text-zinc-500 mb-6 text-sm">Are you sure you want to cancel this trip request?</p>
            <div className="flex gap-3">
              <button onClick={() => setIsCancelling(false)} className="flex-1 bg-zinc-100 text-zinc-700 font-bold py-3 rounded-xl">No, keep it</button>
              <button onClick={handleCancelRequest} disabled={submitting} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl">
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
            <button
              onClick={() => { setIsOfferModalOpen(false); setOfferSuccess(false); setOfferError(null); }}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={20} />
            </button>

            {offerSuccess ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
                  <Check className="h-8 w-8 text-amber-600" strokeWidth={2.5} />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 mb-2">Offer Sent!</h2>
                <p className="text-sm text-zinc-500 mb-6">The rider will review your offer and get back to you.</p>
                <button
                  onClick={() => { setIsOfferModalOpen(false); setOfferSuccess(false); }}
                  className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-1 text-zinc-900">Offer a Ride</h2>
                <p className="text-zinc-500 text-sm mb-4">Propose your ride to this requester. They&apos;ll accept if it&apos;s a good fit.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Price per Seat ($)</label>
                    <div className="flex items-center gap-0 rounded-xl bg-zinc-100 ring-1 ring-inset ring-zinc-200 focus-within:ring-2 focus-within:ring-amber-500/40">
                      <span className="pl-3 text-sm text-zinc-500">$</span>
                      <input
                        type="number" min="0" step="0.01" placeholder="0.00"
                        value={offerData.priceDollars}
                        onChange={e => setOfferData({ ...offerData, priceDollars: e.target.value })}
                        className="min-w-0 flex-1 border-0 bg-transparent py-3 pr-3 text-sm text-zinc-900 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Seats Offered</label>
                    <input
                      type="number" min="1" max="8" step="1"
                      value={offerData.seatsOffered}
                      onChange={e => setOfferData({ ...offerData, seatsOffered: e.target.value })}
                      className="w-full rounded-xl bg-zinc-100 px-3 py-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Message (Optional)</label>
                    <textarea
                      placeholder="Any details for the rider..."
                      value={offerData.message}
                      onChange={e => setOfferData({ ...offerData, message: e.target.value })}
                      className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/40"
                      rows={3}
                    />
                  </div>

                  {offerError && <p className="text-sm text-red-600">{offerError}</p>}

                  <button
                    onClick={handleSendOffer}
                    disabled={offerSubmitting}
                    className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
                  >
                    {offerSubmitting ? "Sending..." : "Send Offer"}
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
