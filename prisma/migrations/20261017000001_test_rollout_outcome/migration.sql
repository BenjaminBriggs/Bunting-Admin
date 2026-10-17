-- CreateEnum
CREATE TYPE "public"."TestRolloutOutcome" AS ENUM ('completed', 'abandoned');

-- AlterTable
ALTER TABLE "public"."test_rollouts" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "outcome" "public"."TestRolloutOutcome",
ADD COLUMN     "winner" TEXT;
