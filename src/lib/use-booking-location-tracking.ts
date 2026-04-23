"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookingLocationPayload } from "@/lib/booking-location";

interface ApiErrorPayload {
    code?: string;
    message?: string;
}

type DeviceLocationErrorCode = "PERMISSION_DENIED" | "UNAVAILABLE";

class DeviceLocationError extends Error {
    code: DeviceLocationErrorCode;

    constructor(message: string, code: DeviceLocationErrorCode) {
        super(message);
        this.name = "DeviceLocationError";
        this.code = code;
    }
}

export interface UseBookingLocationTrackingOptions {
    bookingId: string | null;
    isDriver: boolean;
    enabled: boolean;
    pollIntervalMs?: number;
}

export interface UseBookingLocationTrackingResult {
    location: BookingLocationPayload | null;
    loading: boolean;
    starting: boolean;
    error: string | null;
    geolocationError: string | null;
    startSharing: () => Promise<void>;
    isSharingActive: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 10_000;

interface ReadRequestToken {
    bookingId: string;
    sequence: number;
}

function makeEmptyLocation(bookingId: string): BookingLocationPayload {
    return {
        bookingId,
        latitude: null,
        longitude: null,
        locationUpdatedAt: null,
        tripStartedAt: null,
        isLocationSharingActive: false,
    };
}

async function parseApiError(response: Response): Promise<ApiErrorPayload> {
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
        return {};
    }

    const record = payload as Record<string, unknown>;
    return {
        code: typeof record.code === "string" ? record.code : undefined,
        message: typeof record.message === "string" ? record.message : undefined,
    };
}

function resolveDevicePosition(): Promise<{ latitude: number; longitude: number }> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
        throw new DeviceLocationError(
            "Geolocation is unavailable on this device.",
            "UNAVAILABLE"
        );
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                if (error.code === 1) {
                    reject(
                        new DeviceLocationError(
                            "Location permission denied. Enable location access to share your trip.",
                            "PERMISSION_DENIED"
                        )
                    );
                    return;
                }

                reject(
                    new DeviceLocationError(
                        "Unable to determine your current location.",
                        "UNAVAILABLE"
                    )
                );
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5_000,
                timeout: 10_000,
            }
        );
    });
}

function toLocationPayload(data: unknown): BookingLocationPayload | null {
    if (!data || typeof data !== "object") {
        return null;
    }

    const record = data as Record<string, unknown>;

    if (typeof record.bookingId !== "string") {
        return null;
    }

    const bookingId = record.bookingId;
    const latitude = record.latitude;
    const longitude = record.longitude;
    const locationUpdatedAt = record.locationUpdatedAt;
    const tripStartedAt = record.tripStartedAt;
    const isLocationSharingActive = record.isLocationSharingActive;

    if (latitude !== null && typeof latitude !== "number") {
        return null;
    }

    if (longitude !== null && typeof longitude !== "number") {
        return null;
    }

    if (locationUpdatedAt !== null && typeof locationUpdatedAt !== "string") {
        return null;
    }

    if (tripStartedAt !== null && typeof tripStartedAt !== "string") {
        return null;
    }

    if (typeof isLocationSharingActive !== "boolean") {
        return null;
    }

    return {
        bookingId: bookingId as string,
        latitude: latitude as number | null,
        longitude: longitude as number | null,
        locationUpdatedAt: locationUpdatedAt as string | null,
        tripStartedAt: tripStartedAt as string | null,
        isLocationSharingActive: isLocationSharingActive as boolean,
    };
}

export function useBookingLocationTracking({
    bookingId,
    isDriver,
    enabled,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseBookingLocationTrackingOptions): UseBookingLocationTrackingResult {
    const [location, setLocation] = useState<BookingLocationPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [geolocationError, setGeolocationError] = useState<string | null>(null);

    const readInFlightRef = useRef<ReadRequestToken | null>(null);
    const readSequenceRef = useRef(0);
    const writeInFlightRef = useRef(false);
    const geolocationBlockedRef = useRef(false);

    const activeBookingId = enabled && bookingId ? bookingId : null;

    const setInactiveSharing = useCallback((id: string) => {
        setLocation((current) => {
            if (!current || current.bookingId !== id) {
                return makeEmptyLocation(id);
            }

            return {
                ...current,
                isLocationSharingActive: false,
            };
        });
    }, []);

    const loadCurrentLocation = useCallback(async () => {
        if (!activeBookingId) {
            return;
        }

        if (readInFlightRef.current?.bookingId === activeBookingId) {
            return;
        }

        const requestToken: ReadRequestToken = {
            bookingId: activeBookingId,
            sequence: readSequenceRef.current + 1,
        };
        readSequenceRef.current = requestToken.sequence;
        readInFlightRef.current = requestToken;

        const isCurrentRequest = () => {
            const inFlight = readInFlightRef.current;
            return (
                inFlight?.bookingId === requestToken.bookingId &&
                inFlight?.sequence === requestToken.sequence
            );
        };

        try {
            const response = await fetch(`/api/bookings/${requestToken.bookingId}/location`, {
                method: "GET",
            });

            if (!isCurrentRequest()) {
                return;
            }

            if (response.ok) {
                const payload = toLocationPayload(await response.json());
                if (!isCurrentRequest()) {
                    return;
                }
                if (payload) {
                    setLocation(payload);
                    setError(null);
                    return;
                }

                setError("Unexpected location payload received from server.");
                return;
            }

            const apiError = await parseApiError(response);
            if (!isCurrentRequest()) {
                return;
            }

            if (apiError.code === "TRIP_NOT_STARTED") {
                setLocation(makeEmptyLocation(requestToken.bookingId));
                setError(null);
                return;
            }

            if (apiError.code === "BOOKING_NOT_ACTIVE") {
                setInactiveSharing(requestToken.bookingId);
                setError(apiError.message ?? "Trip is no longer active.");
                return;
            }

            setError(apiError.message ?? "Failed to fetch trip location.");
        } catch {
            if (isCurrentRequest()) {
                setError("Failed to fetch trip location.");
            }
        } finally {
            if (isCurrentRequest()) {
                readInFlightRef.current = null;
            }
        }
    }, [activeBookingId, setInactiveSharing]);

    const startSharing = useCallback(async () => {
        if (!activeBookingId || !enabled || !isDriver) {
            return;
        }

        setStarting(true);
        setError(null);
        geolocationBlockedRef.current = false;

        try {
            const response = await fetch(`/api/bookings/${activeBookingId}/start`, {
                method: "POST",
            });

            if (!response.ok) {
                const apiError = await parseApiError(response);
                setError(apiError.message ?? "Failed to start trip sharing.");
                return;
            }

            const payload = toLocationPayload(await response.json());
            if (!payload) {
                setError("Unexpected trip start payload received from server.");
                return;
            }

            setLocation(payload);
            setError(null);
            setGeolocationError(null);
        } catch {
            setError("Failed to start trip sharing.");
        } finally {
            setStarting(false);
        }
    }, [activeBookingId, enabled, isDriver]);

    const pushDriverLocation = useCallback(async () => {
        if (!activeBookingId || !enabled || !isDriver) {
            return;
        }

        if (geolocationBlockedRef.current || writeInFlightRef.current) {
            return;
        }

        writeInFlightRef.current = true;

        try {
            const coords = await resolveDevicePosition();
            setGeolocationError(null);

            const response = await fetch(`/api/bookings/${activeBookingId}/location`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(coords),
            });

            if (response.ok) {
                const payload = toLocationPayload(await response.json());
                if (payload) {
                    setLocation(payload);
                    setError(null);
                    return;
                }

                setError("Unexpected location payload received from server.");
                return;
            }

            const apiError = await parseApiError(response);

            if (apiError.code === "BOOKING_NOT_ACTIVE") {
                setInactiveSharing(activeBookingId);
                setError(apiError.message ?? "Trip is no longer active.");
                return;
            }

            if (apiError.code === "TRIP_NOT_STARTED") {
                setLocation(makeEmptyLocation(activeBookingId));
                setError(apiError.message ?? "Start the trip before sharing location.");
                return;
            }

            setError(apiError.message ?? "Failed to share trip location.");
        } catch (cause) {
            if (cause instanceof DeviceLocationError) {
                setGeolocationError(cause.message);
                if (cause.code === "PERMISSION_DENIED") {
                    geolocationBlockedRef.current = true;
                }
                return;
            }

            setGeolocationError("Unable to determine your current location.");
        } finally {
            writeInFlightRef.current = false;
        }
    }, [activeBookingId, enabled, isDriver, setInactiveSharing]);

    useEffect(() => {
        if (!activeBookingId) {
            readInFlightRef.current = null;
            setLocation(null);
            setError(null);
            setGeolocationError(null);
            setLoading(false);
            geolocationBlockedRef.current = false;
            return;
        }

        setLoading(true);
        void loadCurrentLocation().finally(() => {
            setLoading(false);
        });
    }, [activeBookingId, loadCurrentLocation]);

    const sharingActive = Boolean(location?.isLocationSharingActive);

    useEffect(() => {
        if (!activeBookingId || !enabled || !isDriver || !sharingActive) {
            return;
        }

        let disposed = false;

        const tick = async () => {
            if (disposed) {
                return;
            }
            await pushDriverLocation();
        };

        void tick();
        const intervalId = setInterval(() => {
            void tick();
        }, pollIntervalMs);

        return () => {
            disposed = true;
            clearInterval(intervalId);
        };
    }, [activeBookingId, enabled, isDriver, sharingActive, pollIntervalMs, pushDriverLocation]);

    useEffect(() => {
        if (!activeBookingId || !enabled || isDriver) {
            return;
        }

        let disposed = false;

        const tick = async () => {
            if (disposed) {
                return;
            }
            await loadCurrentLocation();
        };

        void tick();
        const intervalId = setInterval(() => {
            void tick();
        }, pollIntervalMs);

        return () => {
            disposed = true;
            clearInterval(intervalId);
        };
    }, [activeBookingId, enabled, isDriver, pollIntervalMs, loadCurrentLocation]);

    return useMemo(
        () => ({
            location,
            loading,
            starting,
            error,
            geolocationError,
            startSharing,
            isSharingActive: sharingActive,
        }),
        [
            error,
            geolocationError,
            loading,
            location,
            sharingActive,
            startSharing,
            starting,
        ]
    );
}
