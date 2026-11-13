-- AlterTable
ALTER TABLE "VoucherEntry" ADD COLUMN "orderId" TEXT,
ADD COLUMN "vendor" TEXT;

-- CreateTable
CREATE TABLE "VoucherOrder" (
    "id" TEXT NOT NULL,
    "voucher" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderedOn" DATE NOT NULL,
    "vendor" TEXT,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoucherOrder_voucher_idx" ON "VoucherOrder"("voucher");

-- CreateIndex
CREATE INDEX "VoucherEntry_orderId_idx" ON "VoucherEntry"("orderId");

-- AddForeignKey
ALTER TABLE "VoucherEntry" ADD CONSTRAINT "VoucherEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VoucherOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherOrder" ADD CONSTRAINT "VoucherOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
