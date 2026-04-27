-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "IdempotencyEntityType" ADD VALUE 'BOOKING';

-- AlterTable
ALTER TABLE "idempotency_keys" ADD COLUMN     "booking_id" TEXT;

-- Update check constraint to include BOOKING
-- ALTER TABLE "idempotency_keys" DROP CONSTRAINT IF EXISTS "chk_idempotency_entity_fk";
-- ALTER TABLE "idempotency_keys" ADD CONSTRAINT "chk_idempotency_entity_fk" CHECK (
--     (entity_type = 'RIDE' AND ride_id IS NOT NULL AND trip_request_id IS NULL AND booking_id IS NULL) OR
--     (entity_type = 'TRIP_REQUEST' AND trip_request_id IS NOT NULL AND ride_id IS NULL AND booking_id IS NULL) OR
--     (entity_type = 'BOOKING' AND booking_id IS NOT NULL AND ride_id IS NULL AND trip_request_id IS NULL)
-- );

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "rider_user_id" TEXT NOT NULL,
    "seats_booked" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_rider_user_id_status_created_at_idx" ON "bookings"("rider_user_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rider_user_id_fkey" FOREIGN KEY ("rider_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "booking_active_unique" ON "bookings"("ride_id", "rider_user_id") WHERE "status" = 'CONFIRMED';
