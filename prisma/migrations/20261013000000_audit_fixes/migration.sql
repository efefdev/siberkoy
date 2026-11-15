-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "registrationOpen" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "transferCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "transferCodeHash" TEXT;

-- AlterTable
ALTER TABLE "RoomAssignment" ADD COLUMN     "eliminatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Player_transferCodeHash_key" ON "Player"("transferCodeHash");
