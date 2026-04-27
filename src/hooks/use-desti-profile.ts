"use client";

import { useCallback, useEffect, useState } from "react";

const INVALIDATE = "desti-profile-invalidate";

export type DestiProfileState = {
  profilePictureUrl: string | null;
  displayName: string | null;
};

let memoryCache: DestiProfileState | null = null;
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

/** Clears cached profile and notifies mounted `useDestiProfile` consumers to refetch. */
export function invalidateDestiProfileCache(): void {
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
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      if (!inflight) {
        inflight = fetchDestiProfile()
          .then((r) => {
            memoryCache = r;
            return r;
          })
          .finally(() => {
            inflight = null;
          });
      }
      const r = await inflight;
      setState({ ...r, isLoading: false });
    } catch {
      setState({ profilePictureUrl: null, displayName: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (memoryCache) {
        setState({ ...memoryCache, isLoading: false });
        return;
      }
      if (!inflight) {
        inflight = fetchDestiProfile()
          .then((r) => {
            memoryCache = r;
            return r;
          })
          .finally(() => {
            inflight = null;
          });
      }
      try {
        const r = await inflight;
        if (!cancelled) setState({ ...r, isLoading: false });
      } catch {
        if (!cancelled) {
          setState({ profilePictureUrl: null, displayName: null, isLoading: false });
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
