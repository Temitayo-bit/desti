-- AlterTable (IF NOT EXISTS avoids failure if the column was added out-of-band)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
