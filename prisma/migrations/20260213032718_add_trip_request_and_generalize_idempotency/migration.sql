/*
  This migration:
  1. Creates TripRequestStatus and IdempotencyEntityType enums
  2. Creates trip_requests table
  3. Generalizes idempotency_keys: renames driver_user_id → user_id, adds entity_type,
     makes ride_id nullable, adds trip_request_id — with data migration for existing rows.
*/

-- CreateEnum
CREATE TYPE "TripRequestStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdempotencyEntityType" AS ENUM ('RIDE', 'TRIP_REQUEST');

-- CreateTable
CREATE TABLE "trip_requests" (
    "id" TEXT NOT NULL,
    "rider_user_id" TEXT NOT NULL,
    "origin_text" TEXT NOT NULL,
    "destination_text" TEXT NOT NULL,
    "earliest_desired_at" TIMESTAMP(3) NOT NULL,
    "latest_desired_at" TIMESTAMP(3) NOT NULL,
    "distance_category" "DistanceCategory" NOT NULL,
    "seats_needed" INTEGER NOT NULL,
    "status" "TripRequestStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_requests_pkey" PRIMARY KEY ("id")
);

-- Step 1: Drop old FK and unique constraint on idempotency_keys
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_ride_id_fkey";
DROP INDEX "idempotency_keys_driver_user_id_idempotency_key_key";

-- Step 2: Add new columns as nullable first
ALTER TABLE "idempotency_keys"
    ADD COLUMN "user_id" TEXT,
    ADD COLUMN "entity_type" "IdempotencyEntityType",
    ADD COLUMN "trip_request_id" TEXT;

-- Step 3: Migrate existing rows — copy driver_user_id → user_id, set entity_type = RIDE
UPDATE "idempotency_keys"
    SET "user_id" = "driver_user_id",
        "entity_type" = 'RIDE';

-- Step 4: Make new columns NOT NULL now that data is populated
ALTER TABLE "idempotency_keys"
    ALTER COLUMN "user_id" SET NOT NULL,
    ALTER COLUMN "entity_type" SET NOT NULL;

-- Step 5: Drop old column, make ride_id nullable
ALTER TABLE "idempotency_keys"
    DROP COLUMN "driver_user_id",
    ALTER COLUMN "ride_id" DROP NOT NULL;

-- Step 6: Create new unique index
CREATE UNIQUE INDEX "idempotency_keys_user_id_idempotency_key_entity_type_key"
    ON "idempotency_keys"("user_id", "idempotency_key", "entity_type");

-- Step 7: Add foreign keys
ALTER TABLE "trip_requests"
    ADD CONSTRAINT "trip_requests_rider_user_id_fkey"
    FOREIGN KEY ("rider_user_id") REFERENCES "users"("clerk_user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_ride_id_fkey"
    FOREIGN KEY ("ride_id") REFERENCES "rides"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_trip_request_id_fkey"
    FOREIGN KEY ("trip_request_id") REFERENCES "trip_requests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
