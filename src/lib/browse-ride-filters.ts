import type { DistanceCategory } from "@prisma/client";

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
