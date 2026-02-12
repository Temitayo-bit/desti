-- CreateEnum
CREATE TYPE "DistanceCategory" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "rides" (
    "id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "origin_text" TEXT NOT NULL,
    "destination_text" TEXT NOT NULL,
    "earliest_depart_at" TIMESTAMP(3) NOT NULL,
    "latest_depart_at" TIMESTAMP(3) NOT NULL,
    "distance_category" "DistanceCategory" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "seats_total" INTEGER NOT NULL,
    "seats_available" INTEGER NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_driver_user_id_idempotency_key_key" ON "idempotency_keys"("driver_user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
