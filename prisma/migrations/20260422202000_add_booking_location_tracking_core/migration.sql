-- Add latest-location trip tracking fields directly on bookings (latest point only).
ALTER TABLE "bookings"
ADD COLUMN "current_latitude" DOUBLE PRECISION,
ADD COLUMN "current_longitude" DOUBLE PRECISION,
ADD COLUMN "location_updated_at" TIMESTAMP(3),
ADD COLUMN "trip_started_at" TIMESTAMP(3),
ADD COLUMN "is_location_sharing_active" BOOLEAN NOT NULL DEFAULT false;
