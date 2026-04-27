-- Add optional ride-level attributes used for ride creation/editing and strict browse filtering.

-- CreateEnum
CREATE TYPE "MusicPreference" AS ENUM ('MUSIC_ALLOWED', 'NO_MUSIC');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'SUV', 'TRUCK', 'VAN', 'COUPE', 'OTHER');

-- AlterTable
ALTER TABLE "rides"
    ADD COLUMN "music_preference" "MusicPreference",
    ADD COLUMN "has_ac" BOOLEAN,
    ADD COLUMN "has_trunk_space" BOOLEAN,
    ADD COLUMN "vehicle_type" "VehicleType";
