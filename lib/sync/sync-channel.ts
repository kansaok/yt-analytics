import { addDays, parseISO } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { circuitKey, quotaPauseKey } from "@/lib/cache/keys";
import { invalidateChannel } from "@/lib/cache/dashboard-cache";
import { AUDIENCE_WINDOWS, fmt, todayUtc, toUtcDate } from "@/lib/analytics/period";
import { gatewayForToken, markGrantRevoked } from "@/lib/auth/google-tokens";
import { AuthRevokedError, QuotaExceededError, YtBadRequestError, YtNotFoundError } from "@/lib/youtube/quota";
import type { YouTubeGateway } from "@/lib/youtube/types";
import { clearProgress, setProgress } from "./progress";

export type SyncMode = "initial" | "incremental";
export type SyncResult = { channelDays: number; videos: number; videoDays: number; from: string; to: string };

/** Data 2-3 hari terakhir YouTube masih berubah, jadi sync incremental menarik ulang beberapa hari. */
const REFETCH_DAYS = 3;

export class CircuitOpenError extends Error {
  name = "CircuitOpenError";
}

export async function syncChannel(
  channelId: string,
  mode: SyncMode,
  opts: { gateway?: YouTubeGateway; now?: Date } = {},
): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const e = env();
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, include: { oauthToken: true } });
  if (!channel) throw new YtNotFoundError("Channel sudah dihapus");
  if (channel.status === "REVOKED" || !channel.oauthToken) throw new AuthRevokedError("Channel perlu re-autentikasi");

  try {
    if (await redis().exists(circuitKey(channelId))) throw new CircuitOpenError("Circuit breaker aktif");
  } catch (err) {
    if (err instanceof CircuitOpenError) throw err;
  }

  const to = todayUtc(now);
  const lookbackFrom = fmt(addDays(parseISO(to), -(e.SYNC_LOOKBACK_DAYS - 1)));
  let from = lookbackFrom;
  if (mode === "incremental" && channel.lastSyncAt) {
    const since = fmt(addDays(channel.lastSyncAt, -REFETCH_DAYS));
    from = since > lookbackFrom ? since : lookbackFrom;
  }

  await prisma.channel.update({ where: { id: channelId }, data: { status: "SYNCING" } });
  await setProgress(channelId, { step: "Menghubungi YouTube..." });

  try {
    const gw = opts.gateway ?? (await gatewayForToken(channel.oauthToken));

    // 1. Metadata channel
    const info = await gw.getChannel(channel.youtubeChannelId);
    if (!info) {
      await prisma.channel.update({
        where: { id: channelId },
        data: { status: "ERROR", syncError: "Tidak dapat diakses: channel dihapus atau privat di YouTube." },
      });
      await clearProgress(channelId);
      throw new YtNotFoundError("Channel tidak dapat diakses");
    }
    await prisma.channel.update({
      where: { id: channelId },
      data: { title: info.title, handle: info.handle, thumbnailUrl: info.thumbnailUrl, subscriberCache: info.subscriberCount },
    });

    // 2. Agregat harian channel (idempoten via UNIQUE(channelId,date))
    await setProgress(channelId, { step: "Menghitung statistik harian..." });
    const days = await gw.channelDaily(channel.youtubeChannelId, from, to);
    const syncedAt = new Date();
    await prisma.$transaction(
      days.map((d) =>
        prisma.channelDailyStat.upsert({
          where: { channelId_date: { channelId, date: toUtcDate(d.date) } },
          create: {
            channelId,
            date: toUtcDate(d.date),
            views: BigInt(d.views),
            subsGained: d.subsGained,
            subsLost: d.subsLost,
            subsNet: d.subsGained - d.subsLost,
            watchTimeMinutes: BigInt(Math.round(d.watchTimeMinutes)),
            estimatedRevenue: null, // D3: tanpa scope monetary, revenue selalu null
            syncedAt,
          },
          update: {
            views: BigInt(d.views),
            subsGained: d.subsGained,
            subsLost: d.subsLost,
            subsNet: d.subsGained - d.subsLost,
            watchTimeMinutes: BigInt(Math.round(d.watchTimeMinutes)),
            syncedAt,
          },
        }),
      ),
    );

    // 2b. Agregat audiens (jendela 28 & 90 hari). Hemat kuota: incremental hanya bila > 20 jam sejak terakhir.
    const lastAudience = await prisma.channelAudienceStat.findFirst({ where: { channelId }, orderBy: { syncedAt: "desc" } });
    if (mode === "initial" || !lastAudience || Date.now() - lastAudience.syncedAt.getTime() > 20 * 3600_000) {
      await setProgress(channelId, { step: "Mengambil data audiens..." });
      for (const windowDays of AUDIENCE_WINDOWS) {
        const aud = await gw.audience(channel.youtubeChannelId, fmt(addDays(parseISO(to), -(windowDays - 1))), to);
        const at = new Date();
        const kinds = [
          ["AGE_GENDER", aud.ageGender],
          ["COUNTRY", aud.countries],
          ["DEVICE", aud.devices],
        ] as const;
        for (const [kind, data] of kinds) {
          await prisma.channelAudienceStat.upsert({
            where: { channelId_kind_windowDays: { channelId, kind, windowDays } },
            create: { channelId, kind, windowDays, data: data as object[], syncedAt: at },
            update: { data: data as object[], syncedAt: at },
          });
        }
      }
    }

    // 3. Daftar video
    const ids = info.uploadsPlaylistId ? await gw.listUploadIds(info.uploadsPlaylistId) : [];
    const videos = [];
    for (let i = 0; i < ids.length; i += 50) {
      await setProgress(channelId, { step: "Mengambil video", done: Math.min(i + 50, ids.length), total: ids.length });
      videos.push(...(await gw.getVideos(ids.slice(i, i + 50))));
    }
    for (const v of videos) {
      await prisma.video.upsert({
        where: { channelId_youtubeVideoId: { channelId, youtubeVideoId: v.youtubeVideoId } },
        create: { channelId, ...v, publishedAt: new Date(v.publishedAt) },
        update: { ...v, publishedAt: new Date(v.publishedAt) },
      });
    }
    // video yang tidak lagi dikembalikan YouTube => dihapus; historis tetap disimpan
    const returned = new Set(videos.map((v) => v.youtubeVideoId));
    const stored = await prisma.video.findMany({ where: { channelId }, select: { id: true, youtubeVideoId: true } });
    const gone = stored.filter((s) => !returned.has(s.youtubeVideoId)).map((s) => s.id);
    if (gone.length) await prisma.video.updateMany({ where: { id: { in: gone } }, data: { privacyStatus: "deleted" } });

    // 4. Metrik harian per video untuk N video terbaru (OQ-01 default: 50)
    const targets = await prisma.video.findMany({
      where: { channelId, privacyStatus: { in: ["public", "unlisted"] } },
      orderBy: { publishedAt: "desc" },
      take: e.SYNC_VIDEO_DAILY_LIMIT,
    });
    let videoDays = 0;
    for (const [idx, v] of targets.entries()) {
      await setProgress(channelId, { step: "Statistik per video", done: idx + 1, total: targets.length });
      const pub = fmt(v.publishedAt);
      const vFrom = pub > from ? pub : from;
      if (vFrom > to) continue;
      const daily = await gw.videoDaily(channel.youtubeChannelId, v.youtubeVideoId, vFrom, to);
      const reach = await gw.videoReachDaily(channel.youtubeChannelId, v.youtubeVideoId, vFrom, to);
      let traffic = new Map<string, Record<string, number>>();
      try {
        traffic = (await gw.videoTrafficDaily(channel.youtubeChannelId, v.youtubeVideoId, vFrom, to)) as typeof traffic;
      } catch (err) {
        if (!(err instanceof YtBadRequestError)) throw err;
      }
      const stamp = new Date();
      await prisma.$transaction(
        daily.map((d) => {
          const r = reach?.get(d.date);
          const data = {
            views: BigInt(d.views),
            likes: d.likes,
            comments: d.comments,
            watchTimeMinutes: BigInt(Math.round(d.watchTimeMinutes)),
            avgViewDurationSeconds: d.avgViewDurationSeconds,
            impressions: BigInt(r?.impressions ?? 0),
            ctr: r?.ctr ?? 0,
            retentionAvgPct: d.retentionAvgPct,
            trafficSource: traffic.get(d.date) ?? undefined,
            syncedAt: stamp,
          };
          return prisma.videoDailyStat.upsert({
            where: { videoId_date: { videoId: v.id, date: toUtcDate(d.date) } },
            create: { videoId: v.id, channelId, date: toUtcDate(d.date), ...data },
            update: data,
          });
        }),
      );
      videoDays += daily.length;
      let curve = null;
      try {
        curve = await gw.videoRetention(channel.youtubeChannelId, v.youtubeVideoId);
      } catch (err) {
        if (!(err instanceof YtBadRequestError)) throw err;
      }
      await prisma.video.update({
        where: { id: v.id },
        data: { lastStatSyncAt: stamp, ...(curve && curve.length ? { retentionCurve: curve } : {}) },
      });
    }

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        status: "ACTIVE",
        syncError: null,
        lastSyncAt: new Date(),
        ...(mode === "initial" || !channel.historySince ? { historySince: toUtcDate(lookbackFrom) } : {}),
      },
    });
    await clearProgress(channelId);
    try {
      await invalidateChannel(channelId);
    } catch {
      /* cache akan kedaluwarsa sendiri */
    }
    return { channelDays: days.length, videos: videos.length, videoDays, from, to };
  } catch (rawErr) {
    const err = rawErr;
    // Channel diputus user saat sync berjalan: berhenti bersih, jangan retry.
    if (!(await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } }))) {
      await clearProgress(channelId);
      throw new YtNotFoundError("Channel sudah dihapus saat sinkronisasi berjalan");
    }
    if (err instanceof QuotaExceededError) {
      // Data lama tidak dikosongkan; UI menampilkan banner "Sync tertunda".
      await prisma.channel.update({
        where: { id: channelId },
        data: { status: "ACTIVE", syncError: "Sync tertunda: kuota YouTube API habis. Dicoba lagi otomatis." },
      });
      try {
        await redis().set(quotaPauseKey(), "1", "EX", 300);
      } catch {
        /* noop */
      }
    } else if (err instanceof AuthRevokedError) {
      if (channel.oauthTokenId) await markGrantRevoked(channel.oauthTokenId);
      await prisma.channel.update({
        where: { id: channelId },
        data: { status: "REVOKED", syncError: "Koneksi terputus. Hubungkan ulang." },
      });
    } else if (!(err instanceof YtNotFoundError)) {
      await prisma.channel.update({
        where: { id: channelId },
        data: {
          status: channel.lastSyncAt ? "ACTIVE" : "ERROR",
          syncError: "Sinkronisasi sebagian berhasil. Coba lagi dalam beberapa menit.",
        },
      });
    }
    await clearProgress(channelId);
    throw err;
  }
}
