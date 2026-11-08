import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { audienceWindowFor, delta, eachDate, fmt, PARTIAL_DAYS, toUtcDate, type Period } from "./period";
import { addDays, parseISO } from "date-fns";

/**
 * Audiens & traffic (Fase 2). Hanya agregat: tidak ada data penonton perorangan.
 * Semua persentase dihitung di server dengan satu definisi.
 */

/** Pembulatan 1 desimal dengan metode sisa terbesar agar jumlahnya persis 100,0. */
export function normalizePct(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 1000);
  const floors = raw.map(Math.floor);
  let left = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - floors[i] })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((f) => f / 10);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------- Demografi ----------------

type AgeGender = { ageGroup: string; gender: string; pct: number }[];
type Country = { country: string; views: number; watchMinutes: number }[];
type Device = { device: string; views: number; watchMinutes: number }[];

const AGE_ORDER = ["age13-17", "age18-24", "age25-34", "age35-44", "age45-54", "age55-64", "age65-"];
const GENDER_LABEL: Record<string, string> = { female: "Perempuan", male: "Laki-laki", user_specified: "Lainnya" };
const DEVICE_LABEL: Record<string, string> = {
  MOBILE: "Ponsel",
  DESKTOP: "Komputer",
  TV: "TV",
  TABLET: "Tablet",
  GAME_CONSOLE: "Konsol game",
  AUTOMOTIVE: "Mobil",
  WEARABLE: "Perangkat pakai",
  UNKNOWN_PLATFORM: "Tidak diketahui",
};
const ageLabel = (k: string) => k.replace("age", "").replace(/-$/, "+");
let regionNames: Intl.DisplayNames | null = null;
const countryName = (code: string) => {
  if (code === "ZZ") return "Tidak diketahui";
  try {
    regionNames ??= new Intl.DisplayNames(["id"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

export async function getDemographics(channelId: string, p: Period) {
  const windowDays = audienceWindowFor(p.days);
  const rows = await prisma.channelAudienceStat.findMany({ where: { channelId, windowDays } });
  const by = new Map(rows.map((r) => [r.kind, r]));
  const syncedAt = rows.length ? new Date(Math.max(...rows.map((r) => r.syncedAt.getTime()))).toISOString() : null;
  const ag = ((by.get("AGE_GENDER")?.data as AgeGender | undefined) ?? []).filter((x) => x.pct >= 0);
  const countries = (by.get("COUNTRY")?.data as Country | undefined) ?? [];
  const devices = (by.get("DEVICE")?.data as Device | undefined) ?? [];

  // Total views channel pada jendela yang sama, sebagai penyebut persen negara.
  const to = fmt(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())));
  const wFrom = fmt(addDays(parseISO(to), -(windowDays - 1)));
  const tot = await prisma.channelDailyStat.aggregate({
    where: { channelId, date: { gte: toUtcDate(wFrom), lte: toUtcDate(to) } },
    _sum: { views: true, watchTimeMinutes: true },
  });
  const totalViews = Number(tot._sum.views ?? 0);
  const totalWatch = Number(tot._sum.watchTimeMinutes ?? 0);

  const coverage = round1(ag.reduce((a, x) => a + x.pct, 0));
  const ageGroups = AGE_ORDER.map((k) => {
    const g = (gender: string) => round1(ag.filter((x) => x.ageGroup === k && x.gender === gender).reduce((a, x) => a + x.pct, 0));
    const female = g("female");
    const male = g("male");
    const other = g("user_specified");
    return { key: k, label: ageLabel(k), pct: round1(female + male + other), female, male, other };
  });
  const genderRaw = ["female", "male", "user_specified"].map((k) => ({
    key: k,
    label: GENDER_LABEL[k],
    pct: round1(ag.filter((x) => x.gender === k).reduce((a, x) => a + x.pct, 0)),
  }));
  const devTotal = devices.reduce((a, d) => a + d.views, 0);
  const devPct = normalizePct(devices.map((d) => d.views));

  const hasData = ag.length > 0 || countries.length > 0 || devices.length > 0;
  const topAge = [...ageGroups].sort((a, b) => b.pct - a.pct)[0];
  const tieAge = topAge && ageGroups.filter((a) => a.pct === topAge.pct).length > 1;
  const summary =
    ag.length > 0 && topAge && topAge.pct > 0 && !tieAge
      ? `${topAge.pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% penonton berusia ${topAge.label} tahun.`
      : null;

  return {
    requestedDays: p.days,
    windowDays,
    windowLabel: `${windowDays} hari terakhir`,
    syncedAt,
    hasData,
    coveragePct: ag.length ? coverage : null,
    ageGroups: ag.length ? ageGroups : [],
    gender: ag.length ? genderRaw : [],
    countries: countries.map((c) => ({
      code: c.country,
      name: countryName(c.country),
      views: c.views,
      watchTimeHours: round1(c.watchMinutes / 60),
      viewsPct: totalViews > 0 ? round1((c.views / totalViews) * 100) : null,
      watchPct: totalWatch > 0 ? round1((c.watchMinutes / totalWatch) * 100) : null,
    })),
    devices: devices.map((d, i) => ({
      key: d.device,
      label: DEVICE_LABEL[d.device] ?? d.device,
      views: d.views,
      pct: devPct[i],
    })),
    deviceTotalViews: devTotal,
    summary,
  };
}

// ---------------- Waktu tonton ----------------

const WEEKDAYS = [
  { day: 1, label: "Senin" },
  { day: 2, label: "Selasa" },
  { day: 3, label: "Rabu" },
  { day: 4, label: "Kamis" },
  { day: 5, label: "Jumat" },
  { day: 6, label: "Sabtu" },
  { day: 0, label: "Minggu" },
];

/**
 * YouTube Analytics hanya menyediakan dimensi `day` dan `month` (tidak ada jam), jadi matriks 7x24 tidak dapat
 * dibuat dari data asli. Fallback sesuai prd/03 (Fase 2 #3): rata-rata per hari dalam minggu dari 28 hari terakhir.
 * `matrix` bernilai null sampai ada sumber data per jam.
 */
export async function getWatchHeatmap(channelId: string, timezone: string, now = new Date()) {
  const to = fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  const from = fmt(addDays(parseISO(to), -27));
  const rows = await prisma.channelDailyStat.findMany({
    where: { channelId, date: { gte: toUtcDate(from), lte: toUtcDate(to) } },
  });
  const final = (d: string) => d <= fmt(addDays(parseISO(to), -PARTIAL_DAYS)); // hari belum final tidak ikut rata-rata
  const usable = rows.filter((r) => final(r.date.toISOString().slice(0, 10)));
  const weekdays = WEEKDAYS.map(({ day, label }) => {
    const ds = usable.filter((r) => r.date.getUTCDay() === day);
    const n = ds.length;
    return {
      day,
      label,
      daysObserved: n,
      avgViews: n ? Math.round(ds.reduce((a, r) => a + Number(r.views), 0) / n) : null,
      avgWatchTimeHours: n ? round1(ds.reduce((a, r) => a + Number(r.watchTimeMinutes), 0) / n / 60) : null,
    };
  });
  const best = (key: "avgViews" | "avgWatchTimeHours") => {
    const vals = weekdays.filter((w) => w[key] !== null);
    if (!vals.length) return null;
    const max = Math.max(...vals.map((w) => w[key]!));
    const top = vals.filter((w) => w[key] === max);
    return top.length === 1 ? { day: top[0].day, label: top[0].label } : null; // seri: tidak ada pemenang
  };
  return {
    hourlyAvailable: false as const,
    matrix: null as number[][] | null,
    note: "YouTube tidak menyediakan data per jam, jadi yang ditampilkan adalah rata-rata per hari dalam minggu.",
    timezone,
    window: { from, to, days: eachDate(from, to).length },
    daysWithData: usable.length,
    shortWindow: usable.length < 14,
    weekdays,
    best: { views: best("avgViews"), watchTime: best("avgWatchTimeHours") },
  };
}

// ---------------- Sumber traffic ----------------

export const TRAFFIC_KEYS = ["search", "suggested", "browse", "external", "other"] as const;
const TRAFFIC_LABEL: Record<string, string> = {
  search: "Penelusuran YouTube",
  suggested: "Video yang disarankan",
  browse: "Fitur jelajah",
  external: "Eksternal",
  other: "Lainnya",
};

async function trafficTotals(channelId: string, from: string, to: string) {
  const rows = await prisma.$queryRaw<{ key: string; views: number }[]>(Prisma.sql`
    SELECT t.key, SUM(t.value::numeric)::float8 AS views
    FROM "VideoDailyStats" s, jsonb_each_text(s."trafficSource") AS t
    WHERE s."channelId" = ${channelId}::uuid AND s.date BETWEEN ${from}::date AND ${to}::date
      AND s."trafficSource" IS NOT NULL
    GROUP BY t.key`);
  const m: Record<string, number> = Object.fromEntries(TRAFFIC_KEYS.map((k) => [k, 0]));
  for (const r of rows) m[(TRAFFIC_KEYS as readonly string[]).includes(r.key) ? r.key : "other"] += Number(r.views);
  return m;
}

async function trafficDominance(channelId: string, from: string, to: string, totals: Record<string, number>) {
  const rows = await prisma.$queryRaw<{ key: string; videoId: string; title: string; views: number }[]>(Prisma.sql`
    SELECT t.key, s."videoId"::text AS "videoId", v.title, SUM(t.value::numeric)::float8 AS views
    FROM "VideoDailyStats" s
    JOIN "Videos" v ON v.id = s."videoId", jsonb_each_text(s."trafficSource") AS t
    WHERE s."channelId" = ${channelId}::uuid AND s.date BETWEEN ${from}::date AND ${to}::date
      AND s."trafficSource" IS NOT NULL
    GROUP BY t.key, s."videoId", v.title`);
  return rows.flatMap((row) => {
    const source = (TRAFFIC_KEYS as readonly string[]).includes(row.key) ? row.key : "other";
    const pct = totals[source] ? (Number(row.views) / totals[source]) * 100 : 0;
    return pct > 80 ? [{ source, label: TRAFFIC_LABEL[source], videoId: row.videoId, title: row.title, views: Math.round(Number(row.views)), pct: round1(pct) }] : [];
  });
}

export async function getTrafficSources(channelId: string, p: Period) {
  const [cur, prev, cover, chViews] = await Promise.all([
    trafficTotals(channelId, p.from, p.to),
    trafficTotals(channelId, p.compareFrom, p.compareTo),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "videoId")::int AS n FROM "VideoDailyStats"
      WHERE "channelId" = ${channelId}::uuid AND date BETWEEN ${p.from}::date AND ${p.to}::date AND "trafficSource" IS NOT NULL`),
    prisma.channelDailyStat.aggregate({
      where: { channelId, date: { gte: toUtcDate(p.from), lte: toUtcDate(p.to) } },
      _sum: { views: true },
    }),
  ]);
  const keys = TRAFFIC_KEYS.filter((k) => cur[k] > 0 || prev[k] > 0);
  const total = TRAFFIC_KEYS.reduce((a, k) => a + cur[k], 0);
  const dominantVideos = await trafficDominance(channelId, p.from, p.to, cur);
  const prevTotal = TRAFFIC_KEYS.reduce((a, k) => a + prev[k], 0);
  const shown = keys.filter((k) => cur[k] > 0);
  const pct = normalizePct(shown.map((k) => cur[k]));
  const sources = shown.map((k, i) => ({
    source: k,
    label: TRAFFIC_LABEL[k],
    views: Math.round(cur[k]),
    pct: pct[i],
    previousViews: prevTotal > 0 ? Math.round(prev[k]) : null,
    ...(() => {
      const d = delta(cur[k], prevTotal > 0 ? prev[k] : null);
      return { deltaPct: d.deltaPct };
    })(),
  }));
  const channelViews = Number(chViews._sum.views ?? 0);
  const topShare = sources.length ? Math.max(...sources.map((s) => s.pct)) : 0;
  const tied = sources.length > 1 && sources.filter((s) => s.pct === topShare).length > 1;
  return {
    period: p,
    hasData: total > 0,
    totalViews: Math.round(total),
    pctSum: round1(sources.reduce((a, s) => a + s.pct, 0)),
    videosCovered: cover[0]?.n ?? 0,
    // Berapa persen views channel yang tercakup video yang statistiknya disinkron (50 video terbaru).
    coveragePct: channelViews > 0 ? Math.min(100, round1((total / channelViews) * 100)) : null,
    top: sources.length && !tied ? sources.reduce((a, s) => (s.pct > a.pct ? s : a)).source : null,
    dominantVideos,
    sources,
  };
}
