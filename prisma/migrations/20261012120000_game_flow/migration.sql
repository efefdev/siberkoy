/*
  Warnings:

  - Added the required column `tableNumber` to the `NarratorPIN` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "NarratorPIN_eventId_idx";

-- AlterTable
ALTER TABLE "NarratorPIN" ADD COLUMN     "tableNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "deviceIdHash" TEXT;

-- CreateIndex
CREATE INDEX "NarratorPIN_eventId_tableNumber_idx" ON "NarratorPIN"("eventId", "tableNumber");

-- CreateIndex
CREATE INDEX "Player_eventId_deviceIdHash_idx" ON "Player"("eventId", "deviceIdHash");
