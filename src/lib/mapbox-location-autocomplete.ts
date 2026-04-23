export interface LocationSelection {
  label: string;
  latitude: number;
  longitude: number;
}

export interface MapboxLocationSuggestion extends LocationSelection {
  id: string;
}

interface MapboxGeocodingFeature {
  id?: string;
  place_name?: string;
  text?: string;
  center?: unknown;
  place_type?: string[];
}

interface MapboxGeocodingResponse {
  features?: MapboxGeocodingFeature[];
}

export const LOCATION_AUTOCOMPLETE_MIN_QUERY_LENGTH = 3;
export const LOCATION_AUTOCOMPLETE_DEBOUNCE_MS = 300;

export function getMapboxPublicAccessToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  return token ? token : null;
}

export function isMapboxAutocompleteEnabled(): boolean {
  return Boolean(getMapboxPublicAccessToken());
}

export function hasValidSelectedCoordinates(
  latitude: number | null,
  longitude: number | null,
): boolean {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }

  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function parseCoordinates(
  center: unknown,
): { latitude: number; longitude: number } | null {
  if (!Array.isArray(center) || center.length < 2) {
    return null;
  }

  const longitude = center[0];
  const latitude = center[1];

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !hasValidSelectedCoordinates(latitude, longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

export async function fetchMapboxLocationSuggestions(
  query: string,
  options: { signal?: AbortSignal; limit?: number } = {},
): Promise<MapboxLocationSuggestion[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < LOCATION_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
    return [];
  }

  const accessToken = getMapboxPublicAccessToken();
  if (!accessToken) {
    throw new Error("Mapbox autocomplete is not configured.");
  }

  const limit = options.limit ?? 5;
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedQuery)}.json`,
  );

  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("types", "address,place,poi");

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error("Mapbox autocomplete request failed.");
  }

  const payload = (await response.json()) as MapboxGeocodingResponse;
  if (!Array.isArray(payload.features)) {
    return [];
  }

  const suggestions: MapboxLocationSuggestion[] = [];

  for (const feature of payload.features) {
    const placeTypes = Array.isArray(feature.place_type) ? feature.place_type : [];
    if (placeTypes.includes("country") || placeTypes.includes("region")) {
      continue;
    }

    const coordinates = parseCoordinates(feature.center);
    if (!coordinates) {
      continue;
    }

    const label =
      typeof feature.place_name === "string" && feature.place_name.trim().length > 0
        ? feature.place_name.trim()
        : typeof feature.text === "string"
          ? feature.text.trim()
          : "";

    if (!label) {
      continue;
    }

    const id =
      typeof feature.id === "string" && feature.id.trim().length > 0
        ? feature.id
        : `${label}:${coordinates.latitude}:${coordinates.longitude}`;

    suggestions.push({
      id,
      label,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
  }

  const deduped: MapboxLocationSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    const key = `${suggestion.label}:${suggestion.latitude}:${suggestion.longitude}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(suggestion);
  }

  return deduped;
}
