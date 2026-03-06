export interface ConfirmedBookingSummary {
    id: string;
    riderUserId: string;
    driverUserId: string | null;
    seatsBooked: number;
    startsAt: string;
    endsAt: string;
}
