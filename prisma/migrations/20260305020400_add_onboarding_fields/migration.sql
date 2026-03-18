-- CreateEnum
CREATE TYPE "YearAtStetson" AS ENUM ('FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "name" TEXT,
ADD COLUMN "year_at_stetson" "YearAtStetson",
ADD COLUMN "gender" "Gender",
ADD COLUMN "age" INTEGER,
ADD COLUMN "onboarding_complete" BOOLEAN NOT NULL DEFAULT false;
