-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventPin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "allowLess8" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarratorPIN" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarratorPIN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "narratorPinId" TEXT,
    "roomNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "winningSide" TEXT,
    "bonusAwardedAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAssignment" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoomAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roomId" TEXT,
    "kind" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAlert" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roomId" TEXT,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarratorFeedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "narratorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarratorFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventPin_key" ON "Event"("eventPin");

-- CreateIndex
CREATE UNIQUE INDEX "NarratorPIN_pin_key" ON "NarratorPIN"("pin");

-- CreateIndex
CREATE INDEX "NarratorPIN_eventId_idx" ON "NarratorPIN"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sessionTokenHash_key" ON "Player"("sessionTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Player_eventId_usernameKey_key" ON "Player"("eventId", "usernameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Round_eventId_roundNumber_key" ON "Round"("eventId", "roundNumber");

-- CreateIndex
CREATE INDEX "Room_narratorPinId_idx" ON "Room"("narratorPinId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_roundId_roomNumber_key" ON "Room"("roundId", "roomNumber");

-- CreateIndex
CREATE INDEX "RoomAssignment_playerId_idx" ON "RoomAssignment"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomAssignment_roomId_playerId_key" ON "RoomAssignment"("roomId", "playerId");

-- CreateIndex
CREATE INDEX "ScoreEvent_eventId_idx" ON "ScoreEvent"("eventId");

-- CreateIndex
CREATE INDEX "ScoreEvent_playerId_idx" ON "ScoreEvent"("playerId");

-- CreateIndex
CREATE INDEX "ScoreEvent_roomId_idx" ON "ScoreEvent"("roomId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAlert_eventId_isResolved_idx" ON "AdminAlert"("eventId", "isResolved");

-- CreateIndex
CREATE INDEX "NarratorFeedback_eventId_idx" ON "NarratorFeedback"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "NarratorFeedback_playerId_narratorId_key" ON "NarratorFeedback"("playerId", "narratorId");

-- AddForeignKey
ALTER TABLE "NarratorPIN" ADD CONSTRAINT "NarratorPIN_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_narratorPinId_fkey" FOREIGN KEY ("narratorPinId") REFERENCES "NarratorPIN"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAlert" ADD CONSTRAINT "AdminAlert_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAlert" ADD CONSTRAINT "AdminAlert_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarratorFeedback" ADD CONSTRAINT "NarratorFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarratorFeedback" ADD CONSTRAINT "NarratorFeedback_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarratorFeedback" ADD CONSTRAINT "NarratorFeedback_narratorId_fkey" FOREIGN KEY ("narratorId") REFERENCES "NarratorPIN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
