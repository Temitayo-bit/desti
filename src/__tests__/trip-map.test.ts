import { describe, expect, it } from "vitest";
import {
  deriveDriverTripMapMarker,
  deriveStaticTripMapMarkers,
} from "@/lib/trip-map";

describe("trip map marker derivation", () => {
  it("derives origin and destination markers from valid coordinates", () => {
    const markers = deriveStaticTripMapMarkers({
      originLabel: "Stetson University",
      originLatitude: 29.035,
      originLongitude: -81.301,
      destinationLabel: "Daytona Beach",
      destinationLatitude: 29.2108,
      destinationLongitude: -81.0228,
    });

    expect(markers.hasAnyCoordinates).toBe(true);
    expect(markers.hasBothCoordinates).toBe(true);
    expect(markers.origin).toEqual(
      expect.objectContaining({
        role: "origin",
        label: "Stetson University",
        latitude: 29.035,
        longitude: -81.301,
      })
    );
    expect(markers.destination).toEqual(
      expect.objectContaining({
        role: "destination",
        label: "Daytona Beach",
        latitude: 29.2108,
        longitude: -81.0228,
      })
    );
  });

  it("safely handles missing or invalid static coordinates", () => {
    const markers = deriveStaticTripMapMarkers({
      originLabel: "Origin",
      originLatitude: null,
      originLongitude: null,
      destinationLabel: "Destination",
      destinationLatitude: 1234,
      destinationLongitude: -81.2,
    });

    expect(markers.hasAnyCoordinates).toBe(false);
    expect(markers.hasBothCoordinates).toBe(false);
    expect(markers.origin).toBeNull();
    expect(markers.destination).toBeNull();
  });

  it("derives driver marker only when live location coordinates are valid", () => {
    const validMarker = deriveDriverTripMapMarker(29.15, -81.05);
    expect(validMarker).toEqual(
      expect.objectContaining({
        role: "driver",
        label: "Driver",
        latitude: 29.15,
        longitude: -81.05,
      })
    );

    expect(deriveDriverTripMapMarker(undefined, -81.05)).toBeNull();
    expect(deriveDriverTripMapMarker(95, -81.05)).toBeNull();
    expect(deriveDriverTripMapMarker(29.15, -181)).toBeNull();
  });
});
