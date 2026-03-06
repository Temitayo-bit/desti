import type { DistanceCategory } from "@prisma/client";

export type MyRidesQuickFilter = "All" | "Today" | "Short" | "Medium" | "Long";

export interface MyRideFilterInput {
  id: string;
  destinationText: string;
  earliestDepartAt: string;
  distanceCategory: DistanceCategory;
}

function isSameLocalDate(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function applyQuickFilter(
  ride: MyRideFilterInput,
  activeFilter: MyRidesQuickFilter,
  now: Date,
): boolean {
  if (activeFilter === "All") return true;

  if (activeFilter === "Today") {
    const rideDate = new Date(ride.earliestDepartAt);
    if (Number.isNaN(rideDate.getTime())) {
      return false;
    }
    return isSameLocalDate(rideDate, now);
  }

  if (activeFilter === "Short") return ride.distanceCategory === "SHORT";
  if (activeFilter === "Medium") return ride.distanceCategory === "MEDIUM";
  return ride.distanceCategory === "LONG";
}

export function filterMyRides<T extends MyRideFilterInput>({
  rides,
  searchQuery,
  activeFilter,
  now = new Date(),
}: {
  rides: T[];
  searchQuery: string;
  activeFilter: MyRidesQuickFilter;
  now?: Date;
}): T[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return rides.filter((ride) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      ride.destinationText.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) {
      return false;
    }

    return applyQuickFilter(ride, activeFilter, now);
  });
}
