import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { addDays, parseISO } from "date-fns";
import { fmt, presetPeriod, todayUtc } from "@/lib/analytics/period";
import { normalizePct } from "@/lib/analytics/audience";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/redis";
import { makeChannel, makeToken, makeUser, resetDb, seedChannelDays, seedVideo } from "./helpers";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth/session", () => ({ getSessionUserId: async () => session.userId }));

import * as demoRoute from "@/app/api/channels/[id]/audience-demographics/route";
import * as heatRoute from "@/app/api/channels/[id]/watch-heatmap/route";
import * as trafficRoute from "@/app/api/channels/[id]/traffic-sources/route";

const TODAY = todayUtc();
const d = (n: number) => fmt(addDays(parseISO(TODAY), -n));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx: { params: any }) => Promise<Response>;
async function call(h: Handler, path: string, id: string) {
  const res = await h(new NextRequest(new URL(path, "http://localhost:3100")), { params: { id } });
  return { status: res.status, headers: res.headers, body: await res.json() };
}

let A: { id: string };
let B: { id: string };
let ch: { id: string };
let empty: { id: string };
let flat: { id: string };

beforeAll(async () => {
  await resetDb();
  A = await makeUser("a@test.id");
  B = await makeUser("b@test.id");
  const t = await makeToken(A.id, "sub-a");
  ch = await makeChannel(A.id, "UCaaaaaaaaaaaaaaaaaaaaa1", t.id);
  empty = await makeChannel(A.id, "UCaaaaaaaaaaaaaaaaaaaaa2", t.id);
  flat = await makeChannel(A.id, "UCaaaaaaaaaaaaaaaaaaaaa3", t.id);
  await seedChannelDays(ch.id, TODAY, 40);
  // channel "flat": semua hari sama => tidak ada hari terbaik
  await prisma.channelDailyStat.createMany({
    data: Array.from({ length: 28 }, (_, i) => ({
      channelId: flat.id,
      date: new Date(`${d(i)}T00:00:00Z`),
      views: 500n,
      watchTimeMinutes: 600n,
    })),
  });
  const at = new Date();
  const put = (kind: string, windowDays: number, data: object[]) =>
    prisma.channelAudienceStat.create({ data: { channelId: ch.id, kind, windowDays, data, syncedAt: at } });
  await put("AGE_GENDER", 28, [
    { ageGroup: "age18-24", gender: "male", pct: 30 },
    { ageGroup: "age18-24", gender: "female", pct: 32 },
    { ageGroup: "age25-34", gender: "male", pct: 20 },
    { ageGroup: "age25-34", gender: "female", pct: 17 },
    { ageGroup: "age35-44", gender: "user_specified", pct: 1 },
  ]);
  await put("COUNTRY", 28, [
    { country: "ID", views: 9000, watchMinutes: 36000 },
    { country: "US", views: 1000, watchMinutes: 3000 },
  ]);
  await put("DEVICE", 28, [
    { device: "MOBILE", views: 7000, watchMinutes: 1 },
    { device: "DESKTOP", views: 2000, watchMinutes: 1 },
    { device: "TV", views: 1000, watchMinutes: 1 },
  ]);
  // traffic per video
  await seedVideo(ch.id, "vidTRAF0001", "Traffic A", [
    { date: d(5), views: 1000, traffic: { search: 300, suggested: 500, browse: 100, external: 50, other: 50 } },
  ]);
  await seedVideo(ch.id, "vidTRAF0002", "Traffic B", [
    { date: d(5), views: 250, traffic: { search: 100, suggested: 100, weird_key: 50 } },
    { date: d(35), views: 100, traffic: { search: 100 } }, // periode pembanding (28 hari sebelumnya)
  ]);
});

describe("normalizePct", () => {
  it("selalu berjumlah persis 100,0 setelah pembulatan", () => {
    const r = normalizePct([1, 1, 1]);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
    expect(r).toEqual([33.4, 33.3, 33.3]);
    expect(normalizePct([0, 0])).toEqual([0, 0]);
    for (let n = 2; n < 9; n++) {
      const v = Array.from({ length: n }, (_, i) => (i + 1) * 7.3);
      expect(normalizePct(v).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
    }
  });
});

describe("GET /api/channels/:id/audience-demographics", () => {
  it("persentase usia, gender, lokasi, perangkat dari PostgreSQL; cache Redis 24 jam", async () => {
    session.userId = A.id;
    const p = presetPeriod(28);
    const url = `/x?from=${p.from}&to=${p.to}`;
    const r = await call(demoRoute.GET as Handler, url, ch.id);
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(s).toMatchObject({ windowDays: 28, hasData: true, coveragePct: 100 });
    expect(s.ageGroups.map((a: { label: string }) => a.label)).toEqual(["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]);
    expect(s.ageGroups.find((a: { key: string }) => a.key === "age18-24")).toMatchObject({ pct: 62, male: 30, female: 32 });
    expect(s.ageGroups.reduce((a: number, x: { pct: number }) => a + x.pct, 0)).toBeCloseTo(100, 5);
    expect(s.gender.map((g: { key: string; pct: number }) => [g.key, g.pct])).toEqual([["female", 49], ["male", 50], ["user_specified", 1]]);
    expect(s.summary).toBe("62% penonton berusia 18-24 tahun.");
    expect(s.countries[0]).toMatchObject({ code: "ID", name: "Indonesia", views: 9000, watchTimeHours: 600 });
    expect(s.devices.map((x: { label: string; pct: number }) => [x.label, x.pct])).toEqual([["Ponsel", 70], ["Komputer", 20], ["TV", 10]]);
    expect(s.devices.reduce((a: number, x: { pct: number }) => a + x.pct, 0)).toBe(100);

    const again = await call(demoRoute.GET as Handler, url, ch.id);
    expect(again.headers.get("X-Cache")).toBe("HIT");
    // Regresi: rentang lain pada jendela yang sama kena cache tetapi requestedDays harus mengikuti permintaan.
    const p7 = presetPeriod(7);
    const seven = await call(demoRoute.GET as Handler, `/x?from=${p7.from}&to=${p7.to}`, ch.id);
    expect(seven.headers.get("X-Cache")).toBe("HIT");
    expect(seven.body.data).toMatchObject({ requestedDays: 7, windowDays: 28 });
    const ttl = await redis().ttl(`dash:${ch.id}:w:28:audience-demographics`);
    expect(ttl).toBeGreaterThan(23 * 3600);
    expect(ttl).toBeLessThanOrEqual(24 * 3600);
  });
  it("rentang >45 hari memakai jendela 90 hari; tanpa data (ambang privasi) => hasData=false, bukan error", async () => {
    session.userId = A.id;
    const p = presetPeriod(90);
    const r = await call(demoRoute.GET as Handler, `/x?from=${p.from}&to=${p.to}`, ch.id);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ windowDays: 90, hasData: false, ageGroups: [], countries: [], devices: [], coveragePct: null });
    const e = await call(demoRoute.GET as Handler, `/x`, empty.id);
    expect(e.body.data.hasData).toBe(false);
  });
  it("user lain => 403", async () => {
    session.userId = B.id;
    expect((await call(demoRoute.GET as Handler, `/x`, ch.id)).status).toBe(403);
  });
});

describe("GET /api/channels/:id/watch-heatmap", () => {
  it("rata-rata per hari dalam minggu (tanpa data per jam), 3 hari terakhir tidak ikut, hari terbaik benar", async () => {
    session.userId = A.id;
    const r = await call(heatRoute.GET as Handler, `/x`, ch.id);
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(s.hourlyAvailable).toBe(false);
    expect(s.matrix).toBeNull();
    expect(s.note).toMatch(/per jam/);
    expect(s.weekdays.map((w: { label: string }) => w.label)).toEqual(["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]);
    // verifikasi dari formula seed: hari ke-i lalu => views 100+i, watch 60*(i+1) menit; i=3..27 (final)
    const exp = new Map<number, { v: number; w: number; n: number }>();
    for (let i = 3; i <= 27; i++) {
      const day = new Date(`${d(i)}T00:00:00Z`).getUTCDay(); // bukan parseISO: itu memakai zona waktu lokal
      const e = exp.get(day) ?? { v: 0, w: 0, n: 0 };
      e.v += 100 + i;
      e.w += 60 * (i + 1);
      e.n += 1;
      exp.set(day, e);
    }
    for (const w of s.weekdays) {
      const e = exp.get(w.day)!;
      expect(w.daysObserved).toBe(e.n);
      expect(w.avgViews).toBe(Math.round(e.v / e.n));
      expect(w.avgWatchTimeHours).toBeCloseTo(Math.round((e.w / e.n / 60) * 10) / 10, 5);
    }
    const bestDay = [...exp.entries()].sort((a, b) => b[1].v / b[1].n - a[1].v / a[1].n)[0][0];
    expect(s.best.views.day).toBe(bestDay);
    expect(s.timezone).toBe("Asia/Jakarta");
    const again = await call(heatRoute.GET as Handler, `/x`, ch.id);
    expect(again.headers.get("X-Cache")).toBe("HIT");
  });
  it("nilai seri => tidak ada hari terbaik (tidak menyorot palsu); channel kosong => semua null", async () => {
    session.userId = A.id;
    const f = await call(heatRoute.GET as Handler, `/x`, flat.id);
    expect(f.body.data.best).toEqual({ views: null, watchTime: null });
    const e = await call(heatRoute.GET as Handler, `/x`, empty.id);
    expect(e.body.data.weekdays.every((w: { avgViews: number | null }) => w.avgViews === null)).toBe(true);
    expect(e.body.data.shortWindow).toBe(true);
  });
  it("user lain => 403", async () => {
    session.userId = B.id;
    expect((await call(heatRoute.GET as Handler, `/x`, ch.id)).status).toBe(403);
  });
});

describe("GET /api/channels/:id/traffic-sources", () => {
  it("proporsi 5 sumber berjumlah tepat 100%, kunci tak dikenal masuk 'Lainnya', delta vs periode lalu", async () => {
    session.userId = A.id;
    const p = presetPeriod(28);
    const r = await call(trafficRoute.GET as Handler, `/x?from=${p.from}&to=${p.to}`, ch.id);
    expect(r.status).toBe(200);
    const s = r.body.data;
    // total 1250: search 400, suggested 600, browse 100, external 50, other 50+50
    expect(s.totalViews).toBe(1250);
    const by = Object.fromEntries(s.sources.map((x: { source: string; views: number }) => [x.source, x.views]));
    expect(by).toEqual({ search: 400, suggested: 600, browse: 100, external: 50, other: 100 });
    expect(s.sources.map((x: { source: string }) => x.source)).toEqual(["search", "suggested", "browse", "external", "other"]);
    expect(s.pctSum).toBe(100);
    expect(s.sources.find((x: { source: string }) => x.source === "suggested").pct).toBe(48);
    // periode pembanding hanya punya search=100 => delta search = +300%, lainnya N/A (previous 0)
    expect(s.sources.find((x: { source: string }) => x.source === "search")).toMatchObject({ previousViews: 100, deltaPct: 300 });
    expect(s.sources.find((x: { source: string }) => x.source === "suggested").deltaPct).toBeNull();
    expect(s.videosCovered).toBe(2);
    expect(s.top).toBe("suggested");
    expect(JSON.stringify(s)).not.toMatch(/Infinity|NaN/);
    expect((await call(trafficRoute.GET as Handler, `/x?from=${p.from}&to=${p.to}`, ch.id)).headers.get("X-Cache")).toBe("HIT");
  });
  it("tanpa data => hasData=false; tanggal terbalik => 400; user lain => 403", async () => {
    session.userId = A.id;
    const e = await call(trafficRoute.GET as Handler, `/x`, empty.id);
    expect(e.body.data).toMatchObject({ hasData: false, sources: [], pctSum: 0, top: null });
    expect((await call(trafficRoute.GET as Handler, `/x?from=${d(1)}&to=${d(5)}`, ch.id)).status).toBe(400);
    session.userId = B.id;
    expect((await call(trafficRoute.GET as Handler, `/x`, ch.id)).status).toBe(403);
  });
});
