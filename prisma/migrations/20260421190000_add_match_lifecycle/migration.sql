-- CreateEnum
CREATE TYPE "MatchState" AS ENUM ('SUGGESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "trip_request_id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "state" "MatchState" NOT NULL DEFAULT 'SUGGESTED',
    "score_snapshot" DOUBLE PRECISION NOT NULL,
    "origin_distance_snapshot" DOUBLE PRECISION NOT NULL,
    "destination_distance_snapshot" DOUBLE PRECISION NOT NULL,
    "time_difference_snapshot" DOUBLE PRECISION NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "expiration_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matches_trip_request_id_ride_id_key" ON "matches"("trip_request_id", "ride_id");

-- CreateIndex
CREATE INDEX "matches_trip_request_id_state_created_at_id_idx" ON "matches"("trip_request_id", "state", "created_at", "id");

-- CreateIndex
CREATE INDEX "matches_ride_id_idx" ON "matches"("ride_id");

-- AddForeignKey
ALTER TABLE "matches"
ADD CONSTRAINT "matches_trip_request_id_fkey"
FOREIGN KEY ("trip_request_id") REFERENCES "trip_requests"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches"
ADD CONSTRAINT "matches_ride_id_fkey"
FOREIGN KEY ("ride_id") REFERENCES "rides"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
