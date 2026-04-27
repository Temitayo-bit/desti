export type DistanceCategory = "SHORT" | "MEDIUM" | "LONG";

export type MusicPreference = "MUSIC_ALLOWED" | "NO_MUSIC";

export type VehicleType = "SEDAN" | "SUV" | "TRUCK" | "VAN" | "COUPE" | "OTHER";

export interface DashboardRideSummary {
  id: string;
  originText: string;
  destinationText: string;
  earliestDepartAt: string;
  latestDepartAt: string;
  preferredDepartAt: string | null;
  distanceCategory: DistanceCategory;
  priceCents: number;
  seatsTotal: number;
  seatsAvailable: number;
  status: "ACTIVE";
  driverName?: string | null;
  hasAc?: boolean | null;
  hasTrunkSpace?: boolean | null;
  musicPreference?: MusicPreference | null;
  vehicleType?: VehicleType | null;
}

export interface DashboardRideInBooking {
  id: string;
  driverUserId: string;
  originText: string;
  originLatitude?: number | null;
  originLongitude?: number | null;
  destinationText: string;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  earliestDepartAt: string;
  latestDepartAt: string;
  preferredDepartAt: string | null;
  distanceCategory: DistanceCategory;
  priceCents: number;
  seatsTotal: number;
  seatsAvailable: number;
  status: "ACTIVE";
  driverName?: string | null;
  vehicleType?: VehicleType | null;
}

export interface DashboardTripRequestInBooking {
  id: string;
  originText: string;
  originLatitude?: number | null;
  originLongitude?: number | null;
  destinationText: string;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  earliestDesiredAt: string;
  latestDesiredAt: string;
  preferredDepartAt: string | null;
  distanceCategory: DistanceCategory;
  seatsNeeded: number;
  status: "ACTIVE" | "CLOSED" | "CANCELLED";
  driverName?: string | null;
}

export interface DashboardBookingBase {
  id: string;
  riderUserId: string;
  driverUserId: string | null;
  status: "CONFIRMED" | "CANCELLED";
  seatsBooked: number;
  priceCents: number | null;
  createdAt: string;
}

export type DashboardBookingItem =
  | (DashboardBookingBase & {
      ride: DashboardRideInBooking;
      tripRequest?: never;
    })
  | (DashboardBookingBase & {
      tripRequest: DashboardTripRequestInBooking;
      ride?: never;
    });

export interface DashboardOfferSummary {
  id: string;
  tripRequestId: string;
  driverUserId: string;
  riderUserId: string;
  seatsOffered: number;
  priceCents: number;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "CANCELLED";
  createdAt: string;
  tripRequest: {
    id: string;
    originText: string;
    destinationText: string;
    earliestDesiredAt: string;
    latestDesiredAt: string;
    preferredDepartAt: string | null;
    distanceCategory: DistanceCategory;
    seatsNeeded: number;
    status: "ACTIVE" | "CLOSED" | "CANCELLED";
  };
  driver: {
    name: string | null;
  } | null;
}

export interface DashboardResponse {
  now: string;
  summary: {
    activeRidesDrivingCount: number;
    confirmedBookingsCount: number;
    passengerBookingsCount: number;
    pendingOffersSentCount: number;
    pendingOffersReceivedCount: number;
  };
  upcoming: {
    ridesDriving: DashboardRideSummary[];
    bookings: DashboardBookingItem[];
    offers: {
      sent: DashboardOfferSummary[];
      received: DashboardOfferSummary[];
    };
  };
}

export interface NormalizedDashboardBooking {
  id: string;
  riderUserId: string;
  driverUserId: string | null;
  status: "CONFIRMED" | "CANCELLED";
  seatsBooked: number;
  totalSeatsBooked: number | null;
  originText: string;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationText: string;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  startsAt: string;
  endsAt: string;
  distanceCategory: DistanceCategory;
  priceCents: number | null;
  driverName: string | null;
  vehicleType: VehicleType | null;
}

export function normalizeDashboardBooking(
  booking: DashboardBookingItem
): NormalizedDashboardBooking {
  if ("ride" in booking && booking.ride) {
    return {
      id: booking.id,
      riderUserId: booking.riderUserId,
      driverUserId: booking.ride.driverUserId,
      status: booking.status,
      seatsBooked: booking.seatsBooked,
      totalSeatsBooked: Math.max(
        0,
        booking.ride.seatsTotal - booking.ride.seatsAvailable
      ),
      originText: booking.ride.originText,
      originLatitude: booking.ride.originLatitude ?? null,
      originLongitude: booking.ride.originLongitude ?? null,
      destinationText: booking.ride.destinationText,
      destinationLatitude: booking.ride.destinationLatitude ?? null,
      destinationLongitude: booking.ride.destinationLongitude ?? null,
      startsAt: booking.ride.earliestDepartAt,
      endsAt: booking.ride.latestDepartAt,
      distanceCategory: booking.ride.distanceCategory,
      priceCents: booking.priceCents ?? booking.ride.priceCents,
      driverName: booking.ride.driverName ?? null,
      vehicleType: booking.ride.vehicleType ?? null,
    };
  }

  return {
    id: booking.id,
    riderUserId: booking.riderUserId,
    driverUserId: booking.driverUserId,
    status: booking.status,
    seatsBooked: booking.seatsBooked,
    totalSeatsBooked: booking.seatsBooked,
    originText: booking.tripRequest.originText,
    originLatitude: booking.tripRequest.originLatitude ?? null,
    originLongitude: booking.tripRequest.originLongitude ?? null,
    destinationText: booking.tripRequest.destinationText,
    destinationLatitude: booking.tripRequest.destinationLatitude ?? null,
    destinationLongitude: booking.tripRequest.destinationLongitude ?? null,
    startsAt: booking.tripRequest.earliestDesiredAt,
    endsAt: booking.tripRequest.latestDesiredAt,
    distanceCategory: booking.tripRequest.distanceCategory,
    priceCents: booking.priceCents,
    driverName: booking.tripRequest.driverName ?? null,
    vehicleType: null,
  };
}

export function getSeatDisplayText(
  booking: NormalizedDashboardBooking,
  viewerUserId: string | null
): string {
  const isViewerDriver =
    Boolean(viewerUserId) && booking.driverUserId === viewerUserId;

  if (isViewerDriver) {
    const total = booking.totalSeatsBooked ?? booking.seatsBooked;
    return `${total} ${total === 1 ? "seat" : "seats"} booked total`;
  }

  const booked = booking.seatsBooked;
  return `${booked} ${booked === 1 ? "seat" : "seats"} booked`;
}

export function formatRelativeTime(
  isoDate: string,
  nowDate: Date = new Date()
): string {
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return "just now";

  const diffSeconds = Math.max(
    0,
    Math.floor((nowDate.getTime() - then.getTime()) / 1000)
  );
  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}

export function toDistanceLabel(value: DistanceCategory): string {
  const labels: Record<DistanceCategory, string> = {
    SHORT: "Short Distance",
    MEDIUM: "Medium Distance",
    LONG: "Long Distance",
  };

  return labels[value];
}
