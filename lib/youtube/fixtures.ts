import { addDays, parseISO } from "date-fns";
import { fmt } from "@/lib/analytics/period";
import type { YouTubeGateway, YtChannel, YtVideo } from "./types";

/**
 * Gateway DATA UJI untuk pengembangan/e2e tanpa kredensial Google.
 * Angka dihasilkan generator deterministik, bukan data YouTube. UI menampilkan banner "Mode data uji".
 * Tidak pernah aktif di produksi (lihat fixturesEnabled()).
 */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export const FIXTURE_CHANNELS: YtChannel[] = [
  { youtubeChannelId: "UCuji000000000000000001", title: "Kanal Uji Masak", handle: "@kanalujimasak", thumbnailUrl: null, subscriberCount: 125400, uploadsPlaylistId: "UUuji01" },
  { youtubeChannelId: "UCuji000000000000000002", title: "Kanal Uji Edukasi", handle: "@kanalujiedukasi", thumbnailUrl: null, subscriberCount: 50200, uploadsPlaylistId: "UUuji02" },
  { youtubeChannelId: "UCuji000000000000000003", title: "Kanal Uji Teknologi", handle: "@kanalujitek", thumbnailUrl: null, subscriberCount: 8300, uploadsPlaylistId: "UUuji03" },
  { youtubeChannelId: "UCuji000000000000000004", title: "Kanal Uji Kosong", handle: "@kanalujikosong", thumbnailUrl: null, subscriberCount: 0, uploadsPlaylistId: "UUuji04" },
];

const TOPICS = ["Resep", "Tutorial", "Ulasan", "Tips", "Vlog", "Eksperimen", "Tanya Jawab", "Panduan"];

function videoCount(playlistId: string) {
  return playlistId === "UUuji04" ? 0 : playlistId === "UUuji03" ? 12 : 64;
}

export function fixtureGateway(now = new Date()): YouTubeGateway {
  const vids = (playlistId: string): YtVideo[] => {
    const rnd = seeded(playlistId);
    return Array.from({ length: videoCount(playlistId) }, (_, i) => {
      const daysAgo = Math.floor(i * 5.5 + rnd() * 3);
      const isShort = rnd() < 0.2;
      return {
        youtubeVideoId: `${playlistId.slice(-2)}v${String(i).padStart(8, "0")}`.slice(0, 11),
        title: `${TOPICS[i % TOPICS.length]} #${videoCount(playlistId) - i}${i === 3 ? " 🍳 spesial" : ""}`,
        publishedAt: addDays(now, -daysAgo).toISOString(),
        durationSeconds: isShort ? 30 + Math.floor(rnd() * 30) : 240 + Math.floor(rnd() * 900),
        thumbnailUrl: null,
        privacyStatus: i === 7 ? "private" : "public",
        tags: [],
      };
    });
  };
  const all = new Map<string, YtVideo>();
  for (const c of FIXTURE_CHANNELS) for (const v of vids(c.uploadsPlaylistId!)) all.set(v.youtubeVideoId, v);
  const days = (from: string, to: string) => {
    const out: string[] = [];
    for (let d = parseISO(from); fmt(d) <= to; d = addDays(d, 1)) out.push(fmt(d));
    return out;
  };
  const scale = (channelId: string) =>
    channelId.endsWith("1") ? 30000 : channelId.endsWith("2") ? 9000 : channelId.endsWith("3") ? 900 : 0;

  return {
    async listMyChannels() {
      return FIXTURE_CHANNELS;
    },
    async getChannel(id) {
      return FIXTURE_CHANNELS.find((c) => c.youtubeChannelId === id) ?? null;
    },
    async listUploadIds(pl) {
      return vids(pl).map((v) => v.youtubeVideoId);
    },
    async getVideos(ids) {
      return ids.map((id) => all.get(id)).filter((v): v is YtVideo => !!v);
    },
    async channelDaily(channelId, from, to) {
      const base = scale(channelId);
      if (!base) return [];
      return days(from, to)
        // satu hari bolong untuk menguji gap grafik
        .filter((d) => !d.endsWith("-13"))
        .map((date) => {
          const r = seeded(channelId + date);
          const wave = 1 + 0.25 * Math.sin(parseISO(date).getTime() / 6.048e8);
          const views = Math.round(base * wave * (0.8 + r() * 0.4));
          const gained = Math.round(views / 220 + r() * 5);
          const lost = Math.round(gained * (0.2 + r() * 0.5));
          return { date, views, subsGained: gained, subsLost: lost, watchTimeMinutes: Math.round(views * (3 + r() * 2)) };
        });
    },
    async videoDaily(channelId, videoId, from, to) {
      const v = all.get(videoId);
      if (!v) return [];
      const pub = v.publishedAt.slice(0, 10);
      const r0 = seeded(videoId);
      const pop = 0.2 + r0() * 3;
      return days(from < pub ? pub : from, to).map((date, i) => {
        const r = seeded(videoId + date);
        const views = Math.round((scale(channelId) / 25) * pop * Math.exp(-i / 20) * (0.7 + r() * 0.6));
        const avd = v.durationSeconds * (0.25 + r0() * 0.35);
        return {
          date,
          views,
          likes: Math.round(views * (0.03 + r() * 0.03)),
          comments: Math.round(views * 0.004 * r()),
          watchTimeMinutes: Math.round((views * avd) / 60),
          avgViewDurationSeconds: avd,
          retentionAvgPct: Math.round((avd / Math.max(1, v.durationSeconds)) * 1000) / 10,
        };
      });
    },
    async videoReachDaily(channelId, videoId, from, to) {
      const daily = await this.videoDaily(channelId, videoId, from, to);
      const r0 = seeded(`ctr${videoId}`);
      const ctr = 2 + r0() * 8;
      return new Map(daily.map((d) => [d.date, { impressions: Math.round((d.views * 100) / ctr), ctr }]));
    },
    async videoTrafficDaily(channelId, videoId, from, to) {
      const daily = await this.videoDaily(channelId, videoId, from, to);
      const r0 = seeded(`tr${videoId}`);
      const w = { suggested: 0.3 + r0() * 0.3, search: 0.1 + r0() * 0.3, browse: 0.1 + r0() * 0.2, external: 0.05, other: 0.03 };
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      return new Map(
        daily.map((d) => [
          d.date,
          Object.fromEntries(Object.entries(w).map(([k, x]) => [k, Math.round((d.views * x) / sum)])),
        ]),
      );
    },
    async videoRetention(_channelId, videoId) {
      const r0 = seeded(`ret${videoId}`);
      const decay = 1.2 + r0() * 1.5;
      return Array.from({ length: 101 }, (_, i) => ({
        ratio: i / 100,
        watchRatio: Math.round(Math.max(0.05, (i === 0 ? 1 : 0.85) * Math.exp((-decay * i) / 100)) * 1000) / 1000,
      }));
    },
    async audience(channelId) {
      if (!scale(channelId)) return { ageGender: [], countries: [], devices: [] }; // channel kosong: ambang privasi
      const r = seeded(`aud${channelId}`);
      const groups = ["age13-17", "age18-24", "age25-34", "age35-44", "age45-54", "age55-64", "age65-"];
      const raw = groups.flatMap((g, i) => {
        const w = Math.exp(-Math.pow(i - 1.8, 2) / 3) * (0.7 + r() * 0.6);
        return [
          { ageGroup: g, gender: "male", w: w * (0.8 + r() * 0.4) },
          { ageGroup: g, gender: "female", w: w * (0.7 + r() * 0.4) },
          { ageGroup: g, gender: "user_specified", w: w * 0.02 },
        ];
      });
      const total = raw.reduce((a, x) => a + x.w, 0);
      const ageGender = raw.map((x) => ({ ageGroup: x.ageGroup, gender: x.gender, pct: Math.round((x.w / total) * 1000) / 10 }));
      const views = scale(channelId) * 28;
      const cs = ["ID", "MY", "US", "SG", "PH", "IN", "AU", "JP", "NL", "DE"];
      const countries = cs.map((country, i) => ({
        country,
        views: Math.round(views * (0.55 * Math.pow(0.55, i)) * (0.9 + r() * 0.2)),
        watchMinutes: Math.round(views * (0.55 * Math.pow(0.55, i)) * 4),
      }));
      const ds: [string, number][] = [["MOBILE", 0.68], ["DESKTOP", 0.2], ["TV", 0.08], ["TABLET", 0.04]];
      const devices = ds.map(([device, w]) => ({ device, views: Math.round(views * w), watchMinutes: Math.round(views * w * 4) }));
      return { ageGender, countries, devices };
    },
  };
}
