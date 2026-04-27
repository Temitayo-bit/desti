import { endOfDay, startOfDay } from "date-fns";
import type {
  DistanceCategory,
  MusicPreference,
  VehicleType,
} from "@prisma/client";

export type BrowseTimeWindow =
  | "MORNING"
  | "AFTERNOON"
  | "EVENING"
  | "LATE_NIGHT";

export function getLocalHour(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 12;
  return d.getHours();
}

export function hourMatchesTimeWindow(
  hour: number,
  window: BrowseTimeWindow | null,
): boolean {
  if (window == null) return true;
  if (window === "MORNING") return hour >= 5 && hour < 12;
  if (window === "AFTERNOON") return hour >= 12 && hour < 17;
  if (window === "EVENING") return hour >= 17 && hour < 21;
  return hour >= 21 || hour < 5;
}

export function rideDepartureTimeMatchesWindow(
  earliestDepartAtIso: string,
  window: BrowseTimeWindow | null,
): boolean {
  if (window == null) return true;
  return hourMatchesTimeWindow(
    getLocalHour(earliestDepartAtIso),
    window,
  );
}

export function buildActiveDistanceSet(filter: {
  short: boolean;
  medium: boolean;
  long: boolean;
}): Set<DistanceCategory> | "all" {
  const s = new Set<DistanceCategory>();
  if (filter.short) s.add("SHORT");
  if (filter.medium) s.add("MEDIUM");
  if (filter.long) s.add("LONG");
  if (s.size === 0) return "all";
  if (s.size === 3) return "all";
  return s;
}

export function distanceCategoryLabel(cat: DistanceCategory): string {
  if (cat === "SHORT") return "Short";
  if (cat === "MEDIUM") return "Medium";
  return "Long";
}

export function formatDistanceMilesLabel(cat: DistanceCategory): string {
  if (cat === "SHORT") return "< 20 mi";
  if (cat === "MEDIUM") return "20–100 mi";
  return "> 100 mi";
}

/** Shared with browse API query and My Rides client filters */
export interface SidebarApiFilters {
  musicPreference: string;
  hasAc: string;
  hasTrunkSpace: string;
  vehicleType: string;
}

export const EMPTY_SIDEBAR_API: SidebarApiFilters = {
  musicPreference: "",
  hasAc: "",
  hasTrunkSpace: "",
  vehicleType: "",
};

export function matchesLocalDepartDate(
  earliestIso: string,
  dateYmd: string,
): boolean {
  if (!dateYmd.trim()) return true;
  const t = new Date(earliestIso);
  if (Number.isNaN(t.getTime())) return false;
  const anchor = new Date(`${dateYmd}T12:00:00`);
  if (Number.isNaN(anchor.getTime())) return true;
  return t >= startOfDay(anchor) && t <= endOfDay(anchor);
}

export function myRideMatchesMvp2Sidebar(ride: {
  hasAc: boolean | null;
  hasTrunkSpace: boolean | null;
  musicPreference: MusicPreference | null;
  vehicleType: VehicleType | null;
}, sidebar: SidebarApiFilters): boolean {
  if (sidebar.hasAc === "true" && ride.hasAc !== true) return false;
  if (sidebar.hasAc === "false" && ride.hasAc !== false) return false;

  if (sidebar.hasTrunkSpace === "true" && ride.hasTrunkSpace !== true) {
    return false;
  }
  if (sidebar.hasTrunkSpace === "false" && ride.hasTrunkSpace !== false) {
    return false;
  }

  if (sidebar.musicPreference) {
    if (ride.musicPreference !== sidebar.musicPreference) return false;
  }

  if (sidebar.vehicleType) {
    if (ride.vehicleType !== (sidebar.vehicleType as VehicleType)) {
      return false;
    }
  }

  return true;
}
