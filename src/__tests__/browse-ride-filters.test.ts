import { describe, expect, it } from "vitest";
import type { MusicPreference, VehicleType } from "@prisma/client";
import {
  buildActiveDistanceSet,
  EMPTY_SIDEBAR_API,
  getLocalHour,
  hourMatchesTimeWindow,
  INVALID_LOCAL_HOUR,
  matchesLocalDepartDate,
  myRideMatchesMvp2Sidebar,
  rideDepartureTimeMatchesWindow,
} from "@/lib/browse-ride-filters";

describe("browse-ride-filters", () => {
  describe("getLocalHour", () => {
    it("returns local hour for valid ISO strings", () => {
      const d = new Date("2026-06-15T14:30:00");
      const iso = d.toISOString();
      expect(getLocalHour(iso)).toBe(d.getHours());
    });

    it("returns INVALID_LOCAL_HOUR for unparseable input", () => {
      expect(getLocalHour("not-a-date")).toBe(INVALID_LOCAL_HOUR);
    });
  });

  /**
   * Time-window boundaries match `hourMatchesTimeWindow` (late night wraps 21:00–04:59).
   */
  describe("hourMatchesTimeWindow", () => {
    it("treats invalid hour as non-match for any window", () => {
      expect(hourMatchesTimeWindow(INVALID_LOCAL_HOUR, "MORNING")).toBe(false);
      expect(hourMatchesTimeWindow(-1, "AFTERNOON")).toBe(false);
    });

    it("ignores window when null", () => {
      expect(hourMatchesTimeWindow(99, null)).toBe(true);
    });

    it("classifies MORNING (05:00–11:59)", () => {
      expect(hourMatchesTimeWindow(4, "MORNING")).toBe(false);
      expect(hourMatchesTimeWindow(5, "MORNING")).toBe(true);
      expect(hourMatchesTimeWindow(11, "MORNING")).toBe(true);
      expect(hourMatchesTimeWindow(12, "MORNING")).toBe(false);
    });

    it("classifies AFTERNOON (12:00–16:59)", () => {
      expect(hourMatchesTimeWindow(11, "AFTERNOON")).toBe(false);
      expect(hourMatchesTimeWindow(12, "AFTERNOON")).toBe(true);
      expect(hourMatchesTimeWindow(16, "AFTERNOON")).toBe(true);
      expect(hourMatchesTimeWindow(17, "AFTERNOON")).toBe(false);
    });

    it("classifies EVENING (17:00–20:59)", () => {
      expect(hourMatchesTimeWindow(16, "EVENING")).toBe(false);
      expect(hourMatchesTimeWindow(17, "EVENING")).toBe(true);
      expect(hourMatchesTimeWindow(20, "EVENING")).toBe(true);
      expect(hourMatchesTimeWindow(21, "EVENING")).toBe(false);
    });

    it("classifies LATE_NIGHT (21:00–04:59 wrap)", () => {
      expect(hourMatchesTimeWindow(20, "LATE_NIGHT")).toBe(false);
      expect(hourMatchesTimeWindow(21, "LATE_NIGHT")).toBe(true);
      expect(hourMatchesTimeWindow(0, "LATE_NIGHT")).toBe(true);
      expect(hourMatchesTimeWindow(4, "LATE_NIGHT")).toBe(true);
      expect(hourMatchesTimeWindow(5, "LATE_NIGHT")).toBe(false);
    });
  });

  describe("rideDepartureTimeMatchesWindow", () => {
    it("returns false for invalid departure timestamps when a window is set", () => {
      expect(
        rideDepartureTimeMatchesWindow("invalid", "MORNING"),
      ).toBe(false);
    });
  });

  describe("buildActiveDistanceSet", () => {
    it('returns "all" when all three are selected', () => {
      const r = buildActiveDistanceSet({
        short: true,
        medium: true,
        long: true,
      });
      expect(r).toBe("all");
    });

    it("returns an empty set when nothing is selected (not all)", () => {
      const r = buildActiveDistanceSet({
        short: false,
        medium: false,
        long: false,
      });
      expect(r).not.toBe("all");
      expect(r).toBeInstanceOf(Set);
      expect((r as Set<string>).size).toBe(0);
    });

    it("returns a single-category set when one is selected", () => {
      const r = buildActiveDistanceSet({
        short: true,
        medium: false,
        long: false,
      });
      expect(r).not.toBe("all");
      expect((r as Set<"SHORT" | "MEDIUM" | "LONG">).has("SHORT")).toBe(true);
      expect((r as Set<"SHORT" | "MEDIUM" | "LONG">).size).toBe(1);
    });
  });

  describe("matchesLocalDepartDate", () => {
    it("returns true when no date filter", () => {
      expect(
        matchesLocalDepartDate("2026-01-10T10:00:00.000Z", ""),
      ).toBe(true);
    });

    it("returns false for invalid ride time when a date is set", () => {
      expect(matchesLocalDepartDate("invalid", "2026-01-10")).toBe(false);
    });

    it("matches a ride that falls on the filter day (local day window)", () => {
      const ymd = "2026-01-10";
      const localNoon = new Date(`${ymd}T12:00:00`);
      expect(
        matchesLocalDepartDate(localNoon.toISOString(), ymd),
      ).toBe(true);
    });
  });

  describe("myRideMatchesMvp2Sidebar", () => {
    const base = {
      hasAc: null as boolean | null,
      hasTrunkSpace: null as boolean | null,
      musicPreference: null as MusicPreference | null,
      vehicleType: null as VehicleType | null,
    };

    it("returns true for empty sidebar", () => {
      expect(
        myRideMatchesMvp2Sidebar(
          { ...base, hasAc: true },
          { ...EMPTY_SIDEBAR_API },
        ),
      ).toBe(true);
    });

    it("hasAc: tri-state vs filter true", () => {
      const s = { ...EMPTY_SIDEBAR_API, hasAc: "true" as const };
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasAc: true }, s),
      ).toBe(true);
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasAc: false }, s),
      ).toBe(false);
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasAc: null }, s),
      ).toBe(false);
    });

    it("hasAc: tri-state vs filter false", () => {
      const s = { ...EMPTY_SIDEBAR_API, hasAc: "false" as const };
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasAc: false }, s),
      ).toBe(true);
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasAc: true }, s),
      ).toBe(false);
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasAc: null }, s),
      ).toBe(false);
    });

    it("hasTrunkSpace vs filter", () => {
      const s = { ...EMPTY_SIDEBAR_API, hasTrunkSpace: "true" as const };
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasTrunkSpace: true }, s),
      ).toBe(true);
      expect(
        myRideMatchesMvp2Sidebar({ ...base, hasTrunkSpace: null }, s),
      ).toBe(false);
    });

    it("musicPreference when set", () => {
      const s = {
        ...EMPTY_SIDEBAR_API,
        musicPreference: "NO_MUSIC" as const,
      };
      expect(
        myRideMatchesMvp2Sidebar(
          { ...base, musicPreference: "NO_MUSIC" },
          s,
        ),
      ).toBe(true);
      expect(
        myRideMatchesMvp2Sidebar(
          { ...base, musicPreference: "MUSIC_ALLOWED" },
          s,
        ),
      ).toBe(false);
      expect(
        myRideMatchesMvp2Sidebar({ ...base, musicPreference: null }, s),
      ).toBe(false);
    });

    it("vehicleType when set", () => {
      const s = { ...EMPTY_SIDEBAR_API, vehicleType: "SUV" };
      expect(
        myRideMatchesMvp2Sidebar(
          { ...base, vehicleType: "SUV" as VehicleType },
          s,
        ),
      ).toBe(true);
      expect(
        myRideMatchesMvp2Sidebar(
          { ...base, vehicleType: "SEDAN" as VehicleType },
          s,
        ),
      ).toBe(false);
    });
  });
});
