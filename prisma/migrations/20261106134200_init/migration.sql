-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'SYNCING', 'ERROR', 'REVOKED');

-- CreateTable
CREATE TABLE "Users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'id',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    "defaultChannelId" UUID,
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthTokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'google',
    "googleSubject" VARCHAR(64) NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "OAuthTokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channels" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "oauthTokenId" UUID,
    "youtubeChannelId" VARCHAR(30) NOT NULL,
    "title" TEXT NOT NULL,
    "handle" VARCHAR(100),
    "thumbnailUrl" TEXT,
    "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncError" TEXT,
    "lastSyncAt" TIMESTAMPTZ,
    "historySince" DATE,
    "subscriberCache" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelDailyStats" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "views" BIGINT NOT NULL DEFAULT 0,
    "subsGained" INTEGER NOT NULL DEFAULT 0,
    "subsLost" INTEGER NOT NULL DEFAULT 0,
    "subsNet" INTEGER NOT NULL DEFAULT 0,
    "watchTimeMinutes" BIGINT NOT NULL DEFAULT 0,
    "estimatedRevenue" DECIMAL(12,2),
    "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelDailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Videos" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "youtubeVideoId" VARCHAR(20) NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "thumbnailUrl" TEXT,
    "privacyStatus" VARCHAR(20) NOT NULL DEFAULT 'public',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retentionCurve" JSONB,
    "lastStatSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoDailyStats" (
    "id" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "views" BIGINT NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "watchTimeMinutes" BIGINT NOT NULL DEFAULT 0,
    "avgViewDurationSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retentionAvgPct" DOUBLE PRECISION,
    "trafficSource" JSONB,
    "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoDailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitors" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "youtubeChannelId" VARCHAR(30) NOT NULL,
    "title" TEXT,
    "thumbnailUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSnapshots" (
    "id" UUID NOT NULL,
    "competitorId" UUID NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "subscriberCount" BIGINT NOT NULL DEFAULT 0,
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "topVideos" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSnapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reports" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "scheduleCron" VARCHAR(50),
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileUrl" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "lastRunAt" TIMESTAMPTZ,
    "nextRunAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsights" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "videoId" UUID,
    "type" VARCHAR(30) NOT NULL,
    "inputPeriod" JSONB NOT NULL,
    "resultText" TEXT NOT NULL,
    "resultJson" JSONB,
    "model" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE INDEX "Users_defaultChannelId_idx" ON "Users"("defaultChannelId");

-- CreateIndex
CREATE INDEX "OAuthTokens_userId_idx" ON "OAuthTokens"("userId");

-- CreateIndex
CREATE INDEX "OAuthTokens_expiresAt_idx" ON "OAuthTokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthTokens_userId_provider_googleSubject_key" ON "OAuthTokens"("userId", "provider", "googleSubject");

-- CreateIndex
CREATE INDEX "Channels_userId_idx" ON "Channels"("userId");

-- CreateIndex
CREATE INDEX "Channels_userId_status_idx" ON "Channels"("userId", "status");

-- CreateIndex
CREATE INDEX "Channels_youtubeChannelId_idx" ON "Channels"("youtubeChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Channels_userId_youtubeChannelId_key" ON "Channels"("userId", "youtubeChannelId");

-- CreateIndex
CREATE INDEX "ChannelDailyStats_channelId_date_idx" ON "ChannelDailyStats"("channelId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelDailyStats_channelId_date_key" ON "ChannelDailyStats"("channelId", "date");

-- CreateIndex
CREATE INDEX "Videos_channelId_publishedAt_idx" ON "Videos"("channelId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Videos_channelId_title_idx" ON "Videos"("channelId", "title");

-- CreateIndex
CREATE INDEX "Videos_youtubeVideoId_idx" ON "Videos"("youtubeVideoId");

-- CreateIndex
CREATE UNIQUE INDEX "Videos_channelId_youtubeVideoId_key" ON "Videos"("channelId", "youtubeVideoId");

-- CreateIndex
CREATE INDEX "VideoDailyStats_videoId_date_idx" ON "VideoDailyStats"("videoId", "date" DESC);

-- CreateIndex
CREATE INDEX "VideoDailyStats_channelId_date_idx" ON "VideoDailyStats"("channelId", "date" DESC);

-- CreateIndex
CREATE INDEX "VideoDailyStats_channelId_views_idx" ON "VideoDailyStats"("channelId", "views" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "VideoDailyStats_videoId_date_key" ON "VideoDailyStats"("videoId", "date");

-- CreateIndex
CREATE INDEX "Competitors_userId_channelId_idx" ON "Competitors"("userId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitors_userId_channelId_youtubeChannelId_key" ON "Competitors"("userId", "channelId", "youtubeChannelId");

-- CreateIndex
CREATE INDEX "CompetitorSnapshots_competitorId_snapshotDate_idx" ON "CompetitorSnapshots"("competitorId", "snapshotDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorSnapshots_competitorId_snapshotDate_key" ON "CompetitorSnapshots"("competitorId", "snapshotDate");

-- CreateIndex
CREATE INDEX "Reports_userId_channelId_idx" ON "Reports"("userId", "channelId");

-- CreateIndex
CREATE INDEX "Reports_nextRunAt_idx" ON "Reports"("nextRunAt");

-- CreateIndex
CREATE INDEX "AIInsights_channelId_createdAt_idx" ON "AIInsights"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AIInsights_videoId_createdAt_idx" ON "AIInsights"("videoId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AIInsights_userId_type_idx" ON "AIInsights"("userId", "type");

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_defaultChannelId_fkey" FOREIGN KEY ("defaultChannelId") REFERENCES "Channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthTokens" ADD CONSTRAINT "OAuthTokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channels" ADD CONSTRAINT "Channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channels" ADD CONSTRAINT "Channels_oauthTokenId_fkey" FOREIGN KEY ("oauthTokenId") REFERENCES "OAuthTokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelDailyStats" ADD CONSTRAINT "ChannelDailyStats_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Videos" ADD CONSTRAINT "Videos_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoDailyStats" ADD CONSTRAINT "VideoDailyStats_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoDailyStats" ADD CONSTRAINT "VideoDailyStats_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitors" ADD CONSTRAINT "Competitors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitors" ADD CONSTRAINT "Competitors_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSnapshots" ADD CONSTRAINT "CompetitorSnapshots_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reports" ADD CONSTRAINT "Reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reports" ADD CONSTRAINT "Reports_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsights" ADD CONSTRAINT "AIInsights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsights" ADD CONSTRAINT "AIInsights_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsights" ADD CONSTRAINT "AIInsights_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints dari prd/08-data-model.md (Prisma tidak mendukung CHECK secara deklaratif)
ALTER TABLE "OAuthTokens" ADD CONSTRAINT "OAuthTokens_provider_check" CHECK (provider = 'google');
ALTER TABLE "Channels" ADD CONSTRAINT "Channels_subscriberCache_check" CHECK ("subscriberCache" >= 0);
ALTER TABLE "ChannelDailyStats" ADD CONSTRAINT "ChannelDailyStats_nonneg_check"
  CHECK (views >= 0 AND "subsGained" >= 0 AND "subsLost" >= 0 AND "watchTimeMinutes" >= 0 AND ("estimatedRevenue" IS NULL OR "estimatedRevenue" >= 0));
ALTER TABLE "Videos" ADD CONSTRAINT "Videos_duration_check" CHECK ("durationSeconds" >= 0);
ALTER TABLE "VideoDailyStats" ADD CONSTRAINT "VideoDailyStats_nonneg_check"
  CHECK (views >= 0 AND likes >= 0 AND comments >= 0 AND "watchTimeMinutes" >= 0 AND "avgViewDurationSeconds" >= 0 AND impressions >= 0);
ALTER TABLE "VideoDailyStats" ADD CONSTRAINT "VideoDailyStats_ctr_check" CHECK (ctr >= 0 AND ctr <= 100);
ALTER TABLE "VideoDailyStats" ADD CONSTRAINT "VideoDailyStats_retention_check" CHECK ("retentionAvgPct" IS NULL OR ("retentionAvgPct" >= 0 AND "retentionAvgPct" <= 100));
ALTER TABLE "Reports" ADD CONSTRAINT "Reports_type_check" CHECK (type IN ('EXPORT_ONCE','SCHEDULED'));
ALTER TABLE "Reports" ADD CONSTRAINT "Reports_format_check" CHECK (format IN ('PDF','EXCEL'));
ALTER TABLE "AIInsights" ADD CONSTRAINT "AIInsights_type_check" CHECK (type IN ('SUMMARY','TITLE_SUGGESTION','PREDICTION'));
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Videos_title_trgm_idx" ON "Videos" USING gin (title gin_trgm_ops);
