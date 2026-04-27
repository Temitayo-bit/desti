-- Add geocoded location storage for rides and trip requests.
-- Columns are nullable to preserve compatibility with existing rows.

ALTER TABLE "rides"
    ADD COLUMN "origin_resolved_address" TEXT,
    ADD COLUMN "origin_latitude" DOUBLE PRECISION,
    ADD COLUMN "origin_longitude" DOUBLE PRECISION,
    ADD COLUMN "destination_resolved_address" TEXT,
    ADD COLUMN "destination_latitude" DOUBLE PRECISION,
    ADD COLUMN "destination_longitude" DOUBLE PRECISION;

ALTER TABLE "trip_requests"
    ADD COLUMN "origin_resolved_address" TEXT,
    ADD COLUMN "origin_latitude" DOUBLE PRECISION,
    ADD COLUMN "origin_longitude" DOUBLE PRECISION,
    ADD COLUMN "destination_resolved_address" TEXT,
    ADD COLUMN "destination_latitude" DOUBLE PRECISION,
    ADD COLUMN "destination_longitude" DOUBLE PRECISION;
