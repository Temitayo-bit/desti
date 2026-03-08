import type { DistanceCategory } from "@prisma/client";

export type MyRidesQuickFilter =
  | "All"
  | "Today"
  | "Upcoming"
  | "Past"
  | "Has Upcoming Bookings";

export interface MyRideFilterInput {
  id: string;
  destinationText: string;
  earliestDepartAt: string;
  latestDepartAt: string;
  distanceCategory: DistanceCategory;
  confirmedBookings: readonly unknown[];
}

function isSameLocalDate(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function endOfLocalDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
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

  if (activeFilter === "Upcoming") {
    const rideDate = new Date(ride.earliestDepartAt);
    if (Number.isNaN(rideDate.getTime())) {
      return false;
    }
    return rideDate > endOfLocalDay(now);
  }

  if (activeFilter === "Past") {
    const latestDate = new Date(ride.latestDepartAt);
    if (Number.isNaN(latestDate.getTime())) {
      return false;
    }
    return latestDate < now;
  }

  if (ride.confirmedBookings.length === 0) {
    return false;
  }

  const latestDate = new Date(ride.latestDepartAt);
  if (Number.isNaN(latestDate.getTime())) {
    return false;
  }

  return latestDate >= now;
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
