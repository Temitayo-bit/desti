import { hasValidSelectedCoordinates } from "@/lib/mapbox-location-autocomplete";

export type TripMapMarkerRole = "origin" | "destination" | "driver";

export interface TripMapCoordinate {
  latitude: number;
  longitude: number;
}

export interface TripMapMarker extends TripMapCoordinate {
  role: TripMapMarkerRole;
  label: string;
}

export interface StaticTripMapMarkerInputs {
  originLabel: string;
  originLatitude: number | null | undefined;
  originLongitude: number | null | undefined;
  destinationLabel: string;
  destinationLatitude: number | null | undefined;
  destinationLongitude: number | null | undefined;
}

export interface StaticTripMapMarkers {
  origin: TripMapMarker | null;
  destination: TripMapMarker | null;
  hasAnyCoordinates: boolean;
  hasBothCoordinates: boolean;
}

function toValidCoordinate(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): TripMapCoordinate | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  if (!hasValidSelectedCoordinates(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export function deriveStaticTripMapMarkers(
  input: StaticTripMapMarkerInputs
): StaticTripMapMarkers {
  const originCoordinate = toValidCoordinate(
    input.originLatitude,
    input.originLongitude
  );
  const destinationCoordinate = toValidCoordinate(
    input.destinationLatitude,
    input.destinationLongitude
  );

  const origin = originCoordinate
    ? {
        role: "origin" as const,
        label: input.originLabel,
        latitude: originCoordinate.latitude,
        longitude: originCoordinate.longitude,
      }
    : null;

  const destination = destinationCoordinate
    ? {
        role: "destination" as const,
        label: input.destinationLabel,
        latitude: destinationCoordinate.latitude,
        longitude: destinationCoordinate.longitude,
      }
    : null;

  return {
    origin,
    destination,
    hasAnyCoordinates: Boolean(origin || destination),
    hasBothCoordinates: Boolean(origin && destination),
  };
}

export function deriveDriverTripMapMarker(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): TripMapMarker | null {
  const coordinate = toValidCoordinate(latitude, longitude);
  if (!coordinate) {
    return null;
  }

  return {
    role: "driver",
    label: "Driver",
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  };
}
