/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAdaptivePolling, type UseAdaptivePollingOptions } from "@/lib/use-adaptive-polling";

describe("useAdaptivePolling", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function makeOptions(
        overrides: Partial<UseAdaptivePollingOptions<string>> = {}
    ): UseAdaptivePollingOptions<string> {
        return {
            fetcher: vi.fn(async () => "data-1"),
            fingerprint: vi.fn((d: string) => d),
            onNewData: vi.fn(),
            enabled: true,
            baseIntervalMs: 1000,
            maxIntervalMs: 8000,
            backoffFactor: 2,
            ...overrides,
        };
    }

    it("calls fetcher after the base interval when enabled", async () => {
        const opts = makeOptions();
        renderHook(() => useAdaptivePolling(opts));

        expect(opts.fetcher).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(opts.fetcher).toHaveBeenCalledTimes(1);
        expect(opts.onNewData).toHaveBeenCalledWith("data-1");
    });

    it("does not poll when disabled", async () => {
        const opts = makeOptions({ enabled: false });
        renderHook(() => useAdaptivePolling(opts));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(opts.fetcher).not.toHaveBeenCalled();
    });

    it("backs off when fingerprint is unchanged", async () => {
        const opts = makeOptions({
            fetcher: vi.fn(async () => "same-data"),
            fingerprint: vi.fn(() => "same-fp"),
        });

        renderHook(() => useAdaptivePolling(opts));

        // Poll 1 at 1000ms — fingerprint is new (null → "same-fp"), calls onNewData
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(1);
        expect(opts.onNewData).toHaveBeenCalledTimes(1);

        // Poll 2 at +1000ms — same fingerprint, backs off. Interval doubles to 2000ms.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(2);
        expect(opts.onNewData).toHaveBeenCalledTimes(1); // no new data

        // At +1000ms (total 3000ms) interval is now 2000ms — shouldn't fire yet
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(2);

        // At +1000ms (total 4000ms) — 2000ms since poll 2, fires poll 3
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(3);
    });

    it("resets interval when fingerprint changes", async () => {
        let fpValue = "fp-1";
        const opts = makeOptions({
            fetcher: vi.fn(async () => fpValue),
            fingerprint: vi.fn((d: string) => d),
        });

        renderHook(() => useAdaptivePolling(opts));

        // Poll 1 — new fingerprint
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.onNewData).toHaveBeenCalledTimes(1);

        // Poll 2 — same fingerprint, backs off to 2000ms
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.onNewData).toHaveBeenCalledTimes(1);

        // Change fingerprint before next poll
        fpValue = "fp-2";

        // Poll 3 — at 2000ms, sees new fingerprint, resets interval to base
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(opts.onNewData).toHaveBeenCalledTimes(2);
        expect(opts.onNewData).toHaveBeenLastCalledWith("fp-2");

        // Poll 4 — should fire at base interval (1000ms) since fingerprint just changed
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(4);
    });

    it("caps backoff at maxIntervalMs", async () => {
        const opts = makeOptions({
            fetcher: vi.fn(async () => "same"),
            fingerprint: vi.fn(() => "same"),
            baseIntervalMs: 1000,
            maxIntervalMs: 4000,
            backoffFactor: 2,
        });

        renderHook(() => useAdaptivePolling(opts));

        // Poll 1: base 1000ms, new → next interval 1000
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        // Poll 2: 1000ms, same → next interval 2000
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        // Poll 3: 2000ms, same → next interval 4000
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        // Poll 4: 4000ms, same → next interval capped at 4000
        await act(async () => {
            await vi.advanceTimersByTimeAsync(4000);
        });

        expect(opts.fetcher).toHaveBeenCalledTimes(4);

        // Poll 5 at 4000ms (still capped)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(4000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(5);
    });

    it("refreshes immediately on visibilitychange to visible", async () => {
        const opts = makeOptions();
        renderHook(() => useAdaptivePolling(opts));

        // Fire visibilitychange
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            writable: true,
            configurable: true,
        });
        await act(async () => {
            document.dispatchEvent(new Event("visibilitychange"));
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(opts.fetcher).toHaveBeenCalled();
    });

    it("refreshes immediately on focus event", async () => {
        const opts = makeOptions();
        renderHook(() => useAdaptivePolling(opts));

        await act(async () => {
            window.dispatchEvent(new Event("focus"));
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(opts.fetcher).toHaveBeenCalled();
    });

    it("refreshes immediately on online event", async () => {
        const opts = makeOptions();
        renderHook(() => useAdaptivePolling(opts));

        await act(async () => {
            window.dispatchEvent(new Event("online"));
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(opts.fetcher).toHaveBeenCalled();
    });

    it("silently swallows fetcher errors and retries on next cycle", async () => {
        let shouldFail = true;
        const opts = makeOptions({
            fetcher: vi.fn(async () => {
                if (shouldFail) throw new Error("network");
                return "ok";
            }),
        });

        renderHook(() => useAdaptivePolling(opts));

        // First poll fails
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.onNewData).not.toHaveBeenCalled();

        // Fix and retry
        shouldFail = false;
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.onNewData).toHaveBeenCalledWith("ok");
    });

    it("stops polling when enabled transitions to false", async () => {
        const opts = makeOptions();
        const { rerender } = renderHook(
            (props: UseAdaptivePollingOptions<string>) => useAdaptivePolling(props),
            { initialProps: opts }
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(1);

        // Disable
        rerender({ ...opts, enabled: false });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(opts.fetcher).toHaveBeenCalledTimes(1);
    });

    it("resets fingerprint state when re-enabled", async () => {
        const opts = makeOptions();
        const { rerender } = renderHook(
            (props: UseAdaptivePollingOptions<string>) => useAdaptivePolling(props),
            { initialProps: opts }
        );

        // Poll once
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.onNewData).toHaveBeenCalledTimes(1);

        // Disable
        rerender({ ...opts, enabled: false });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        // Re-enable — should treat the same fingerprint as new since state was reset
        rerender({ ...opts, enabled: true });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(opts.onNewData).toHaveBeenCalledTimes(2);
    });
});
