"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { getMapboxPublicAccessToken } from "@/lib/mapbox-location-autocomplete";
import type { TripMapMarker } from "@/lib/trip-map";

const MAPBOX_GL_VERSION = "v3.4.0";
const MAPBOX_SCRIPT_ID = "desti-mapbox-gl-script";
const MAPBOX_STYLE_LINK_ID = "desti-mapbox-gl-style";
const MAPBOX_DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";
const DEFAULT_MAPBOX_ASSET_TIMEOUT_MS = 8_000;
const DEFAULT_MAPBOX_LOAD_TIMEOUT_MS = 8_000;

type MapLoadingStatus = "loading" | "ready" | "error";
type LiveDriverStatus = "updating" | "unavailable" | "stopped";
type CoordinateTuple = [number, number];

/** Used only to bootstrap Mapbox; never use live driver coordinates here (polling would re-init the map). */
const FALLBACK_MAP_CENTER: CoordinateTuple = [-81.38, 28.6];

interface MarkerState {
  marker: MapboxGlMarker | null;
}

interface TripVisualizationMapProps {
  originMarker: TripMapMarker | null;
  destinationMarker: TripMapMarker | null;
  driverMarker: TripMapMarker | null;
  liveDriverStatus: LiveDriverStatus;
  lastDriverUpdateAt: string | null;
  /** When set, replaces the default live status line (e.g. pre-trip copy). */
  liveStatusOverride?: string | null;
  mapAssetTimeoutMs?: number;
  mapLoadTimeoutMs?: number;
  /** Show expand control for a larger / fullscreen-style map. Default true. */
  expandable?: boolean;
}

interface MapboxGlNamespace {
  accessToken: string;
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: CoordinateTuple;
    zoom: number;
  }) => MapboxGlMap;
  Marker: new (options?: {
    color?: string;
    element?: HTMLElement;
    anchor?: "center" | "bottom" | "top" | "left" | "right";
  }) => MapboxGlMarker;
  LngLatBounds: new (
    southWest?: CoordinateTuple,
    northEast?: CoordinateTuple
  ) => MapboxGlLngLatBounds;
}

interface MapboxGlMap {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off?: (event: string, callback: (...args: unknown[]) => void) => void;
  remove: () => void;
  resize: () => void;
  fitBounds: (
    bounds: MapboxGlLngLatBounds,
    options?: {
      padding?:
        | number
        | { top: number; right: number; bottom: number; left: number };
      maxZoom?: number;
      duration?: number;
    }
  ) => void;
  setCenter: (center: CoordinateTuple) => void;
  setZoom: (zoom: number) => void;
}

interface MapboxGlMarker {
  setLngLat: (position: CoordinateTuple) => MapboxGlMarker;
  addTo: (map: MapboxGlMap) => MapboxGlMarker;
  remove: () => void;
}

interface MapboxGlLngLatBounds {
  extend: (point: CoordinateTuple) => MapboxGlLngLatBounds;
}

declare global {
  interface Window {
    mapboxgl?: MapboxGlNamespace;
  }
}

let mapboxAssetsPromise: Promise<MapboxGlNamespace> | null = null;

function ensureMapboxStylesheet(): void {
  if (document.getElementById(MAPBOX_STYLE_LINK_ID)) {
    return;
  }

  const link = document.createElement("link");
  link.id = MAPBOX_STYLE_LINK_ID;
  link.rel = "stylesheet";
  link.href = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.css`;
  document.head.appendChild(link);
}

function ensureMapboxScript(): Promise<MapboxGlNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mapbox can only load in the browser."));
  }

  ensureMapboxStylesheet();

  if (window.mapboxgl) {
    return Promise.resolve(window.mapboxgl);
  }

  if (!mapboxAssetsPromise) {
    mapboxAssetsPromise = new Promise<MapboxGlNamespace>((resolve, reject) => {
      const existingScript = document.getElementById(MAPBOX_SCRIPT_ID) as
        | HTMLScriptElement
        | null;

      const onLoaded = () => {
        if (!window.mapboxgl) {
          reject(new Error("Mapbox script loaded, but mapboxgl is unavailable."));
          return;
        }
        resolve(window.mapboxgl);
      };

      const onError = () => {
        reject(new Error("Failed to load Mapbox script."));
      };

      if (existingScript) {
        if (window.mapboxgl) {
          resolve(window.mapboxgl);
          return;
        }
        existingScript.addEventListener("load", onLoaded, { once: true });
        existingScript.addEventListener("error", onError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = MAPBOX_SCRIPT_ID;
      script.src = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.js`;
      script.async = true;
      script.onload = onLoaded;
      script.onerror = onError;
      document.head.appendChild(script);
    }).catch((error) => {
      mapboxAssetsPromise = null;
      throw error;
    });
  }

  return mapboxAssetsPromise;
}

function toCoordinateTuple(marker: TripMapMarker): CoordinateTuple {
  return [marker.longitude, marker.latitude];
}

function createDotMarkerElement(color: string, label: string): HTMLDivElement {
  const element = document.createElement("div");
  element.style.width = "16px";
  element.style.height = "16px";
  element.style.borderRadius = "9999px";
  element.style.backgroundColor = color;
  element.style.border = "2px solid #ffffff";
  element.style.boxShadow = "0 1px 8px rgba(0,0,0,0.35)";
  element.setAttribute("aria-label", label);
  element.title = label;
  return element;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getLiveStatusLabel(
  status: LiveDriverStatus,
  hasDriverMarker: boolean
): string {
  if (status === "stopped") {
    return "Live driver tracking is stopped because this trip is inactive.";
  }

  if (status === "unavailable") {
    return "Live driver location is currently unavailable. Static trip points are still shown.";
  }

  if (hasDriverMarker) {
    return "Live location updating.";
  }

  return "Live tracking is active. Waiting for the first driver location update.";
}

export function TripVisualizationMap({
  originMarker,
  destinationMarker,
  driverMarker,
  liveDriverStatus,
  lastDriverUpdateAt,
  liveStatusOverride = null,
  mapAssetTimeoutMs = DEFAULT_MAPBOX_ASSET_TIMEOUT_MS,
  mapLoadTimeoutMs = DEFAULT_MAPBOX_LOAD_TIMEOUT_MS,
  expandable = true,
}: TripVisualizationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGlMap | null>(null);
  const mapboxNamespaceRef = useRef<MapboxGlNamespace | null>(null);
  const hasInitialFitRef = useRef(false);
  const originMarkerRef = useRef<MarkerState>({ marker: null });
  const destinationMarkerRef = useRef<MarkerState>({ marker: null });
  const driverMarkerRef = useRef<MarkerState>({ marker: null });
  const [mapStatus, setMapStatus] = useState<MapLoadingStatus>("loading");
  const [mapExpanded, setMapExpanded] = useState(false);

  const mapboxToken = getMapboxPublicAccessToken();
  const hasStaticMarkers = Boolean(originMarker || destinationMarker);
  const originLatitude = originMarker?.latitude ?? null;
  const originLongitude = originMarker?.longitude ?? null;
  const destinationLatitude = destinationMarker?.latitude ?? null;
  const destinationLongitude = destinationMarker?.longitude ?? null;
  const driverLatitude = driverMarker?.latitude ?? null;
  const driverLongitude = driverMarker?.longitude ?? null;

  /** Origin/destination only — must not depend on driver (live updates would re-run map init and blank the GL map). */
  const bootstrapCenter = useMemo<CoordinateTuple | null>(() => {
    if (originLatitude !== null && originLongitude !== null) {
      return [originLongitude, originLatitude];
    }

    if (destinationLatitude !== null && destinationLongitude !== null) {
      return [destinationLongitude, destinationLatitude];
    }

    return null;
  }, [
    destinationLatitude,
    destinationLongitude,
    originLatitude,
    originLongitude,
  ]);

  const originStaticKey =
    originLatitude != null && originLongitude != null
      ? `${originLatitude},${originLongitude}`
      : "";
  const destinationStaticKey =
    destinationLatitude != null && destinationLongitude != null
      ? `${destinationLatitude},${destinationLongitude}`
      : "";

  const allRelevantPoints = useMemo<CoordinateTuple[]>(() => {
    const points: CoordinateTuple[] = [];
    if (originLatitude !== null && originLongitude !== null) {
      points.push([originLongitude, originLatitude]);
    }
    if (destinationLatitude !== null && destinationLongitude !== null) {
      points.push([destinationLongitude, destinationLatitude]);
    }
    if (driverLatitude !== null && driverLongitude !== null) {
      points.push([driverLongitude, driverLatitude]);
    }
    return points;
  }, [
    destinationLatitude,
    destinationLongitude,
    driverLatitude,
    driverLongitude,
    originLatitude,
    originLongitude,
  ]);

  const clearMarker = useCallback((markerState: MarkerState) => {
    markerState.marker?.remove();
    markerState.marker = null;
  }, []);

  const syncMarker = useCallback(
    (
      markerState: MarkerState,
      marker: TripMapMarker | null,
      color: string
    ) => {
      const map = mapRef.current;
      const mapboxgl = mapboxNamespaceRef.current;

      if (!map || !mapboxgl) {
        return;
      }

      if (!marker) {
        clearMarker(markerState);
        return;
      }

      const coordinate = toCoordinateTuple(marker);

      if (markerState.marker) {
        markerState.marker.setLngLat(coordinate);
        return;
      }

      markerState.marker = new mapboxgl.Marker({
        element: createDotMarkerElement(color, marker.label),
        anchor: "center",
      })
        .setLngLat(coordinate)
        .addTo(map);
    },
    [clearMarker]
  );

  const fitMapToPoints = useCallback(
    (force: boolean) => {
      const map = mapRef.current;
      const mapboxgl = mapboxNamespaceRef.current;

      if (!map || !mapboxgl || allRelevantPoints.length === 0) {
        return;
      }

      if (hasInitialFitRef.current && !force) {
        return;
      }

      if (allRelevantPoints.length === 1) {
        map.setCenter(allRelevantPoints[0]);
        map.setZoom(12);
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        for (const point of allRelevantPoints) {
          bounds.extend(point);
        }

        map.fitBounds(bounds, {
          padding: { top: 56, right: 56, bottom: 56, left: 56 },
          maxZoom: 13,
          duration: 0,
        });
      }

      hasInitialFitRef.current = true;
    },
    [allRelevantPoints]
  );

  const fitMapToPointsRef = useRef(fitMapToPoints);

  useEffect(() => {
    fitMapToPointsRef.current = fitMapToPoints;
  }, [fitMapToPoints]);

  useLayoutEffect(() => {
    if (mapStatus !== "ready") {
      return;
    }
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      map.resize();
      fitMapToPointsRef.current(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [mapExpanded, mapStatus]);

  useEffect(() => {
    if (!mapExpanded) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMapExpanded(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [mapExpanded]);

  useEffect(() => {
    if (!mapboxToken || !hasStaticMarkers || !mapContainerRef.current) {
      return;
    }

    const mapInitialCenter = bootstrapCenter ?? FALLBACK_MAP_CENTER;

    let disposed = false;
    hasInitialFitRef.current = false;
    const originMarkerState = originMarkerRef.current;
    const destinationMarkerState = destinationMarkerRef.current;
    const driverMarkerState = driverMarkerRef.current;
    let mapInstance: MapboxGlMap | null = null;
    let loadListener: ((...args: unknown[]) => void) | null = null;
    let errorListener: ((...args: unknown[]) => void) | null = null;
    let mapLoadTimeoutId: ReturnType<typeof setTimeout> | null = null;

    void withTimeout(
      ensureMapboxScript(),
      mapAssetTimeoutMs,
      "Timed out while loading Mapbox assets."
    )
      .then((mapboxgl) => {
        if (disposed || !mapContainerRef.current) {
          return;
        }

        mapboxgl.accessToken = mapboxToken;
        mapboxNamespaceRef.current = mapboxgl;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: MAPBOX_DEFAULT_STYLE,
          center: mapInitialCenter,
          zoom: 11,
        });

        mapInstance = map;
        mapRef.current = map;

        loadListener = () => {
          if (disposed) {
            return;
          }
          if (mapLoadTimeoutId !== null) {
            clearTimeout(mapLoadTimeoutId);
            mapLoadTimeoutId = null;
          }
          setMapStatus("ready");
        };

        errorListener = () => {
          if (disposed) {
            return;
          }
          if (mapLoadTimeoutId !== null) {
            clearTimeout(mapLoadTimeoutId);
            mapLoadTimeoutId = null;
          }
          setMapStatus("error");
        };

        map.on("load", loadListener);
        map.on("error", errorListener);

        mapLoadTimeoutId = setTimeout(() => {
          if (disposed) {
            return;
          }

          disposed = true;
          if (mapInstance?.off && loadListener) {
            mapInstance.off("load", loadListener);
          }
          if (mapInstance?.off && errorListener) {
            mapInstance.off("error", errorListener);
          }
          mapInstance?.remove();
          mapRef.current = null;
          mapboxNamespaceRef.current = null;
          setMapStatus("error");
        }, mapLoadTimeoutMs);
      })
      .catch(() => {
        if (!disposed) {
          setMapStatus("error");
        }
      });

    return () => {
      disposed = true;
      if (mapLoadTimeoutId !== null) {
        clearTimeout(mapLoadTimeoutId);
        mapLoadTimeoutId = null;
      }
      if (mapInstance?.off && loadListener) {
        mapInstance.off("load", loadListener);
      }
      if (mapInstance?.off && errorListener) {
        mapInstance.off("error", errorListener);
      }
      clearMarker(originMarkerState);
      clearMarker(destinationMarkerState);
      clearMarker(driverMarkerState);
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxNamespaceRef.current = null;
    };
  }, [
    bootstrapCenter,
    clearMarker,
    hasStaticMarkers,
    mapAssetTimeoutMs,
    mapLoadTimeoutMs,
    mapboxToken,
  ]);

  useEffect(() => {
    if (mapStatus !== "ready") {
      return;
    }

    syncMarker(originMarkerRef.current, originMarker, "#15803d");
    syncMarker(destinationMarkerRef.current, destinationMarker, "#1d4ed8");
    // Do not depend on `fitMapToPoints` here — it changes every driver poll and would re-run this effect.
    fitMapToPointsRef.current(false);
  }, [
    destinationMarker,
    destinationStaticKey,
    mapStatus,
    originMarker,
    originStaticKey,
    syncMarker,
  ]);

  useEffect(() => {
    if (mapStatus !== "ready") {
      return;
    }

    syncMarker(driverMarkerRef.current, driverMarker, "#dc2626");
  }, [driverMarker, mapStatus, syncMarker]);

  if (!hasStaticMarkers) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Trip coordinates are missing, so the map cannot be displayed for this booking.
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Mapbox is not configured. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable trip maps.
      </div>
    );
  }

  const liveStatusLabel = getLiveStatusLabel(liveDriverStatus, Boolean(driverMarker));
  const liveLine =
    liveStatusOverride && liveStatusOverride.trim().length > 0
      ? liveStatusOverride
      : liveStatusLabel;

  const expandedMode = expandable && mapExpanded;

  return (
    <div
      className={
        expandedMode
          ? "fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-3 sm:p-6"
          : "space-y-3"
      }
      onClick={expandedMode ? () => setMapExpanded(false) : undefined}
      role={expandedMode ? "dialog" : undefined}
      aria-modal={expandedMode ? true : undefined}
      aria-label={expandedMode ? "Expanded trip map" : undefined}
    >
      <div
        className={
          expandedMode
            ? "pointer-events-auto flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            : "flex w-full min-w-0 flex-col"
        }
        onClick={expandedMode ? (e) => e.stopPropagation() : undefined}
      >
        <div
          className={
            expandedMode
              ? "flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2.5"
              : "hidden"
          }
          aria-hidden={!expandedMode}
        >
          <span className="text-sm font-semibold text-zinc-900">Trip map</span>
          <button
            type="button"
            onClick={() => setMapExpanded(false)}
            className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Close expanded map"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={
            expandedMode
              ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 pt-3"
              : "space-y-3"
          }
        >
          <div
            className={
              expandedMode
                ? "relative shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                : "relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100"
            }
          >
            {expandable && !expandedMode ? (
              <button
                type="button"
                onClick={() => setMapExpanded(true)}
                className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200/80 backdrop-blur-sm transition hover:bg-white"
                aria-label="Expand map"
              >
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Expand</span>
              </button>
            ) : null}
            <div
              ref={mapContainerRef}
              className={
                expandedMode
                  ? "h-[min(70dvh,800px)] w-full sm:h-[min(75dvh,880px)]"
                  : "h-72 w-full"
              }
              data-testid="trip-map-container"
            />
            {mapStatus === "loading" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm font-medium text-zinc-700">
                Loading map...
              </div>
            ) : null}
            {mapStatus === "error" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-4 text-center text-sm font-medium text-red-700">
                Failed to load the trip map. Please refresh and try again.
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-zinc-600">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-700" />
              Origin
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
              Destination
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Driver
            </span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
            <p>{liveLine}</p>
            {lastDriverUpdateAt ? (
              <p className="mt-1 text-xs text-zinc-500">
                Last live update: {lastDriverUpdateAt}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
