import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { classifyGoogleError, YtBadRequestError } from "./quota";
import { mapChannel, mapVideo, rowsToObjects, trafficBucket } from "./mapper";
import type { AudienceData, ReachRow, TrafficBucket, YouTubeGateway } from "./types";

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw classifyGoogleError(e);
  }
}

/** Gateway nyata: YouTube Data API v3 + YouTube Analytics API v2 (read-only). */
export function realGateway(auth: OAuth2Client): YouTubeGateway {
  const yt = google.youtube({ version: "v3", auth });
  const ya = google.youtubeAnalytics({ version: "v2", auth });

  const report = (params: Record<string, string | number>) =>
    call(() => ya.reports.query(params as never)).then((r) => rowsToObjects(r.data as never));

  return {
    async listMyChannels() {
      const r = await call(() => yt.channels.list({ part: ["snippet", "statistics", "contentDetails"], mine: true }));
      return (r.data.items ?? []).map(mapChannel);
    },
    async getChannel(id) {
      const r = await call(() => yt.channels.list({ part: ["snippet", "statistics", "contentDetails"], id: [id] }));
      const item = r.data.items?.[0];
      return item ? mapChannel(item) : null;
    },
    async listUploadIds(playlistId) {
      const ids: string[] = [];
      let pageToken: string | undefined;
      do {
        const r = await call(() =>
          yt.playlistItems.list({ part: ["contentDetails"], playlistId, maxResults: 50, pageToken }),
        );
        for (const it of r.data.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
        pageToken = r.data.nextPageToken ?? undefined;
      } while (pageToken);
      return ids;
    },
    async getVideos(ids) {
      const out = [];
      for (let i = 0; i < ids.length; i += 50) {
        const r = await call(() =>
          yt.videos.list({ part: ["snippet", "contentDetails", "status"], id: ids.slice(i, i + 50), maxResults: 50 }),
        );
        out.push(...(r.data.items ?? []).map(mapVideo));
      }
      return out;
    },
    async channelDaily(channelId, from, to) {
      const rows = await report({
        ids: `channel==${channelId}`,
        startDate: from,
        endDate: to,
        metrics: "views,subscribersGained,subscribersLost,estimatedMinutesWatched",
        dimensions: "day",
        sort: "day",
      });
      return rows.map((r) => ({
        date: String(r.day),
        views: Number(r.views ?? 0),
        subsGained: Number(r.subscribersGained ?? 0),
        subsLost: Number(r.subscribersLost ?? 0),
        watchTimeMinutes: Number(r.estimatedMinutesWatched ?? 0),
      }));
    },
    async videoDaily(channelId, videoId, from, to) {
      const rows = await report({
        ids: `channel==${channelId}`,
        startDate: from,
        endDate: to,
        metrics: "views,likes,comments,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",
        dimensions: "day",
        filters: `video==${videoId}`,
        sort: "day",
      });
      return rows.map((r) => ({
        date: String(r.day),
        views: Number(r.views ?? 0),
        likes: Number(r.likes ?? 0),
        comments: Number(r.comments ?? 0),
        watchTimeMinutes: Number(r.estimatedMinutesWatched ?? 0),
        avgViewDurationSeconds: Number(r.averageViewDuration ?? 0),
        retentionAvgPct: r.averageViewPercentage === undefined ? null : Math.min(100, Number(r.averageViewPercentage)),
      }));
    },
    async videoReachDaily(channelId, videoId, from, to) {
      try {
        const rows = await report({
          ids: `channel==${channelId}`,
          startDate: from,
          endDate: to,
          metrics: "videoThumbnailImpressions,videoThumbnailImpressionsClickRate",
          dimensions: "day",
          filters: `video==${videoId}`,
          sort: "day",
        });
        const m = new Map<string, ReachRow>();
        for (const r of rows)
          m.set(String(r.day), {
            impressions: Number(r.videoThumbnailImpressions ?? 0),
            // API mengembalikan rasio (0-1) atau persen tergantung versi; normalisasi ke 0-100
            ctr: (() => {
              const v = Number(r.videoThumbnailImpressionsClickRate ?? 0);
              return Math.min(100, v <= 1 ? v * 100 : v);
            })(),
          });
        return m;
      } catch (e) {
        // PRD 5.3: 400 => lewati dimensi tanpa menggagalkan sync. CTR tampil N/A.
        if (e instanceof YtBadRequestError) return null;
        throw e;
      }
    },
    async videoTrafficDaily(channelId, videoId, from, to) {
      const rows = await report({
        ids: `channel==${channelId}`,
        startDate: from,
        endDate: to,
        metrics: "views",
        dimensions: "day,insightTrafficSourceType",
        filters: `video==${videoId}`,
        sort: "day",
      });
      const m = new Map<string, Partial<Record<TrafficBucket, number>>>();
      for (const r of rows) {
        const day = String(r.day);
        const b = trafficBucket(String(r.insightTrafficSourceType));
        const cur = m.get(day) ?? {};
        cur[b] = (cur[b] ?? 0) + Number(r.views ?? 0);
        m.set(day, cur);
      }
      return m;
    },
    async videoRetention(channelId, videoId) {
      const rows = await report({
        ids: `channel==${channelId}`,
        startDate: "2005-02-14",
        endDate: new Date().toISOString().slice(0, 10),
        metrics: "audienceWatchRatio",
        dimensions: "elapsedVideoTimeRatio",
        filters: `video==${videoId}`,
        sort: "elapsedVideoTimeRatio",
      });
      return rows.map((r) => ({ ratio: Number(r.elapsedVideoTimeRatio), watchRatio: Number(r.audienceWatchRatio) }));
    },
    async audience(channelId, from, to) {
      // Setiap dimensi independen: 400 (ambang privasi channel kecil) => kosong, bukan gagal sync.
      const safe = async <T>(fn: () => Promise<T>, empty: T): Promise<T> => {
        try {
          return await fn();
        } catch (e) {
          if (e instanceof YtBadRequestError) return empty;
          throw e;
        }
      };
      const base = { ids: `channel==${channelId}`, startDate: from, endDate: to };
      const ageGender = await safe(
        async () =>
          (await report({ ...base, metrics: "viewerPercentage", dimensions: "ageGroup,gender" })).map((r) => ({
            ageGroup: String(r.ageGroup),
            gender: String(r.gender),
            pct: Number(r.viewerPercentage ?? 0),
          })),
        [] as AudienceData["ageGender"],
      );
      const countries = await safe(
        async () =>
          (
            await report({ ...base, metrics: "views,estimatedMinutesWatched", dimensions: "country", sort: "-views", maxResults: 10 })
          ).map((r) => ({ country: String(r.country), views: Number(r.views ?? 0), watchMinutes: Number(r.estimatedMinutesWatched ?? 0) })),
        [] as AudienceData["countries"],
      );
      const devices = await safe(
        async () =>
          (await report({ ...base, metrics: "views,estimatedMinutesWatched", dimensions: "deviceType", sort: "-views" })).map((r) => ({
            device: String(r.deviceType),
            views: Number(r.views ?? 0),
            watchMinutes: Number(r.estimatedMinutesWatched ?? 0),
          })),
        [] as AudienceData["devices"],
      );
      return { ageGender, countries, devices };
    },
  };
}
