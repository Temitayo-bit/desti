/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { TripVisualizationMap } from "@/components/TripVisualizationMap";

class MockMap {
  on(event: string, callback: (...args: unknown[]) => void) {
    if (event === "load") {
      callback();
    }
  }

  remove() {
    return undefined;
  }

  fitBounds() {
    return undefined;
  }

  setCenter() {
    return undefined;
  }

  setZoom() {
    return undefined;
  }
}

class StalledMockMap {
  on(event: string, callback: (...args: unknown[]) => void) {
    void event;
    void callback;
    return undefined;
  }

  remove() {
    return undefined;
  }

  fitBounds() {
    return undefined;
  }

  setCenter() {
    return undefined;
  }

  setZoom() {
    return undefined;
  }
}

class MockMarker {
  setLngLat() {
    return this;
  }

  addTo() {
    return this;
  }

  remove() {
    return undefined;
  }
}

class MockBounds {
  extend() {
    return this;
  }
}

describe("TripVisualizationMap", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete window.mapboxgl;
  });

  it("renders map container when static trip coordinates are valid", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.test-mapbox");
    window.mapboxgl = {
      accessToken: "",
      Map: MockMap,
      Marker: MockMarker,
      LngLatBounds: MockBounds,
    } as unknown as NonNullable<typeof window.mapboxgl>;

    render(
      <TripVisualizationMap
        originMarker={{
          role: "origin",
          label: "Campus",
          latitude: 29.035,
          longitude: -81.301,
        }}
        destinationMarker={{
          role: "destination",
          label: "Airport",
          latitude: 29.2108,
          longitude: -81.0228,
        }}
        driverMarker={null}
        liveDriverStatus="unavailable"
        lastDriverUpdateAt={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("trip-map-container")).toBeDefined();
    });
  });

  it("shows missing-coordinate message and skips map container when static coordinates are unavailable", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.test-mapbox");

    render(
      <TripVisualizationMap
        originMarker={null}
        destinationMarker={null}
        driverMarker={null}
        liveDriverStatus="unavailable"
        lastDriverUpdateAt={null}
      />
    );

    expect(
      screen.getByText(/Trip coordinates are missing, so the map cannot be displayed/i)
    ).toBeDefined();
    expect(screen.queryByTestId("trip-map-container")).toBeNull();
  });

  it("shows fallback error UI when map load stalls past timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.test-mapbox");
    window.mapboxgl = {
      accessToken: "",
      Map: StalledMockMap,
      Marker: MockMarker,
      LngLatBounds: MockBounds,
    } as unknown as NonNullable<typeof window.mapboxgl>;

    render(
      <TripVisualizationMap
        originMarker={{
          role: "origin",
          label: "Campus",
          latitude: 29.035,
          longitude: -81.301,
        }}
        destinationMarker={{
          role: "destination",
          label: "Airport",
          latitude: 29.2108,
          longitude: -81.0228,
        }}
        driverMarker={null}
        liveDriverStatus="unavailable"
        lastDriverUpdateAt={null}
        mapLoadTimeoutMs={100}
      />
    );

    expect(screen.getByText(/Loading map/i)).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load the trip map/i)).toBeDefined();
    });
  });
});
