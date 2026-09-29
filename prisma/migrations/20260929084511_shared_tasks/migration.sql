-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "shared" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "assigneeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Task_shared_status_idx" ON "Task"("shared", "status");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
