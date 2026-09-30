-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "program" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Registration_date_idx" ON "Registration"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_userId_date_program_key" ON "Registration"("userId", "date", "program");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
