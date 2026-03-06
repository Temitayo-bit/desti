-- CreateIndex
CREATE INDEX "bookings_ride_id_status_created_at_id_idx" ON "bookings"("ride_id", "status", "created_at", "id");
