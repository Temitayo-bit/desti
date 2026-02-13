-- DropForeignKey
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_ride_id_fkey";

-- DropForeignKey
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_trip_request_id_fkey";

-- AddForeignKey (ON DELETE RESTRICT — prevent deletion of ride/trip_request while idempotency key exists)
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (ON DELETE RESTRICT)
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_trip_request_id_fkey" FOREIGN KEY ("trip_request_id") REFERENCES "trip_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheck (NOT VALID first — avoids scanning existing rows, so migration won't fail on bad data)
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "chk_idempotency_entity_fk" CHECK (
    (entity_type = 'RIDE'         AND ride_id IS NOT NULL AND trip_request_id IS NULL) OR
    (entity_type = 'TRIP_REQUEST' AND trip_request_id IS NOT NULL AND ride_id IS NULL)
) NOT VALID;

-- Cleanup: remove any legacy rows that violate the constraint before validating.
-- Targets: mismatched entity_type↔FK, both FKs set, or neither FK set.
DELETE FROM "idempotency_keys"
WHERE NOT (
    (entity_type = 'RIDE'         AND ride_id IS NOT NULL AND trip_request_id IS NULL) OR
    (entity_type = 'TRIP_REQUEST' AND trip_request_id IS NOT NULL AND ride_id IS NULL)
);

-- ValidateCheck — now that bad rows are gone, fully enforce the constraint for future writes
ALTER TABLE "idempotency_keys" VALIDATE CONSTRAINT "chk_idempotency_entity_fk";
