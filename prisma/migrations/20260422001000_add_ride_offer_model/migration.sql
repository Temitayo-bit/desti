-- CreateEnum
CREATE TYPE "RideOfferState" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ride_offers" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "rider_user_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "offered_price_cents" INTEGER NOT NULL,
    "state" "RideOfferState" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),

    CONSTRAINT "ride_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ride_offers_ride_id_state_created_at_id_idx"
    ON "ride_offers"("ride_id", "state", "created_at", "id");

-- CreateIndex
CREATE INDEX "ride_offers_driver_user_id_created_at_id_idx"
    ON "ride_offers"("driver_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ride_offers_rider_user_id_created_at_id_idx"
    ON "ride_offers"("rider_user_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ride_offer_active_per_rider_ride"
    ON "ride_offers"("ride_id", "rider_user_id")
    WHERE "state" = 'PENDING';

-- AddForeignKey
ALTER TABLE "ride_offers"
    ADD CONSTRAINT "ride_offers_ride_id_fkey"
    FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_offers"
    ADD CONSTRAINT "ride_offers_rider_user_id_fkey"
    FOREIGN KEY ("rider_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_offers"
    ADD CONSTRAINT "ride_offers_driver_user_id_fkey"
    FOREIGN KEY ("driver_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
