import { addDays, parseISO } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/redis";
import { encryptTokenPair } from "@/lib/crypto/tokens";
import { fmt, toUtcDate } from "@/lib/analytics/period";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "VideoDailyStats","Videos","ChannelDailyStats","Channels","OAuthTokens","Users" CASCADE`,
  );
  await redis().flushdb();
}

export async function makeUser(email: string) {
  return prisma.user.create({ data: { email, name: email.split("@")[0] } });
}

export async function makeToken(userId: string, sub: string, opts: { expired?: boolean } = {}) {
  return prisma.oAuthToken.create({
    data: {
      userId,
      googleSubject: sub,
      ...encryptTokenPair("access-old", "refresh-1"),
      scopes: ["openid"],
      expiresAt: new Date(Date.now() + (opts.expired ? -60_000 : 3600_000)),
    },
  });
}

export async function makeChannel(userId: string, ytId: string, tokenId?: string) {
  return prisma.channel.create({
    data: { userId, youtubeChannelId: ytId, title: `Channel ${ytId}`, oauthTokenId: tokenId, lastSyncAt: new Date() },
  });
}

/** Statistik harian deterministik: views = 100 + i, subsNet = i % 5 - 1, watch = 60 * (i+1) menit. */
export async function seedChannelDays(channelId: string, endDate: string, days: number, skip: string[] = []) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const date = fmt(addDays(parseISO(endDate), -i));
    if (skip.includes(date)) continue;
    const gained = (i % 5) + 2;
    const lost = 3;
    rows.push({
      channelId,
      date: toUtcDate(date),
      views: BigInt(100 + i),
      subsGained: gained,
      subsLost: lost,
      subsNet: gained - lost,
      watchTimeMinutes: BigInt(60 * (i + 1)),
    });
  }
  await prisma.channelDailyStat.createMany({ data: rows });
  return rows;
}

export async function seedVideo(
  channelId: string,
  ytId: string,
  title: string,
  daily: { date: string; views: number; likes?: number; comments?: number; impressions?: number; ctr?: number; ret?: number | null; traffic?: Record<string, number> }[],
  extra: { privacyStatus?: string; publishedAt?: Date } = {},
) {
  const v = await prisma.video.create({
    data: {
      channelId,
      youtubeVideoId: ytId,
      title,
      publishedAt: extra.publishedAt ?? new Date("2026-01-01T00:00:00Z"),
      durationSeconds: 600,
      privacyStatus: extra.privacyStatus ?? "public",
      retentionCurve: [
        { ratio: 0, watchRatio: 1 },
        { ratio: 0.5, watchRatio: 0.45 },
        { ratio: 1, watchRatio: 0.2 },
      ],
    },
  });
  await prisma.videoDailyStat.createMany({
    data: daily.map((d) => ({
      videoId: v.id,
      channelId,
      date: toUtcDate(d.date),
      views: BigInt(d.views),
      likes: d.likes ?? 0,
      comments: d.comments ?? 0,
      watchTimeMinutes: BigInt(d.views * 2),
      avgViewDurationSeconds: 120,
      impressions: BigInt(d.impressions ?? 0),
      ctr: d.ctr ?? 0,
      retentionAvgPct: d.ret === undefined ? 40 : d.ret,
      trafficSource: d.traffic ?? { search: Math.round(d.views / 2), suggested: d.views - Math.round(d.views / 2) },
    })),
  });
  return v;
}
