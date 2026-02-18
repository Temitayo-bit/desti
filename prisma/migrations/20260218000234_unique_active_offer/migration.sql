-- CreateIndex
CREATE UNIQUE INDEX "offer_active_per_driver_request" ON "offers"("trip_request_id", "driver_user_id") WHERE "status" IN ('PENDING', 'ACCEPTED');

-- Update Check Constraint for Idempotency
ALTER TABLE "idempotency_keys" DROP CONSTRAINT IF EXISTS "chk_idempotency_entity_fk";
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "chk_idempotency_entity_fk" CHECK (
    (entity_type = 'RIDE' AND ride_id IS NOT NULL AND trip_request_id IS NULL AND booking_id IS NULL AND offer_id IS NULL) OR
    (entity_type = 'TRIP_REQUEST' AND trip_request_id IS NOT NULL AND ride_id IS NULL AND booking_id IS NULL AND offer_id IS NULL) OR
    (entity_type = 'BOOKING' AND booking_id IS NOT NULL AND ride_id IS NULL AND trip_request_id IS NULL AND offer_id IS NULL) OR
    (entity_type = 'OFFER' AND offer_id IS NOT NULL AND ride_id IS NULL AND trip_request_id IS NULL AND booking_id IS NULL)
);