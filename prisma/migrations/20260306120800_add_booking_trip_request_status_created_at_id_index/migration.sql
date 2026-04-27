-- CreateIndex
CREATE INDEX "bookings_trip_request_id_status_created_at_id_idx" ON "bookings"("trip_request_id", "status", "created_at", "id");
