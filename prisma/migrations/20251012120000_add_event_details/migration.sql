-- AlterTable
ALTER TABLE "events" ADD COLUMN     "doorsOpenAt" TIMESTAMP(3),
ADD COLUMN     "eventEndAt" TIMESTAMP(3),
ADD COLUMN     "eventStartAt" TIMESTAMP(3),
ADD COLUMN     "lotteryApplicationDeadline" TIMESTAMP(3),
ADD COLUMN     "lotteryResultAnnouncementAt" TIMESTAMP(3),
ADD COLUMN     "seatCapacity" INTEGER,
ADD COLUMN     "seatLayoutSummary" TEXT,
ADD COLUMN     "venueAddress" TEXT,
ADD COLUMN     "venueName" TEXT;
