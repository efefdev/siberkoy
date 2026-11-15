-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isPractice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'default';
