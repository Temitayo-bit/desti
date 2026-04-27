export type TripStatus = "LOADING" | "ACTIVE" | "ARRIVED" | "COMPLETED" | "ERROR";

export interface TripData {
    status: TripStatus;
    bookingId?: string;
    driver: {
        name: string;
        rating: number;
        vehicle: string;
        plate: string;
        avatarUrl?: string;
    };
    locations: {
        pickup: string;
        destination: string;
    };
    eta: {
        minutes: number;
        arrivalTime: string;
    };
    errorMessage?: string;
}
