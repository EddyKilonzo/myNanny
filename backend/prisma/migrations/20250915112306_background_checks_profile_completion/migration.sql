-- CreateEnum
CREATE TYPE "public"."BackgroundStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."Profile" ADD COLUMN     "isComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "backgroundStatus" "public"."BackgroundStatus" NOT NULL DEFAULT 'PENDING';
