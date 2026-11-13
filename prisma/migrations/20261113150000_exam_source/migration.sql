-- Whether the exam batch came through GEMS or Forms.
ALTER TABLE "ExamRecord" ADD COLUMN "source" TEXT;
