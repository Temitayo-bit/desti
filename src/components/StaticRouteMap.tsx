"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMapboxPublicAccessToken } from "@/lib/mapbox-location-autocomplete";

const MAPBOX_GL_VERSION = "v3.4.0";
const MAPBOX_SCRIPT_ID = "desti-mapbox-gl-script";
const MAPBOX_STYLE_LINK_ID = "desti-mapbox-gl-style";
const MAPBOX_DEFAULT_STYLE = "mapbox://styles/mapbox/light-v11";
const DEFAULT_MAPBOX_ASSET_TIMEOUT_MS = 8_000;
const DEFAULT_MAPBOX_LOAD_TIMEOUT_MS = 8_000;

type MapLoadingStatus = "loading" | "ready" | "error";
type CoordinateTuple = [number, number];

interface MarkerState {
  marker: MapboxGlMarker | null;
}

interface StaticRouteMapProps {
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  mapAssetTimeoutMs?: number;
  mapLoadTimeoutMs?: number;
}

interface MapboxGlNamespace {
  accessToken: string;
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: CoordinateTuple;
    zoom: number;
    interactive?: boolean;
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

// Removed declare global to prevent type conflict with TripVisualizationMap

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

  const win = window as unknown as { mapboxgl?: MapboxGlNamespace };

  if (win.mapboxgl) {
    return Promise.resolve(win.mapboxgl);
  }

  if (!mapboxAssetsPromise) {
    mapboxAssetsPromise = new Promise<MapboxGlNamespace>((resolve, reject) => {
      const existingScript = document.getElementById(MAPBOX_SCRIPT_ID) as
        | HTMLScriptElement
        | null;

      const onLoaded = () => {
        if (!win.mapboxgl) {
          reject(new Error("Mapbox script loaded, but mapboxgl is unavailable."));
          return;
        }
        resolve(win.mapboxgl);
      };

      const onError = () => {
        reject(new Error("Failed to load Mapbox script."));
      };

      if (existingScript) {
        if (win.mapboxgl) {
          resolve(win.mapboxgl);
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

export function StaticRouteMap({
  originLatitude,
  originLongitude,
  destinationLatitude,
  destinationLongitude,
  mapAssetTimeoutMs = DEFAULT_MAPBOX_ASSET_TIMEOUT_MS,
  mapLoadTimeoutMs = DEFAULT_MAPBOX_LOAD_TIMEOUT_MS,
}: StaticRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGlMap | null>(null);
  const mapboxNamespaceRef = useRef<MapboxGlNamespace | null>(null);
  const hasInitialFitRef = useRef(false);
  const originMarkerRef = useRef<MarkerState>({ marker: null });
  const destinationMarkerRef = useRef<MarkerState>({ marker: null });
  const [mapStatus, setMapStatus] = useState<MapLoadingStatus>("loading");

  const mapboxToken = getMapboxPublicAccessToken();
  const hasOriginCoordinates = originLatitude !== null && originLongitude !== null;
  const hasDestinationCoordinates = destinationLatitude !== null && destinationLongitude !== null;
  const hasCoordinates = hasOriginCoordinates || hasDestinationCoordinates;

  const initialCenter = useMemo<CoordinateTuple | null>(() => {
    if (originLatitude !== null && originLongitude !== null) {
      return [originLongitude, originLatitude];
    }
    if (destinationLatitude !== null && destinationLongitude !== null) {
      return [destinationLongitude, destinationLatitude];
    }
    return null;
  }, [destinationLatitude, destinationLongitude, originLatitude, originLongitude]);

  const allRelevantPoints = useMemo<CoordinateTuple[]>(() => {
    const points: CoordinateTuple[] = [];
    if (originLatitude !== null && originLongitude !== null) {
      points.push([originLongitude, originLatitude]);
    }
    if (destinationLatitude !== null && destinationLongitude !== null) {
      points.push([destinationLongitude, destinationLatitude]);
    }
    return points;
  }, [destinationLatitude, destinationLongitude, originLatitude, originLongitude]);

  const clearMarker = useCallback((markerState: MarkerState) => {
    markerState.marker?.remove();
    markerState.marker = null;
  }, []);

  const syncMarker = useCallback(
    (
      markerState: MarkerState,
      latitude: number | null,
      longitude: number | null,
      color: string,
      label: string
    ) => {
      const map = mapRef.current;
      const mapboxgl = mapboxNamespaceRef.current;

      if (!map || !mapboxgl || latitude === null || longitude === null) {
        clearMarker(markerState);
        return;
      }

      const coordinate: CoordinateTuple = [longitude, latitude];

      if (markerState.marker) {
        markerState.marker.setLngLat(coordinate);
        return;
      }

      markerState.marker = new mapboxgl.Marker({
        element: createDotMarkerElement(color, label),
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

  useEffect(() => {
    if (!mapboxToken || !hasCoordinates || !initialCenter || !mapContainerRef.current) {
      return;
    }

    let disposed = false;
    hasInitialFitRef.current = false;
    const originMarkerState = originMarkerRef.current;
    const destinationMarkerState = destinationMarkerRef.current;
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
          center: initialCenter,
          zoom: 11,
          interactive: false,
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
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxNamespaceRef.current = null;
    };
  }, [
    clearMarker,
    hasCoordinates,
    initialCenter,
    mapAssetTimeoutMs,
    mapLoadTimeoutMs,
    mapboxToken,
  ]);

  useEffect(() => {
    if (mapStatus !== "ready") {
      return;
    }

    syncMarker(originMarkerRef.current, originLatitude, originLongitude, "#15803d", "Origin");
    syncMarker(destinationMarkerRef.current, destinationLatitude, destinationLongitude, "#1d4ed8", "Destination");
    fitMapToPoints(false);
  }, [
    destinationLatitude,
    destinationLongitude,
    fitMapToPoints,
    mapStatus,
    originLatitude,
    originLongitude,
    syncMarker,
  ]);

  if (!hasCoordinates) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Map coordinates are missing.
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Mapbox token is not configured.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
      <div
        ref={mapContainerRef}
        className="h-48 md:h-64 w-full"
        data-testid="static-route-map-container"
      />
      {mapStatus === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/75 text-sm font-medium text-zinc-700 backdrop-blur-sm">
          Loading map...
        </div>
      ) : null}
      {mapStatus === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-4 text-center text-sm font-medium text-red-700">
          Failed to load map.
        </div>
      ) : null}
    </div>
  );
}
