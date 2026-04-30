import type { LocationField } from "@/lib/location-field";
import { hasValidLocationFieldSelection } from "@/lib/location-field";

export type DistanceCategoryOption = "SHORT" | "MEDIUM" | "LONG";

const KM_EARTH_RADIUS = 6371;
const KM_TO_MILES = 0.621371;

/**
 * Product bands for Post Ride (straight-line distance). The API stores enum
 * `SHORT | MEDIUM | LONG` and does not recompute from coordinates server-side, so
 * the client must classify using the same haversine line distance riders expect.
 * Adjust here only when product definition changes.
 */
export const DISTANCE_CATEGORY_SHORT_MAX_KM = 25; // ~15 mi — local / within DeLand
export const DISTANCE_CATEGORY_MEDIUM_MAX_KM = 160; // ~100 mi — regional

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const dLat = toRadians(latitudeB - latitudeA);
  const dLng = toRadians(longitudeB - longitudeA);
  const latARad = toRadians(latitudeA);
  const latBRad = toRadians(latitudeB);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(latARad) * Math.cos(latBRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return KM_EARTH_RADIUS * c;
}

export function distanceCategoryForStraightLineKm(
  km: number,
): DistanceCategoryOption {
  if (km <= DISTANCE_CATEGORY_SHORT_MAX_KM) {
    return "SHORT";
  }
  if (km <= DISTANCE_CATEGORY_MEDIUM_MAX_KM) {
    return "MEDIUM";
  }
  return "LONG";
}

/**
 * Returns null unless both ends have a locked Mapbox selection with coordinates.
 */
export function distanceCategoryFromLocationFields(
  origin: LocationField,
  destination: LocationField,
): DistanceCategoryOption | null {
  if (!hasValidLocationFieldSelection(origin) || !hasValidLocationFieldSelection(destination)) {
    return null;
  }
  if (
    origin.latitude === null ||
    origin.longitude === null ||
    destination.latitude === null ||
    destination.longitude === null
  ) {
    return null;
  }

  const km = haversineDistanceKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );
  return distanceCategoryForStraightLineKm(km);
}

export function formatPostRideDistanceCategory(
  category: DistanceCategoryOption,
): string {
  switch (category) {
    case "SHORT":
      return "Short (within DeLand)";
    case "MEDIUM":
      return "Medium";
    case "LONG":
      return "Long";
  }
}

/**
 * Compute the straight-line distance in miles between two coordinate pairs and
 * return a human-readable label like "12.4 mi" or "87 mi".
 *
 * Returns `null` when any coordinate is missing so callers can fall back to the
 * category label.
 */
export function formatDistanceMiles(
  originLat: number | null | undefined,
  originLng: number | null | undefined,
  destLat: number | null | undefined,
  destLng: number | null | undefined,
): string | null {
  if (
    originLat == null ||
    originLng == null ||
    destLat == null ||
    destLng == null
  ) {
    return null;
  }

  const km = haversineDistanceKm(originLat, originLng, destLat, destLng);
  const miles = km * KM_TO_MILES;

  if (miles < 1) {
    return `${miles.toFixed(1)} mi`;
  }
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }
  return `${Math.round(miles)} mi`;
}

