"use client";

import { useCallback, useEffect, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UseAdaptivePollingOptions<T> {
    /** Return the fetched payload. Throw to signal a transient failure (skipped silently). */
    fetcher: () => Promise<T>;

    /**
     * Derive a lightweight fingerprint from the payload.
     * When two consecutive fingerprints are equal the hook considers the data
     * unchanged and doubles the interval (up to `maxIntervalMs`).
     */
    fingerprint: (data: T) => string;

    /** Called only when the fingerprint has changed since the last poll. */
    onNewData: (data: T) => void;

    /** Whether polling should be active. Set to `false` to pause entirely. */
    enabled: boolean;

    /** Starting interval in ms between polls. Defaults to 5 000. */
    baseIntervalMs?: number;

    /** Ceiling interval after repeated identical fingerprints. Defaults to 60 000. */
    maxIntervalMs?: number;

    /** Multiplier applied to the interval when the fingerprint hasn't changed. Defaults to 2. */
    backoffFactor?: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAdaptivePolling<T>({
    fetcher,
    fingerprint,
    onNewData,
    enabled,
    baseIntervalMs = 5_000,
    maxIntervalMs = 60_000,
    backoffFactor = 2,
}: UseAdaptivePollingOptions<T>): void {
    const intervalMsRef = useRef(baseIntervalMs);
    const lastFingerprintRef = useRef<string | null>(null);
    const inFlightRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetcherRef = useRef(fetcher);
    const fingerprintRef = useRef(fingerprint);
    const onNewDataRef = useRef(onNewData);
    useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);
    useEffect(() => { fingerprintRef.current = fingerprint; }, [fingerprint]);
    useEffect(() => { onNewDataRef.current = onNewData; }, [onNewData]);

    const poll = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;

        try {
            const data = await fetcherRef.current();
            const fp = fingerprintRef.current(data);

            if (fp === lastFingerprintRef.current) {
                intervalMsRef.current = Math.min(
                    intervalMsRef.current * backoffFactor,
                    maxIntervalMs,
                );
            } else {
                intervalMsRef.current = baseIntervalMs;
                lastFingerprintRef.current = fp;
                onNewDataRef.current(data);
            }
        } catch {
            // Transient failure — keep current interval, retry next cycle.
        } finally {
            inFlightRef.current = false;
        }
    }, [backoffFactor, baseIntervalMs, maxIntervalMs]);

    const scheduleNext = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            void poll().then(scheduleNext);
        }, intervalMsRef.current);
    }, [poll]);

    const immediateRefresh = useCallback(() => {
        intervalMsRef.current = baseIntervalMs;
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        void poll().then(scheduleNext);
    }, [baseIntervalMs, poll, scheduleNext]);

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            lastFingerprintRef.current = null;
            intervalMsRef.current = baseIntervalMs;
            return;
        }

        scheduleNext();

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                immediateRefresh();
            }
        };

        const onFocusOrOnline = () => {
            immediateRefresh();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("focus", onFocusOrOnline);
        window.addEventListener("online", onFocusOrOnline);

        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("focus", onFocusOrOnline);
            window.removeEventListener("online", onFocusOrOnline);
        };
    }, [enabled, baseIntervalMs, scheduleNext, immediateRefresh]);
}
