-- DropIndex
DROP INDEX "Videos_title_trgm_idx";

-- CreateTable
CREATE TABLE "ChannelAudienceStats" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelAudienceStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelAudienceStats_channelId_idx" ON "ChannelAudienceStats"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAudienceStats_channelId_kind_windowDays_key" ON "ChannelAudienceStats"("channelId", "kind", "windowDays");

-- AddForeignKey
ALTER TABLE "ChannelAudienceStats" ADD CONSTRAINT "ChannelAudienceStats_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelAudienceStats" ADD CONSTRAINT "ChannelAudienceStats_kind_check" CHECK (kind IN ('AGE_GENDER','COUNTRY','DEVICE'));
ALTER TABLE "ChannelAudienceStats" ADD CONSTRAINT "ChannelAudienceStats_window_check" CHECK ("windowDays" > 0);
