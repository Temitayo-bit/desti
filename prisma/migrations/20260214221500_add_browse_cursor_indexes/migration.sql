-- CreateIndex
CREATE INDEX "rides_earliest_depart_at_id_idx" ON "rides"("earliest_depart_at", "id");

-- CreateIndex
CREATE INDEX "trip_requests_earliest_desired_at_id_idx" ON "trip_requests"("earliest_desired_at", "id");
