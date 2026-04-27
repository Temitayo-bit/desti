"use client";

import { MessageCircle } from "lucide-react";
import type { ConfirmedBookingSummary } from "@/types/booking";

interface ConfirmedBookingsListProps {
  bookings: ConfirmedBookingSummary[];
  openingConversationBookingId: string | null;
  onMessage: (bookingId: string) => void;
  formatTimeRange: (earliest: string, latest: string) => string;
}

export function ConfirmedBookingsList({
  bookings,
  openingConversationBookingId,
  onMessage,
  formatTimeRange,
}: ConfirmedBookingsListProps) {
  if (bookings.length === 0) return null;

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <p className="mb-3 text-sm font-semibold text-zinc-900">
        Confirmed bookings ({bookings.length})
      </p>
      <div className="space-y-2">
        {bookings.map((booking) => {
          const opening = openingConversationBookingId === booking.id;
          return (
            <div
              key={booking.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    Booking #{booking.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {booking.seatsBooked}{" "}
                    {booking.seatsBooked === 1 ? "seat" : "seats"} ·{" "}
                    {formatTimeRange(booking.startsAt, booking.endsAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={opening}
                  onClick={() => onMessage(booking.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageCircle size={14} />
                  {opening ? "Opening..." : "Message"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
