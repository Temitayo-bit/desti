ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_exactly_one_parent_chk"
CHECK (((CASE WHEN "ride_id" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "trip_request_id" IS NOT NULL THEN 1 ELSE 0 END)) = 1);
