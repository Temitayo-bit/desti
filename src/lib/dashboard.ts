export type DistanceCategory = "SHORT" | "MEDIUM" | "LONG";

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
}

export interface DashboardRideInBooking {
    id: string;
    driverUserId: string;
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
}

export interface DashboardTripRequestInBooking {
    id: string;
    originText: string;
    destinationText: string;
    earliestDesiredAt: string;
    latestDesiredAt: string;
    preferredDepartAt: string | null;
    distanceCategory: DistanceCategory;
    seatsNeeded: number;
    status: "ACTIVE" | "CLOSED" | "CANCELLED";
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
    | (DashboardBookingBase & { ride: DashboardRideInBooking; tripRequest?: never })
    | (DashboardBookingBase & { tripRequest: DashboardTripRequestInBooking; ride?: never });

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
}

export interface DashboardResponse {
    now: string;
    summary: {
        activeRidesDrivingCount: number;
        confirmedBookingsCount: number;
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
    destinationText: string;
    startsAt: string;
    endsAt: string;
    distanceCategory: DistanceCategory;
    priceCents: number | null;
    driverName: string | null;
}

export function normalizeDashboardBooking(booking: DashboardBookingItem): NormalizedDashboardBooking {
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
            destinationText: booking.ride.destinationText,
            startsAt: booking.ride.earliestDepartAt,
            endsAt: booking.ride.latestDepartAt,
            distanceCategory: booking.ride.distanceCategory,
            priceCents: booking.priceCents ?? booking.ride.priceCents,
            // TODO: Include driver name in GET /api/dashboard bookings payload from users table.
            driverName: null,
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
        destinationText: booking.tripRequest.destinationText,
        startsAt: booking.tripRequest.earliestDesiredAt,
        endsAt: booking.tripRequest.latestDesiredAt,
        distanceCategory: booking.tripRequest.distanceCategory,
        priceCents: booking.priceCents,
        // TODO: Include driver name in GET /api/dashboard bookings payload from users table.
        driverName: null,
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

export function formatRelativeTime(isoDate: string, nowDate: Date = new Date()): string {
    const then = new Date(isoDate);
    if (Number.isNaN(then.getTime())) return "just now";

    const diffSeconds = Math.max(0, Math.floor((nowDate.getTime() - then.getTime()) / 1000));
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
    const lowered = value.toLowerCase();
    return `${lowered.charAt(0).toUpperCase()}${lowered.slice(1)} Distance`;
}
