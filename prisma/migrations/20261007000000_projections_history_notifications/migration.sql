-- HU-04 / HU-06 / HU-09: notificaciones, rol de cocina, histórico de demanda

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "smsOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "readyAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "notifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" TEXT NOT NULL DEFAULT 'inapp',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemandHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "quantityOrdered" INTEGER NOT NULL DEFAULT 0,
    "quantityAdvance" INTEGER NOT NULL DEFAULT 0,
    "quantityCancelled" INTEGER NOT NULL DEFAULT 0,
    "quantityProduced" INTEGER,
    "quantityWasted" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'orders',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE UNIQUE INDEX "DemandHistory_date_menuItemId_key" ON "DemandHistory"("date", "menuItemId");
CREATE INDEX "DemandHistory_weekday_idx" ON "DemandHistory"("weekday");
CREATE INDEX "DemandHistory_category_date_idx" ON "DemandHistory"("category", "date");
