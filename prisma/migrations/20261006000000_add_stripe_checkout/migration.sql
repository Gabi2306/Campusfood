-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickupAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "stripeSessionId" TEXT;

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "itemsJson" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "pickupAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "orderId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
CREATE UNIQUE INDEX "PaymentAttempt_stripeSessionId_key" ON "PaymentAttempt"("stripeSessionId");
CREATE INDEX "PaymentAttempt_userId_status_idx" ON "PaymentAttempt"("userId", "status");
