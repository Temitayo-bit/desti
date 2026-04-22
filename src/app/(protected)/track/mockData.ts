export type TripStatus = "LOADING" | "ACTIVE" | "ARRIVED" | "COMPLETED" | "ERROR";

export interface MockTripData {
    status: TripStatus;
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
}

export const MOCK_TRIP: MockTripData = {
    status: "ACTIVE",
    driver: {
        name: "Odogwu Silencer",
        rating: 4.9,
        vehicle: "Tesla Model 3",
        plate: "C7K-921",
    },
    locations: {
        pickup: "Lynn Hall",
        destination: "Neighborhood Walmart",
    },
    eta: {
        minutes: 2,
        arrivalTime: "11:42 AM",
    },
};
