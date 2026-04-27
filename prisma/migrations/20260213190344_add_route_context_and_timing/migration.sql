-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "dropoff_instructions" TEXT,
ADD COLUMN     "pickup_instructions" TEXT,
ADD COLUMN     "preferred_depart_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trip_requests" ADD COLUMN     "dropoff_instructions" TEXT,
ADD COLUMN     "pickup_instructions" TEXT,
ADD COLUMN     "preferred_depart_at" TIMESTAMP(3);
