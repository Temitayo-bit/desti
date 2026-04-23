export interface BookingLocationPayload {
    bookingId: string;
    latitude: number | null;
    longitude: number | null;
    locationUpdatedAt: string | null;
    tripStartedAt: string | null;
    isLocationSharingActive: boolean;
}

interface BookingLocationRecord {
    id: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
    locationUpdatedAt: Date | null;
    tripStartedAt: Date | null;
    isLocationSharingActive: boolean;
}

export function toBookingLocationPayload(
    booking: BookingLocationRecord
): BookingLocationPayload {
    return {
        bookingId: booking.id,
        latitude: booking.currentLatitude,
        longitude: booking.currentLongitude,
        locationUpdatedAt: booking.locationUpdatedAt
            ? booking.locationUpdatedAt.toISOString()
            : null,
        tripStartedAt: booking.tripStartedAt
            ? booking.tripStartedAt.toISOString()
            : null,
        isLocationSharingActive: booking.isLocationSharingActive,
    };
}
