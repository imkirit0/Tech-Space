-- Exam records: one row per exam batch, with results and certificate dispatch.
CREATE TABLE "ExamRecord" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "exam" TEXT NOT NULL,
    "center" TEXT,
    "vendor" TEXT,
    "conducted" INTEGER NOT NULL DEFAULT 0,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "reassessed" INTEGER NOT NULL DEFAULT 0,
    "urgent" INTEGER NOT NULL DEFAULT 0,
    "normal" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamRecord_date_idx" ON "ExamRecord"("date");
CREATE INDEX "ExamRecord_exam_idx" ON "ExamRecord"("exam");
CREATE INDEX "ExamRecord_userId_idx" ON "ExamRecord"("userId");

ALTER TABLE "ExamRecord" ADD CONSTRAINT "ExamRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
