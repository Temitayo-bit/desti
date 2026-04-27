"use client";

import { useCallback, useEffect, useState } from "react";

const INVALIDATE = "desti-profile-invalidate";

export type DestiProfileState = {
  profilePictureUrl: string | null;
  displayName: string | null;
};

let memoryCache: DestiProfileState | null = null;
/** Monotonic; increment on invalidate so stale fetches do not update cache or UI. */
let cacheGeneration = 0;
let inflight: Promise<DestiProfileState> | null = null;

async function fetchDestiProfile(): Promise<DestiProfileState> {
  const res = await fetch("/api/me");
  if (!res.ok) {
    return { profilePictureUrl: null, displayName: null };
  }
  const data = (await res.json()) as {
    localUser?: { profilePictureUrl?: string | null; name?: string | null };
  };
  const lu = data.localUser;
  return {
    profilePictureUrl: lu?.profilePictureUrl?.trim() || null,
    displayName: lu?.name?.trim() || null,
  };
}

/**
 * Single-flight load: shares one in-flight request. Only writes `memoryCache` when the
 * fetch’s start generation still matches `cacheGeneration` (not invalidated mid-flight).
 * Clears `inflight` in `finally` only for that same promise so newer requests are not nulled.
 */
function getOrFetchDestiProfile(): Promise<DestiProfileState> {
  if (!inflight) {
    const genWhenFetchStarted = cacheGeneration;
    const p: Promise<DestiProfileState> = fetchDestiProfile()
      .then((r) => {
        if (genWhenFetchStarted === cacheGeneration) {
          memoryCache = r;
        }
        return r;
      })
      .finally(() => {
        if (inflight === p) {
          inflight = null;
        }
      });
    inflight = p;
  }
  return inflight;
}

/** Clears cached profile and bumps generation so stale in-flight work is ignored. */
export function invalidateDestiProfileCache(): void {
  cacheGeneration += 1;
  memoryCache = null;
  inflight = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INVALIDATE));
  }
}

export function useDestiProfile(): DestiProfileState & { isLoading: boolean } {
  const [state, setState] = useState<DestiProfileState & { isLoading: boolean }>(() => {
    const base = memoryCache ?? { profilePictureUrl: null, displayName: null };
    return { ...base, isLoading: memoryCache === null };
  });

  const refetch = useCallback(async () => {
    const genAtStart = cacheGeneration;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const r = await getOrFetchDestiProfile();
      if (genAtStart === cacheGeneration) {
        setState({ ...r, isLoading: false });
      } else {
        const snap = memoryCache;
        if (snap) {
          setState({ ...snap, isLoading: false });
        } else {
          setState((p) => ({ ...p, isLoading: false }));
        }
      }
    } catch {
      if (genAtStart === cacheGeneration) {
        setState({ profilePictureUrl: null, displayName: null, isLoading: false });
      } else {
        const snap = memoryCache;
        if (snap) {
          setState({ ...snap, isLoading: false });
        } else {
          setState((p) => ({ ...p, isLoading: false }));
        }
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const genAtStart = cacheGeneration;
    (async () => {
      {
        const snap = memoryCache;
        if (snap) {
          setState({ ...snap, isLoading: false });
          return;
        }
      }
      try {
        const r = await getOrFetchDestiProfile();
        if (cancelled) return;
        if (genAtStart === cacheGeneration) {
          setState({ ...r, isLoading: false });
        } else {
          const snap = memoryCache;
          if (snap) {
            setState({ ...snap, isLoading: false });
          } else {
            setState((p) => ({ ...p, isLoading: false }));
          }
        }
      } catch {
        if (cancelled) return;
        if (genAtStart === cacheGeneration) {
          setState({ profilePictureUrl: null, displayName: null, isLoading: false });
        } else {
          const snap = memoryCache;
          if (snap) {
            setState({ ...snap, isLoading: false });
          } else {
            setState((p) => ({ ...p, isLoading: false }));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onInvalidate = () => {
      void refetch();
    };
    window.addEventListener(INVALIDATE, onInvalidate);
    return () => window.removeEventListener(INVALIDATE, onInvalidate);
  }, [refetch]);

  return state;
}
