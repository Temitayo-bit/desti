-- Add a completed lifecycle state for manual booking completion.
ALTER TYPE "BookingStatus" ADD VALUE 'COMPLETED';

-- Record completion timestamp once a booking is manually completed.
ALTER TABLE "bookings"
ADD COLUMN "completed_at" TIMESTAMP(3);

-- Immutable rider -> driver rating for one completed booking.
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "rater_user_id" TEXT NOT NULL,
    "ratee_user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ratings_booking_id_key" ON "ratings"("booking_id");
CREATE INDEX "ratings_ratee_user_id_created_at_id_idx" ON "ratings"("ratee_user_id", "created_at", "id");
CREATE INDEX "ratings_rater_user_id_created_at_id_idx" ON "ratings"("rater_user_id", "created_at", "id");

ALTER TABLE "ratings"
ADD CONSTRAINT "ratings_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ratings"
ADD CONSTRAINT "ratings_rater_user_id_fkey"
FOREIGN KEY ("rater_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ratings"
ADD CONSTRAINT "ratings_ratee_user_id_fkey"
FOREIGN KEY ("ratee_user_id") REFERENCES "users"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ratings"
ADD CONSTRAINT "ratings_score_range_chk"
CHECK ("score" BETWEEN 1 AND 5);

ALTER TABLE "ratings"
ADD CONSTRAINT "ratings_distinct_users_chk"
CHECK ("rater_user_id" <> "ratee_user_id");

ALTER TABLE "ratings"
ADD CONSTRAINT "ratings_comment_length_chk"
CHECK (char_length("comment") <= 500);
