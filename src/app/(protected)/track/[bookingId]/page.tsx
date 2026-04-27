"use client";

import { useEffect, useState, useCallback, use } from "react";
import { TopNav } from "../_components/TopNav";
import { TripSidebar } from "../_components/TripSidebar";
import { MapArea } from "../_components/MapArea";
import type { TripData } from "../types";

const LOADING_TRIP: TripData = {
    status: "LOADING",
    driver: { name: "", rating: 0, vehicle: "", plate: "" },
    locations: { pickup: "", destination: "" },
    eta: { minutes: 0, arrivalTime: "" },
};

function errorTrip(message: string): TripData {
    return {
        status: "ERROR",
        driver: { name: "", rating: 0, vehicle: "", plate: "" },
        locations: { pickup: "", destination: "" },
        eta: { minutes: 0, arrivalTime: "" },
        errorMessage: message,
    };
}

interface TrackApiResponse {
    bookingId: string;
    bookingStatus: "CONFIRMED" | "COMPLETED" | "CANCELLED";
    isLocationSharingActive: boolean;
    tripStartedAt: string | null;
    completedAt: string | null;
    driver: {
        name: string;
        avatarUrl: string | null;
        vehicle: string;
        plate: string;
    };
    locations: {
        pickup: string;
        destination: string;
    };
    currentLatitude: number | null;
    currentLongitude: number | null;
    locationUpdatedAt: string | null;
}

function mapApiToTripData(api: TrackApiResponse): TripData {
    let status: TripData["status"] = "ACTIVE";
    if (api.bookingStatus === "COMPLETED") {
        status = "COMPLETED";
    } else if (api.bookingStatus === "CANCELLED") {
        status = "ERROR";
    } else if (!api.isLocationSharingActive || !api.tripStartedAt) {
        // Confirmed but trip not started yet
        status = "ACTIVE";
    }

    return {
        status,
        bookingId: api.bookingId,
        driver: {
            name: api.driver.name,
            rating: 0,
            vehicle: api.driver.vehicle,
            plate: api.driver.plate,
            avatarUrl: api.driver.avatarUrl ?? undefined,
        },
        locations: {
            pickup: api.locations.pickup,
            destination: api.locations.destination,
        },
        eta: {
            minutes: 0,
            arrivalTime: "—",
        },
    };
}

export default function TrackBookingPage({
    params,
}: {
    params: Promise<{ bookingId: string }>;
}) {
    const { bookingId } = use(params);
    const [trip, setTrip] = useState<TripData>(LOADING_TRIP);

    const fetchTrackData = useCallback(async () => {
        try {
            const res = await fetch(`/api/bookings/${bookingId}/track`);
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const msg = data?.message ?? "Failed to load trip data.";
                setTrip(errorTrip(msg));
                return;
            }

            const data = (await res.json()) as TrackApiResponse;
            setTrip(mapApiToTripData(data));
        } catch {
            setTrip(errorTrip("Network error. Please check your connection."));
        }
    }, [bookingId]);

    useEffect(() => {
        void fetchTrackData();
    }, [fetchTrackData]);

    // Poll for location updates when trip is active
    useEffect(() => {
        if (trip.status !== "ACTIVE") return;

        const interval = setInterval(() => {
            void fetchTrackData();
        }, 10_000);

        return () => clearInterval(interval);
    }, [trip.status, fetchTrackData]);

    return (
        <div className="flex min-h-screen w-full flex-col bg-white font-sans md:h-screen md:overflow-hidden">
            <TopNav />
            <main className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden relative">
                <div className="h-auto flex-shrink-0 z-10 border-b md:border-b-0 md:border-r border-zinc-200 shadow-xl md:h-full md:w-auto">
                    <TripSidebar trip={trip} onRetry={fetchTrackData} />
                </div>

                <div className="flex-1 relative min-h-[400px]">
                    <MapArea trip={trip} />
                </div>
            </main>
        </div>
    );
}
