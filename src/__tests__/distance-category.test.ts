import { describe, expect, it } from "vitest";
import {
  DISTANCE_CATEGORY_MEDIUM_MAX_KM,
  DISTANCE_CATEGORY_SHORT_MAX_KM,
  distanceCategoryForStraightLineKm,
  haversineDistanceKm,
} from "@/lib/distance-category";

describe("distance category from straight-line km", () => {
  it("classifies SHORT at or below short max", () => {
    expect(distanceCategoryForStraightLineKm(0)).toBe("SHORT");
    expect(distanceCategoryForStraightLineKm(DISTANCE_CATEGORY_SHORT_MAX_KM)).toBe("SHORT");
  });

  it("classifies MEDIUM between short and medium max", () => {
    expect(distanceCategoryForStraightLineKm(DISTANCE_CATEGORY_SHORT_MAX_KM + 0.01)).toBe("MEDIUM");
    expect(distanceCategoryForStraightLineKm(DISTANCE_CATEGORY_MEDIUM_MAX_KM)).toBe("MEDIUM");
  });

  it("classifies LONG beyond medium max", () => {
    expect(distanceCategoryForStraightLineKm(DISTANCE_CATEGORY_MEDIUM_MAX_KM + 0.01)).toBe("LONG");
  });
});

describe("haversineDistanceKm", () => {
  it("matches known Stetson ↔ Daytona approximate distance", () => {
    const km = haversineDistanceKm(29.0361, -81.302, 29.2108, -81.0228);
    expect(km).toBeGreaterThan(30);
    expect(km).toBeLessThan(40);
  });
});
