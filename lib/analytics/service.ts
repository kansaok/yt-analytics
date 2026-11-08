import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { delta, eachDate, isPartialDate, toUtcDate, type Period } from "./period";

/**
 * Analytics Service: hanya membaca PostgreSQL (cache di lapisan route). Tidak pernah memanggil YouTube.
 * Definisi metrik tunggal (prd/03 #9) dipakai tabel, detail, dan ranking:
 *   CTR = klik / impresi, dengan klik = SUM(impresi * ctr/100)
 *   Retensi rata-rata = rata-rata retentionAvgPct berbobot views
 *   Engagement = (like + komentar) / views
 */

type Sums = { views: number; subsNet: number; watchMin: number; revenue: number | null; days: number };

async function channelSums(channelId: string, from: string, to: string): Promise<Sums> {
  const r = await prisma.channelDailyStat.aggregate({
    where: { channelId, date: { gte: toUtcDate(from), lte: toUtcDate(to) } },
    _sum: { views: true, subsNet: true, watchTimeMinutes: true, estimatedRevenue: true },
    _count: { _all: true },
  });
  return {
    views: Number(r._sum.views ?? 0),
    subsNet: r._sum.subsNet ?? 0,
    watchMin: Number(r._sum.watchTimeMinutes ?? 0),
    revenue: r._sum.estimatedRevenue === null ? null : Number(r._sum.estimatedRevenue),
    days: r._count._all,
  };
}

const hours = (min: number) => Math.round((min / 60) * 10) / 10;

export async function getChannelMetrics(channelId: string, p: Period, now = new Date()) {
  const [cur, prev, ch] = await Promise.all([
    channelSums(channelId, p.from, p.to),
    channelSums(channelId, p.compareFrom, p.compareTo),
    prisma.channel.findUniqueOrThrow({ where: { id: channelId }, select: { lastSyncAt: true, historySince: true } }),
  ]);
  return {
    channelId,
    period: p,
    hasData: cur.days > 0,
    currentDays: cur.days,
    previousDays: prev.days,
    // Tidak lengkap bila periode pembanding mulai sebelum awal histori yang disinkron (mis. 90 hari vs 90 hari
    // sebelumnya saat histori hanya 90 hari). Hari bolong dari YouTube tidak membuatnya "tidak lengkap".
    previousComplete:
      prev.days > 0 &&
      (ch.historySince ? p.compareFrom >= ch.historySince.toISOString().slice(0, 10) : prev.days >= p.days),
    includesPartialDays: isPartialDate(p.to, now),
    metrics: {
      views: delta(cur.views, prev.days ? prev.views : null),
      subscribersNet: delta(cur.subsNet, prev.days ? prev.subsNet : null),
      watchTimeHours: delta(hours(cur.watchMin), prev.days ? hours(prev.watchMin) : null),
      estRevenueUSD: { ...delta(cur.revenue, prev.revenue), isEstimate: true as const },
    },
    lastSyncedAt: ch.lastSyncAt?.toISOString() ?? null,
    historySince: ch.historySince ? ch.historySince.toISOString().slice(0, 10) : null,
  };
}

export type SeriesPoint = {
  date: string;
  views: number | null;
  watchTimeHours: number | null;
  subscribersNet: number | null;
  subsGained: number | null;
  subsLost: number | null;
  partial: boolean;
};

async function series(channelId: string, from: string, to: string, now: Date): Promise<SeriesPoint[]> {
  const rows = await prisma.channelDailyStat.findMany({
    where: { channelId, date: { gte: toUtcDate(from), lte: toUtcDate(to) } },
    orderBy: { date: "asc" },
  });
  const byDate = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));
  // Hari tanpa baris => null (gap di grafik), bukan 0.
  return eachDate(from, to).map((date) => {
    const r = byDate.get(date);
    return {
      date,
      views: r ? Number(r.views) : null,
      watchTimeHours: r ? hours(Number(r.watchTimeMinutes)) : null,
      subscribersNet: r ? r.subsNet : null,
      subsGained: r ? r.subsGained : null,
      subsLost: r ? r.subsLost : null,
      partial: isPartialDate(date, now),
    };
  });
}

export async function getChannelTimeseries(channelId: string, p: Period, now = new Date()) {
  const [current, previous] = await Promise.all([
    series(channelId, p.from, p.to, now),
    series(channelId, p.compareFrom, p.compareTo, now),
  ]);
  const sum = (pts: SeriesPoint[], k: "views" | "watchTimeHours" | "subscribersNet") =>
    pts.reduce((a, x) => a + (x[k] ?? 0), 0);
  return {
    channelId,
    period: p,
    // Titik pembanding disejajarkan per indeks hari (hari ke-i periode ini vs hari ke-i periode lalu).
    points: current.map((c, i) => ({
      ...c,
      previousDate: previous[i]?.date ?? null,
      previousViews: previous[i]?.views ?? null,
      previousWatchTimeHours: previous[i]?.watchTimeHours ?? null,
      previousSubscribersNet: previous[i]?.subscribersNet ?? null,
    })),
    totals: {
      views: sum(current, "views"),
      watchTimeHours: Math.round(sum(current, "watchTimeHours") * 10) / 10,
      subscribersNet: sum(current, "subscribersNet"),
    },
  };
}

// ---------------- Video ----------------

export const VIDEO_SORTS = ["views", "watchTime", "ctr", "retention", "likes", "comments", "publishedAt", "engagement"] as const;
export type VideoSort = (typeof VIDEO_SORTS)[number];

const SORT_EXPR: Record<VideoSort, string> = {
  views: "s.views",
  watchTime: "s.watch_minutes",
  ctr: "CASE WHEN s.impressions > 0 THEN s.clicks / s.impressions END",
  retention: "s.ret_weighted / NULLIF(s.ret_views, 0)",
  likes: "s.likes",
  comments: "s.comments",
  publishedAt: 'v."publishedAt"',
  engagement: "(s.likes + s.comments) / NULLIF(s.views, 0)",
};

type Row = {
  id: string;
  youtubeVideoId: string;
  title: string;
  publishedAt: Date;
  durationSeconds: number;
  thumbnailUrl: string | null;
  privacyStatus: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  watch_minutes: number | null;
  impressions: number | null;
  clicks: number | null;
  ret_weighted: number | null;
  ret_views: number | null;
  days: number | null;
};

export type VideoRow = ReturnType<typeof toVideoRow>;

function toVideoRow(r: Row) {
  const has = (r.days ?? 0) > 0;
  const views = has ? r.views ?? 0 : null;
  return {
    id: r.id,
    youtubeVideoId: r.youtubeVideoId,
    title: r.title,
    publishedAt: r.publishedAt.toISOString(),
    durationSec: r.durationSeconds,
    isShort: r.durationSeconds > 0 && r.durationSeconds <= 60,
    thumbnailUrl: r.thumbnailUrl,
    privacyStatus: r.privacyStatus,
    available: r.privacyStatus === "public" || r.privacyStatus === "unlisted",
    hasStats: has,
    views,
    likes: has ? r.likes ?? 0 : null,
    comments: has ? r.comments ?? 0 : null,
    watchTimeHours: has ? hours(r.watch_minutes ?? 0) : null,
    ctrPct: has && (r.impressions ?? 0) > 0 ? Math.round(((r.clicks ?? 0) / r.impressions!) * 1000) / 10 : null,
    avgRetentionPct: has && (r.ret_views ?? 0) > 0 ? Math.round(((r.ret_weighted ?? 0) / r.ret_views!) * 10) / 10 : null,
    engagementPct: has && views ? Math.round((((r.likes ?? 0) + (r.comments ?? 0)) / views) * 1000) / 10 : null,
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

async function videoAggregate(opts: {
  channelId: string;
  p: Period;
  search?: string;
  published?: string;
  sort: VideoSort;
  order: "asc" | "desc";
  limit: number;
  offset: number;
  rankingOnly?: { minViews: number };
}) {
  const { channelId, p } = opts;
  const search = (opts.search ?? "").trim();
  const searchSql = search ? Prisma.sql`AND v.title ILIKE ${`%${escapeLike(search)}%`}` : Prisma.empty;
  // "Lihat video terbit hari itu" dari grafik (journey skenario 2)
  const publishedSql = opts.published ? Prisma.sql`AND (v."publishedAt" AT TIME ZONE 'UTC')::date = ${opts.published}::date` : Prisma.empty;
  const rankSql = opts.rankingOnly
    ? Prisma.sql`AND s.days > 0 AND v."privacyStatus" IN ('public','unlisted') AND s.views >= ${opts.rankingOnly.minViews}`
    : Prisma.empty;
  const metricSql = opts.rankingOnly ? Prisma.sql`AND ${Prisma.raw(SORT_EXPR[opts.sort])} IS NOT NULL` : Prisma.empty;
  // ORDER BY hanya dari whitelist (bukan input mentah). Tie => views tertinggi.
  const orderSql = Prisma.raw(
    `${SORT_EXPR[opts.sort]} ${opts.order === "asc" ? "ASC" : "DESC"} NULLS LAST, s.views DESC NULLS LAST, v."publishedAt" DESC`,
  );
  const base = Prisma.sql`
    FROM "Videos" v
    LEFT JOIN (
      SELECT "videoId",
        SUM(views)::float8 AS views, SUM(likes)::float8 AS likes, SUM(comments)::float8 AS comments,
        SUM("watchTimeMinutes")::float8 AS watch_minutes, SUM(impressions)::float8 AS impressions,
        SUM(impressions * ctr / 100.0)::float8 AS clicks,
        SUM(CASE WHEN "retentionAvgPct" IS NOT NULL THEN "retentionAvgPct" * views END)::float8 AS ret_weighted,
        SUM(CASE WHEN "retentionAvgPct" IS NOT NULL THEN views END)::float8 AS ret_views,
        COUNT(*)::int AS days
      FROM "VideoDailyStats"
      WHERE "channelId" = ${channelId}::uuid AND date BETWEEN ${p.from}::date AND ${p.to}::date
      GROUP BY "videoId"
    ) s ON s."videoId" = v.id
    WHERE v."channelId" = ${channelId}::uuid ${searchSql} ${publishedSql} ${rankSql} ${metricSql}`;
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT v.id, v."youtubeVideoId", v.title, v."publishedAt", v."durationSeconds", v."thumbnailUrl", v."privacyStatus",
        s.views, s.likes, s.comments, s.watch_minutes, s.impressions, s.clicks, s.ret_weighted, s.ret_views, s.days
      ${base} ORDER BY ${orderSql} LIMIT ${opts.limit} OFFSET ${opts.offset}`),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS n ${base}`),
  ]);
  return { rows: rows.map(toVideoRow), total: count[0]?.n ?? 0 };
}

export async function listVideos(
  channelId: string,
  p: Period,
  q: { search?: string; published?: string; sort: VideoSort; order: "asc" | "desc"; page: number; limit: number },
) {
  const { rows, total } = await videoAggregate({
    channelId,
    p,
    search: q.search,
    published: q.published,
    sort: q.sort,
    order: q.order,
    limit: q.limit,
    offset: (q.page - 1) * q.limit,
  });
  return {
    data: rows,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export const RANK_BY = ["views", "ctr", "retention", "engagement"] as const;
export type RankBy = (typeof RANK_BY)[number];

export async function rankVideos(
  channelId: string,
  p: Period,
  q: { by: RankBy; order: "asc" | "desc"; limit: number; hideSmall: boolean },
) {
  const minViews = q.hideSmall ? 100 : 0;
  const { rows, total } = await videoAggregate({
    channelId,
    p,
    sort: q.by,
    order: q.order,
    limit: q.limit,
    offset: 0,
    rankingOnly: { minViews },
  });
  return {
    by: q.by,
    order: q.order,
    limit: q.limit,
    hideSmall: q.hideSmall,
    eligible: total,
    items: rows.map((r, i) => ({ rank: i + 1, ...r })),
  };
}

export type TrafficSource = { source: string; views: number; pct: number };
const TRAFFIC_ORDER = ["search", "suggested", "browse", "external", "other"];

export async function getVideoStats(videoId: string, p: Period, now = new Date()) {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  const rows = await prisma.videoDailyStat.findMany({
    where: { videoId, date: { gte: toUtcDate(p.from), lte: toUtcDate(p.to) } },
    orderBy: { date: "asc" },
  });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const views = sum((r) => Number(r.views));
  const impressions = sum((r) => Number(r.impressions));
  const clicks = sum((r) => (Number(r.impressions) * r.ctr) / 100);
  const retRows = rows.filter((r) => r.retentionAvgPct !== null);
  const retViews = retRows.reduce((a, r) => a + Number(r.views), 0);
  const likes = sum((r) => r.likes);
  const comments = sum((r) => r.comments);
  const watchMin = sum((r) => Number(r.watchTimeMinutes));

  const traffic = new Map<string, number>();
  for (const r of rows) {
    const t = (r.trafficSource ?? {}) as Record<string, number>;
    for (const [k, v] of Object.entries(t)) {
      const key = TRAFFIC_ORDER.includes(k) ? k : "other";
      traffic.set(key, (traffic.get(key) ?? 0) + Number(v));
    }
  }
  const trafficTotal = [...traffic.values()].reduce((a, b) => a + b, 0);
  const trafficSources: TrafficSource[] = TRAFFIC_ORDER.filter((k) => (traffic.get(k) ?? 0) > 0).map((k) => ({
    source: k,
    views: traffic.get(k)!,
    pct: Math.round((traffic.get(k)! / trafficTotal) * 1000) / 10,
  }));

  const ageHours = (now.getTime() - video.publishedAt.getTime()) / 3600_000;
  const byDate = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));
  const pub = video.publishedAt.toISOString().slice(0, 10);
  return {
    videoId: video.id,
    youtubeVideoId: video.youtubeVideoId,
    title: video.title,
    publishedAt: video.publishedAt.toISOString(),
    durationSec: video.durationSeconds,
    thumbnailUrl: video.thumbnailUrl,
    privacyStatus: video.privacyStatus,
    available: video.privacyStatus === "public" || video.privacyStatus === "unlisted",
    lastStatSyncAt: video.lastStatSyncAt?.toISOString() ?? null,
    period: p,
    unstable: ageHours < 48,
    hasStats: rows.length > 0,
    lastStatDate: rows.length ? rows[rows.length - 1].date.toISOString().slice(0, 10) : null,
    views,
    likes,
    comments,
    watchTimeHours: hours(watchMin),
    impressions: impressions || null,
    ctrPct: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : null,
    avgViewDurationSec: views > 0 ? Math.round((watchMin * 60) / views) : null,
    avgRetentionPct:
      retViews > 0 ? Math.round((retRows.reduce((a, r) => a + r.retentionAvgPct! * Number(r.views), 0) / retViews) * 10) / 10 : null,
    engagementPct: views > 0 ? Math.round(((likes + comments) / views) * 1000) / 10 : null,
    trafficSources,
    retentionCurve: ((video.retentionCurve as { ratio: number; watchRatio: number }[] | null) ?? []).map((pt) => ({
      ratio: pt.ratio,
      pct: Math.round(pt.watchRatio * 1000) / 10,
    })),
    // Tren harian dimulai dari tanggal publish bila jatuh di dalam periode.
    daily: (pub > p.to ? [] : eachDate(pub > p.from ? pub : p.from, p.to)).map((date) => {
      const r = byDate.get(date);
      return {
        date,
        views: r ? Number(r.views) : null,
        watchTimeHours: r ? hours(Number(r.watchTimeMinutes)) : null,
        partial: isPartialDate(date, now),
      };
    }),
  };
}
