import type {
  DistanceCategory,
  MusicPreference,
  VehicleType,
} from "@prisma/client";
import type { ConfirmedBookingSummary } from "@/types/booking";

export type ManagedRideStatus = "ACTIVE" | "CANCELLED";

export interface ManagedRideSummary {
  id: string;
  driverUserId: string;
  originText: string;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationText: string;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  earliestDepartAt: string;
  latestDepartAt: string;
  distanceCategory: DistanceCategory;
  priceCents: number;
  seatsTotal: number;
  seatsAvailable: number;
  musicPreference: MusicPreference | null;
  hasAc: boolean | null;
  hasTrunkSpace: boolean | null;
  vehicleType: VehicleType | null;
  pickupInstructions: string | null;
  dropoffInstructions: string | null;
  preferredDepartAt: string | null;
  status: ManagedRideStatus;
  createdAt: string;
  updatedAt: string;
  confirmedBookings: ConfirmedBookingSummary[];
}
