-- AlterEnum
ALTER TYPE "TripRequestStatus" ADD VALUE 'CLOSED';

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_ride_id_fkey";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "driver_user_id" TEXT,
ADD COLUMN     "price_cents" INTEGER,
ADD COLUMN     "trip_request_id" TEXT,
ALTER COLUMN "ride_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_request_id_fkey" FOREIGN KEY ("trip_request_id") REFERENCES "trip_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
