import type { TripData } from "./types";

export const MOCK_TRIP: TripData = {
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
