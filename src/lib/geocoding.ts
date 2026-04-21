const DEFAULT_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const GEOCODER_TIMEOUT_MS = 8_000;
const GEOCODER_USER_AGENT_PREFIX = "desti-mvp2-geocoder/1.0";
const COORDINATE_EQUALITY_EPSILON = 1e-6;
const GEOCODER_CACHE_TTL_MS = 5 * 60 * 1000;
const GEOCODER_MIN_REQUEST_INTERVAL_MS = 1_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ResolvedLocation {
    inputText: string;
    resolvedAddress: string;
    latitude: number;
    longitude: number;
}

export type GeocodingErrorCode =
    | "MISSING_INPUT"
    | "RESOLUTION_FAILED"
    | "INVALID_RESULT"
    | "PROVIDER_FAILURE"
    | "PROVIDER_TIMEOUT"
    | "SAME_COORDINATES";

export class GeocodingError extends Error {
    readonly code: GeocodingErrorCode;

    constructor(code: GeocodingErrorCode, message: string) {
        super(message);
        this.name = "GeocodingError";
        this.code = code;
    }
}

interface GeocoderConfig {
    nominatimBaseUrl: string;
    contactEmail: string | null;
    userAgent: string;
}

interface CachedResolvedLocation {
    value: ResolvedLocation;
    expiresAtMs: number;
}

const locationCache = new Map<string, CachedResolvedLocation>();
let nextAllowedRequestAtMs = 0;
let requestQueue: Promise<void> = Promise.resolve();

function resolveNominatimBaseUrl(rawBaseUrl: string | undefined): string {
    const candidate = rawBaseUrl?.trim();
    if (!candidate) {
        return DEFAULT_NOMINATIM_BASE_URL;
    }

    try {
        const parsed = new URL(candidate);
        return parsed.toString();
    } catch {
        throw new Error(
            "Invalid NOMINATIM_BASE_URL configured."
        );
    }
}

function resolveContactEmail(rawContactEmail: string | undefined): string | null {
    const candidate = rawContactEmail?.trim();
    if (!candidate) {
        return null;
    }

    if (!EMAIL_PATTERN.test(candidate)) {
        console.warn(
            `[geocoding] Ignoring invalid GEOCODER_CONTACT_EMAIL \"${candidate}\". Expected a valid email format.`
        );
        return null;
    }

    return candidate;
}

function buildGeocoderConfig(): GeocoderConfig {
    const contactEmail = resolveContactEmail(process.env.GEOCODER_CONTACT_EMAIL);

    return {
        nominatimBaseUrl: resolveNominatimBaseUrl(process.env.NOMINATIM_BASE_URL),
        contactEmail,
        userAgent: contactEmail
            ? `${GEOCODER_USER_AGENT_PREFIX} (${contactEmail})`
            : GEOCODER_USER_AGENT_PREFIX,
    };
}

function parseCoordinate(
    value: unknown,
    axis: "latitude" | "longitude"
): number {
    const numeric =
        typeof value === "number"
            ? value
            : typeof value === "string"
              ? value.trim().length > 0
                  ? Number(value.trim())
                  : Number.NaN
              : Number.NaN;

    if (!Number.isFinite(numeric)) {
        throw new GeocodingError(
            "INVALID_RESULT",
            `Resolved ${axis} is invalid.`
        );
    }

    if (axis === "latitude" && (numeric < -90 || numeric > 90)) {
        throw new GeocodingError(
            "INVALID_RESULT",
            "Resolved latitude is outside the valid range [-90, 90]."
        );
    }

    if (axis === "longitude" && (numeric < -180 || numeric > 180)) {
        throw new GeocodingError(
            "INVALID_RESULT",
            "Resolved longitude is outside the valid range [-180, 180]."
        );
    }

    return numeric;
}

interface NominatimResult {
    lat?: string;
    lon?: string;
    display_name?: string;
}

function getCachedLocationOrNull(cacheKey: string): ResolvedLocation | null {
    const cached = locationCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (cached.expiresAtMs <= Date.now()) {
        locationCache.delete(cacheKey);
        return null;
    }

    return cached.value;
}

function storeCachedLocation(cacheKey: string, value: ResolvedLocation) {
    locationCache.set(cacheKey, {
        value,
        expiresAtMs: Date.now() + GEOCODER_CACHE_TTL_MS,
    });
}

async function waitForRateLimitSlot() {
    const nextTask = requestQueue.then(async () => {
        const now = Date.now();
        const waitMs = Math.max(0, nextAllowedRequestAtMs - now);
        if (waitMs > 0) {
            await new Promise<void>((resolve) =>
                setTimeout(() => resolve(), waitMs)
            );
        }

        nextAllowedRequestAtMs =
            Math.max(Date.now(), nextAllowedRequestAtMs) +
            GEOCODER_MIN_REQUEST_INTERVAL_MS;
    });

    requestQueue = nextTask.catch(() => undefined);
    await nextTask;
}

export async function resolveLocationOrThrow(
    inputText: string
): Promise<ResolvedLocation> {
    const normalizedInput = inputText.trim();
    if (!normalizedInput) {
        throw new GeocodingError(
            "MISSING_INPUT",
            "Location text is required."
        );
    }

    const cachedLocation = getCachedLocationOrNull(normalizedInput);
    if (cachedLocation) {
        return cachedLocation;
    }

    const config = buildGeocoderConfig();

    const searchUrl = new URL("/search", config.nominatimBaseUrl);
    searchUrl.searchParams.set("q", normalizedInput);
    searchUrl.searchParams.set("format", "jsonv2");
    searchUrl.searchParams.set("limit", "1");
    searchUrl.searchParams.set("countrycodes", "us");
    if (config.contactEmail) {
        searchUrl.searchParams.set("email", config.contactEmail);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEOCODER_TIMEOUT_MS);

    try {
        await waitForRateLimitSlot();

        const response = await fetch(searchUrl.toString(), {
            method: "GET",
            headers: {
                Accept: "application/json",
                "User-Agent": config.userAgent,
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new GeocodingError(
                "PROVIDER_FAILURE",
                "Location provider is currently unavailable."
            );
        }

        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload) || payload.length === 0) {
            throw new GeocodingError(
                "RESOLUTION_FAILED",
                "Location could not be resolved to valid US coordinates."
            );
        }

        const top = payload[0] as NominatimResult;

        const latitude = parseCoordinate(top.lat, "latitude");
        const longitude = parseCoordinate(top.lon, "longitude");

        const resolvedAddress =
            typeof top.display_name === "string" && top.display_name.trim().length > 0
                ? top.display_name.trim()
                : normalizedInput;

        const resolvedLocation: ResolvedLocation = {
            inputText: normalizedInput,
            resolvedAddress,
            latitude,
            longitude,
        };

        storeCachedLocation(normalizedInput, resolvedLocation);
        return resolvedLocation;
    } catch (error) {
        if (error instanceof GeocodingError) {
            throw error;
        }

        if (
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name: string }).name === "AbortError"
        ) {
            throw new GeocodingError(
                "PROVIDER_TIMEOUT",
                "Location lookup timed out. Please try again."
            );
        }

        throw new GeocodingError(
            "PROVIDER_FAILURE",
            "Location provider request failed."
        );
    } finally {
        clearTimeout(timeoutId);
    }
}

export function assertDistinctResolvedLocationsOrThrow(
    origin: Pick<ResolvedLocation, "latitude" | "longitude">,
    destination: Pick<ResolvedLocation, "latitude" | "longitude">
) {
    const sameLatitude =
        Math.abs(origin.latitude - destination.latitude) <=
        COORDINATE_EQUALITY_EPSILON;
    const sameLongitude =
        Math.abs(origin.longitude - destination.longitude) <=
        COORDINATE_EQUALITY_EPSILON;

    if (sameLatitude && sameLongitude) {
        throw new GeocodingError(
            "SAME_COORDINATES",
            "Origin and destination must resolve to different coordinates."
        );
    }
}
