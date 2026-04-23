/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBookingLocationTracking } from "@/lib/use-booking-location-tracking";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function flushMicrotasks() {
    await act(async () => {
        await Promise.resolve();
    });
}

describe("useBookingLocationTracking", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("polls rider location on interval and stops polling after unmount", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(async () =>
                jsonResponse({
                    bookingId: "booking-1",
                    latitude: 29.21,
                    longitude: -81.03,
                    locationUpdatedAt: "2030-01-01T10:00:00.000Z",
                    tripStartedAt: "2030-01-01T09:55:00.000Z",
                    isLocationSharingActive: true,
                })
            );

        const { result, unmount } = renderHook(() =>
            useBookingLocationTracking({
                bookingId: "booking-1",
                enabled: true,
                isDriver: false,
                pollIntervalMs: 1000,
            })
        );

        await flushMicrotasks();

        expect(result.current.location?.latitude).toBe(29.21);
        const callsAfterMount = fetchMock.mock.calls.length;

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        await flushMicrotasks();

        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterMount);

        const callsBeforeUnmount = fetchMock.mock.calls.length;
        unmount();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        await flushMicrotasks();

        expect(fetchMock.mock.calls.length).toBe(callsBeforeUnmount);
    });

    it("continues rider polling before the driver starts sharing", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
            jsonResponse(
                {
                    code: "TRIP_NOT_STARTED",
                    message: "Trip location sharing has not been started.",
                },
                409
            )
        );

        const { result } = renderHook(() =>
            useBookingLocationTracking({
                bookingId: "booking-1",
                enabled: true,
                isDriver: false,
                pollIntervalMs: 1000,
            })
        );

        await flushMicrotasks();

        const callsAfterMount = fetchMock.mock.calls.length;
        expect(result.current.location?.bookingId).toBe("booking-1");
        expect(result.current.location?.isLocationSharingActive).toBe(false);
        expect(result.current.error).toBeNull();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        await flushMicrotasks();

        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterMount);
    });

    it("stops rider polling when booking is no longer active", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
            jsonResponse(
                {
                    code: "BOOKING_NOT_ACTIVE",
                    message: "Trip is no longer active.",
                },
                409
            )
        );

        const { result } = renderHook(() =>
            useBookingLocationTracking({
                bookingId: "booking-1",
                enabled: true,
                isDriver: false,
                pollIntervalMs: 1000,
            })
        );

        await flushMicrotasks();

        const callsAfterInitialLoad = fetchMock.mock.calls.length;
        expect(result.current.isTripActive).toBe(false);
        expect(result.current.error).toBe("Trip is no longer active.");

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        await flushMicrotasks();

        expect(fetchMock.mock.calls.length).toBe(callsAfterInitialLoad);
    });

    it("ignores stale rider responses when switching active bookings", async () => {
        let resolveBookingOne:
            | ((value: Response | PromiseLike<Response>) => void)
            | null = null;

        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
            const url = typeof input === "string" ? input : input.toString();

            if (url.includes("/api/bookings/booking-1/location")) {
                return new Promise<Response>((resolve) => {
                    resolveBookingOne = resolve;
                });
            }

            if (url.includes("/api/bookings/booking-2/location")) {
                return Promise.resolve(
                    jsonResponse({
                        bookingId: "booking-2",
                        latitude: 29.31,
                        longitude: -81.11,
                        locationUpdatedAt: "2030-01-01T10:01:00.000Z",
                        tripStartedAt: "2030-01-01T09:50:00.000Z",
                        isLocationSharingActive: true,
                    })
                );
            }

            return Promise.resolve(jsonResponse({}, 500));
        });

        const { result, rerender } = renderHook(
            ({ bookingId }: { bookingId: string }) =>
                useBookingLocationTracking({
                    bookingId,
                    enabled: true,
                    isDriver: false,
                    pollIntervalMs: 1000,
                }),
            {
                initialProps: { bookingId: "booking-1" },
            }
        );

        await flushMicrotasks();

        rerender({ bookingId: "booking-2" });
        await flushMicrotasks();

        expect(fetchMock).toHaveBeenCalledWith("/api/bookings/booking-2/location", {
            method: "GET",
        });
        expect(result.current.location?.bookingId).toBe("booking-2");
        expect(result.current.location?.latitude).toBe(29.31);

        await act(async () => {
            resolveBookingOne?.(
                jsonResponse({
                    bookingId: "booking-1",
                    latitude: 20.0,
                    longitude: -80.0,
                    locationUpdatedAt: "2030-01-01T10:02:00.000Z",
                    tripStartedAt: "2030-01-01T09:40:00.000Z",
                    isLocationSharingActive: true,
                })
            );
        });
        await flushMicrotasks();

        expect(result.current.location?.bookingId).toBe("booking-2");
        expect(result.current.location?.latitude).toBe(29.31);
    });

    it("starts sharing for drivers and posts periodic location updates", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
            async (input: string | URL | Request, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input.toString();
                const method = (init?.method ?? "GET").toUpperCase();

                if (url.includes("/api/bookings/booking-1/location") && method === "GET") {
                    return jsonResponse(
                        {
                            code: "TRIP_NOT_STARTED",
                            message: "Trip location sharing has not been started.",
                        },
                        409
                    );
                }

                if (url.includes("/api/bookings/booking-1/start") && method === "POST") {
                    return jsonResponse({
                        bookingId: "booking-1",
                        latitude: null,
                        longitude: null,
                        locationUpdatedAt: null,
                        tripStartedAt: "2030-01-01T10:00:00.000Z",
                        isLocationSharingActive: true,
                    });
                }

                if (url.includes("/api/bookings/booking-1/location") && method === "POST") {
                    return jsonResponse({
                        bookingId: "booking-1",
                        latitude: 29.22,
                        longitude: -81.04,
                        locationUpdatedAt: "2030-01-01T10:00:10.000Z",
                        tripStartedAt: "2030-01-01T10:00:00.000Z",
                        isLocationSharingActive: true,
                    });
                }

                return jsonResponse({}, 500);
            }
        );

        const getCurrentPositionMock = vi.fn(
            (
                success: PositionCallback
            ) => {
                success({
                    coords: {
                        latitude: 29.22,
                        longitude: -81.04,
                        accuracy: 5,
                        altitude: null,
                        altitudeAccuracy: null,
                        heading: null,
                        speed: null,
                        toJSON: () => ({}),
                    },
                    timestamp: Date.now(),
                    toJSON: () => ({}),
                } as GeolocationPosition);
            }
        );

        vi.stubGlobal("navigator", {
            geolocation: {
                getCurrentPosition: getCurrentPositionMock,
            },
        });

        const { result } = renderHook(() =>
            useBookingLocationTracking({
                bookingId: "booking-1",
                enabled: true,
                isDriver: true,
                pollIntervalMs: 1000,
            })
        );

        await flushMicrotasks();

        await act(async () => {
            await result.current.startSharing();
        });
        await flushMicrotasks();

        const postLocationCallsAfterStart = fetchMock.mock.calls.filter(([url, init]) => {
            const requestUrl = typeof url === "string" ? url : url.toString();
            return (
                requestUrl.includes("/api/bookings/booking-1/location") &&
                (init?.method ?? "GET").toUpperCase() === "POST"
            );
        }).length;

        expect(result.current.isSharingActive).toBe(true);
        expect(postLocationCallsAfterStart).toBeGreaterThanOrEqual(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        await flushMicrotasks();

        const postLocationCallsAfterTick = fetchMock.mock.calls.filter(([url, init]) => {
            const requestUrl = typeof url === "string" ? url : url.toString();
            return (
                requestUrl.includes("/api/bookings/booking-1/location") &&
                (init?.method ?? "GET").toUpperCase() === "POST"
            );
        }).length;

        expect(postLocationCallsAfterTick).toBeGreaterThan(postLocationCallsAfterStart);
    });

    it("handles geolocation permission denial gracefully and stops driver posts", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
            async (input: string | URL | Request, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input.toString();
                const method = (init?.method ?? "GET").toUpperCase();

                if (url.includes("/api/bookings/booking-1/location") && method === "GET") {
                    return jsonResponse(
                        {
                            code: "TRIP_NOT_STARTED",
                            message: "Trip location sharing has not been started.",
                        },
                        409
                    );
                }

                if (url.includes("/api/bookings/booking-1/start") && method === "POST") {
                    return jsonResponse({
                        bookingId: "booking-1",
                        latitude: null,
                        longitude: null,
                        locationUpdatedAt: null,
                        tripStartedAt: "2030-01-01T10:00:00.000Z",
                        isLocationSharingActive: true,
                    });
                }

                return jsonResponse({}, 500);
            }
        );

        const getCurrentPositionMock = vi.fn(
            (
                _success: PositionCallback,
                error?: PositionErrorCallback | null
            ) => {
                error?.({
                    code: 1,
                    message: "permission denied",
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3,
                } as GeolocationPositionError);
            }
        );

        vi.stubGlobal("navigator", {
            geolocation: {
                getCurrentPosition: getCurrentPositionMock,
            },
        });

        const { result } = renderHook(() =>
            useBookingLocationTracking({
                bookingId: "booking-1",
                enabled: true,
                isDriver: true,
                pollIntervalMs: 1000,
            })
        );

        await flushMicrotasks();

        await act(async () => {
            await result.current.startSharing();
        });
        await flushMicrotasks();

        expect(result.current.geolocationError).toContain("permission denied");

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        await flushMicrotasks();

        const locationPostCalls = fetchMock.mock.calls.filter(([url, init]) => {
            const requestUrl = typeof url === "string" ? url : url.toString();
            return (
                requestUrl.includes("/api/bookings/booking-1/location") &&
                (init?.method ?? "GET").toUpperCase() === "POST"
            );
        });

        expect(locationPostCalls).toHaveLength(0);
    });
});
