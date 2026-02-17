-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "IdempotencyEntityType" ADD VALUE 'OFFER';

-- AlterTable
ALTER TABLE "idempotency_keys" ADD COLUMN     "offer_id" TEXT;

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "trip_request_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "rider_user_id" TEXT NOT NULL,
    "seats_offered" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offers_rider_user_id_created_at_id_idx" ON "offers"("rider_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "offers_driver_user_id_created_at_id_idx" ON "offers"("driver_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "offers_trip_request_id_status_idx" ON "offers"("trip_request_id", "status");

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_trip_request_id_fkey" FOREIGN KEY ("trip_request_id") REFERENCES "trip_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_rider_user_id_fkey" FOREIGN KEY ("rider_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Partial Index for Accepted Offers
CREATE UNIQUE INDEX "offer_trip_request_accepted_unique" ON "offers"("trip_request_id") WHERE "status" = 'ACCEPTED';
