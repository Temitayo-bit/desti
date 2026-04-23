"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMapboxPublicAccessToken } from "@/lib/mapbox-location-autocomplete";
import type { TripMapMarker } from "@/lib/trip-map";

const MAPBOX_GL_VERSION = "v3.4.0";
const MAPBOX_SCRIPT_ID = "desti-mapbox-gl-script";
const MAPBOX_STYLE_LINK_ID = "desti-mapbox-gl-style";
const MAPBOX_DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";

type MapLoadingStatus = "loading" | "ready" | "error";
type LiveDriverStatus = "updating" | "unavailable" | "stopped";
type CoordinateTuple = [number, number];

interface MarkerState {
  marker: MapboxGlMarker | null;
}

interface TripVisualizationMapProps {
  originMarker: TripMapMarker | null;
  destinationMarker: TripMapMarker | null;
  driverMarker: TripMapMarker | null;
  liveDriverStatus: LiveDriverStatus;
  lastDriverUpdateAt: string | null;
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
}: TripVisualizationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxGlMap | null>(null);
  const mapboxNamespaceRef = useRef<MapboxGlNamespace | null>(null);
  const hasInitialFitRef = useRef(false);
  const originMarkerRef = useRef<MarkerState>({ marker: null });
  const destinationMarkerRef = useRef<MarkerState>({ marker: null });
  const driverMarkerRef = useRef<MarkerState>({ marker: null });
  const [mapStatus, setMapStatus] = useState<MapLoadingStatus>("loading");

  const mapboxToken = getMapboxPublicAccessToken();
  const hasStaticMarkers = Boolean(originMarker || destinationMarker);

  const initialCenter = useMemo<CoordinateTuple | null>(() => {
    if (originMarker) {
      return toCoordinateTuple(originMarker);
    }

    if (destinationMarker) {
      return toCoordinateTuple(destinationMarker);
    }

    if (driverMarker) {
      return toCoordinateTuple(driverMarker);
    }

    return null;
  }, [destinationMarker, driverMarker, originMarker]);

  const allRelevantPoints = useMemo<CoordinateTuple[]>(() => {
    const points: CoordinateTuple[] = [];
    if (originMarker) {
      points.push(toCoordinateTuple(originMarker));
    }
    if (destinationMarker) {
      points.push(toCoordinateTuple(destinationMarker));
    }
    if (driverMarker) {
      points.push(toCoordinateTuple(driverMarker));
    }
    return points;
  }, [destinationMarker, driverMarker, originMarker]);

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
        const bounds = new mapboxgl.LngLatBounds(
          allRelevantPoints[0],
          allRelevantPoints[0]
        );
        for (const point of allRelevantPoints.slice(1)) {
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
    if (!mapboxToken || !hasStaticMarkers || !initialCenter || !mapContainerRef.current) {
      return;
    }

    let disposed = false;
    hasInitialFitRef.current = false;
    const originMarkerState = originMarkerRef.current;
    const destinationMarkerState = destinationMarkerRef.current;
    const driverMarkerState = driverMarkerRef.current;

    void ensureMapboxScript()
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
        });

        mapRef.current = map;

        map.on("load", () => {
          if (disposed) {
            return;
          }
          setMapStatus("ready");
        });

        map.on("error", () => {
          if (disposed) {
            return;
          }
          setMapStatus("error");
        });
      })
      .catch(() => {
        if (!disposed) {
          setMapStatus("error");
        }
      });

    return () => {
      disposed = true;
      clearMarker(originMarkerState);
      clearMarker(destinationMarkerState);
      clearMarker(driverMarkerState);
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxNamespaceRef.current = null;
    };
  }, [
    clearMarker,
    hasStaticMarkers,
    initialCenter,
    mapboxToken,
  ]);

  useEffect(() => {
    if (mapStatus !== "ready") {
      return;
    }

    syncMarker(originMarkerRef.current, originMarker, "#15803d");
    syncMarker(destinationMarkerRef.current, destinationMarker, "#1d4ed8");
    fitMapToPoints(false);
  }, [destinationMarker, fitMapToPoints, mapStatus, originMarker, syncMarker]);

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

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <div
          ref={mapContainerRef}
          className="h-72 w-full"
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
        <p>{liveStatusLabel}</p>
        {lastDriverUpdateAt ? (
          <p className="mt-1 text-xs text-zinc-500">
            Last live update: {lastDriverUpdateAt}
          </p>
        ) : null}
      </div>
    </div>
  );
}
