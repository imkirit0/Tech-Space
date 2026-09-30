-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "commentedAt" TIMESTAMP(3),
ADD COLUMN     "commentedBy" TEXT,
ADD COLUMN     "managerComment" TEXT;
