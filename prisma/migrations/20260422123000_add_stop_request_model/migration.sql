-- CreateEnum
CREATE TYPE "StopRequestState" AS ENUM ('PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "stop_requests" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "rider_user_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "requested_pickup_text" TEXT NOT NULL,
    "requested_pickup_latitude" DOUBLE PRECISION NOT NULL,
    "requested_pickup_longitude" DOUBLE PRECISION NOT NULL,
    "requested_dropoff_text" TEXT NOT NULL,
    "requested_dropoff_latitude" DOUBLE PRECISION NOT NULL,
    "requested_dropoff_longitude" DOUBLE PRECISION NOT NULL,
    "rider_note" TEXT,
    "quoted_price_cents" INTEGER,
    "state" "StopRequestState" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "quoted_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),

    CONSTRAINT "stop_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stop_requests_ride_id_state_created_at_id_idx"
    ON "stop_requests"("ride_id", "state", "created_at", "id");

-- CreateIndex
CREATE INDEX "stop_requests_driver_user_id_created_at_id_idx"
    ON "stop_requests"("driver_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "stop_requests_rider_user_id_created_at_id_idx"
    ON "stop_requests"("rider_user_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "stop_requests"
    ADD CONSTRAINT "stop_requests_ride_id_fkey"
    FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_requests"
    ADD CONSTRAINT "stop_requests_rider_user_id_fkey"
    FOREIGN KEY ("rider_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_requests"
    ADD CONSTRAINT "stop_requests_driver_user_id_fkey"
    FOREIGN KEY ("driver_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
