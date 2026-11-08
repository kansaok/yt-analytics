import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { addDays, parseISO } from "date-fns";
import { fmt, presetPeriod, todayUtc } from "@/lib/analytics/period";
import { prisma } from "@/lib/db/prisma";
import { makeChannel, makeToken, makeUser, resetDb, seedChannelDays, seedVideo } from "./helpers";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth/session", () => ({ getSessionUserId: async () => session.userId }));

import * as metricsRoute from "@/app/api/channels/[id]/metrics/route";
import * as tsRoute from "@/app/api/channels/[id]/timeseries/route";
import * as videosRoute from "@/app/api/channels/[id]/videos/route";
import * as rankingRoute from "@/app/api/channels/[id]/videos/ranking/route";
import * as statsRoute from "@/app/api/videos/[id]/stats/route";
import * as channelsRoute from "@/app/api/channels/route";
import * as channelRoute from "@/app/api/channels/[id]/route";
import * as selectRoute from "@/app/api/channels/select/route";

const TODAY = todayUtc();
const d = (n: number) => fmt(addDays(parseISO(TODAY), -n));

type Handler = (req: NextRequest, ctx: { params: any }) => Promise<Response>;
async function call(h: Handler, path: string, params: Record<string, string> = {}, init?: RequestInit) {
  const res = await h(new NextRequest(new URL(path, "http://localhost:3100"), init as never), { params });
  return { status: res.status, headers: res.headers, body: await res.json() };
}

let A: { id: string };
let B: { id: string };
let chA: { id: string };
let chA2: { id: string };
let chA3: { id: string };
let chB: { id: string };
const vids: Record<string, { id: string }> = {};

beforeAll(async () => {
  await resetDb();
  A = await makeUser("a@test.id");
  B = await makeUser("b@test.id");
  const tA = await makeToken(A.id, "sub-a");
  chA = await makeChannel(A.id, "UCaaaaaaaaaaaaaaaaaaaaa1", tA.id);
  chA2 = await makeChannel(A.id, "UCaaaaaaaaaaaaaaaaaaaaa2", tA.id);
  chA3 = await makeChannel(A.id, "UCaaaaaaaaaaaaaaaaaaaaa3", tA.id);
  chB = await makeChannel(B.id, "UCbbbbbbbbbbbbbbbbbbbbb1");
  await prisma.user.update({ where: { id: A.id }, data: { defaultChannelId: chA.id } });
  // 180 hari data, kecuali 1 hari bolong (hari ke-10)
  await seedChannelDays(chA.id, TODAY, 180, [d(10)]);
  await seedChannelDays(chA2.id, TODAY, 30);
  const day = (i: number) => d(i);
  // Video dengan nilai yang mudah diverifikasi
  vids.top = await seedVideo(chA.id, "vidTOP00001", "Resep Ayam Krispi", [
    { date: day(1), views: 5000, likes: 400, comments: 100, impressions: 50000, ctr: 8, ret: 60 },
    { date: day(2), views: 3000, likes: 200, comments: 50, impressions: 50000, ctr: 4, ret: 30 },
  ]);
  vids.mid = await seedVideo(chA.id, "vidMID00001", "Tutorial 🍳 spesial", [
    { date: day(1), views: 2000, likes: 50, comments: 10, impressions: 20000, ctr: 5, ret: 45 },
  ]);
  vids.low = await seedVideo(chA.id, "vidLOW00001", "Vlog 100% jujur_ok", [
    { date: day(1), views: 150, likes: 3, comments: 0, impressions: 3000, ctr: 2, ret: 20 },
  ]);
  vids.tiny = await seedVideo(chA.id, "vidTINY0001", "Tips kecil", [
    { date: day(1), views: 50, likes: 10, comments: 5, impressions: 200, ctr: 25, ret: 90 },
  ]);
  vids.priv = await seedVideo(chA.id, "vidPRIV0001", "Video privat", [{ date: day(1), views: 9000 }], { privacyStatus: "private" });
  vids.none = await seedVideo(chA.id, "vidNONE0001", "Tanpa data", []);
  // 60 video tambahan untuk paginasi
  for (let i = 0; i < 60; i++)
    await seedVideo(chA.id, `vidBULK${String(i).padStart(4, "0")}`, `Bulk ${i}`, [{ date: day(3), views: 200 + i }]);
  vids.b = await seedVideo(chB.id, "vidBBBBBBB1", "Milik B", [{ date: day(1), views: 1 }]);
});

describe("isolasi & validasi", () => {
  it("tanpa sesi => 401 UNAUTHENTICATED", async () => {
    session.userId = null;
    const r = await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics`, { id: chA.id });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("UNAUTHENTICATED");
    expect(r.body.error.traceId).toMatch(/^req_/);
  });
  it("akses silang user-channel => 403 di semua endpoint", async () => {
    session.userId = B.id;
    for (const [h, path, id] of [
      [metricsRoute.GET, `/api/channels/${chA.id}/metrics`, chA.id],
      [tsRoute.GET, `/api/channels/${chA.id}/timeseries`, chA.id],
      [videosRoute.GET, `/api/channels/${chA.id}/videos`, chA.id],
      [rankingRoute.GET, `/api/channels/${chA.id}/videos/ranking`, chA.id],
      [statsRoute.GET, `/api/videos/${vids.top.id}/stats`, vids.top.id],
      [channelRoute.DELETE, `/api/channels/${chA.id}`, chA.id],
    ] as [Handler, string, string][]) {
      const r = await call(h, path, { id });
      expect(r.status, path).toBe(403);
      expect(r.body.error.code).toBe("FORBIDDEN");
    }
    expect(await prisma.channel.count({ where: { id: chA.id } })).toBe(1);
  });
  it("channel tidak ada => 404, tanggal terbalik => 400", async () => {
    session.userId = A.id;
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await call(metricsRoute.GET as Handler, `/api/channels/${id}/metrics`, { id })).status).toBe(404);
    const r = await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics?from=${d(1)}&to=${d(5)}`, { id: chA.id });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("metrik + perbandingan periode", () => {
  /** Hitung ulang dari formula seed: hari ke-i (0 = hari ini) views=100+i, subsNet=(i%5)-1, watch=60(i+1) menit. */
  function expected(fromI: number, toI: number, skip: number[] = []) {
    let views = 0, subs = 0, watch = 0;
    for (let i = toI; i <= fromI; i++) {
      if (skip.includes(i)) continue;
      views += 100 + i;
      subs += (i % 5) - 1;
      watch += 60 * (i + 1);
    }
    return { views, subs, hours: Math.round((watch / 60) * 10) / 10 };
  }

  it.each([7, 28, 90])("rentang %i hari: total, periode sebelumnya, delta absolut & persen benar", async (n) => {
    session.userId = A.id;
    const p = presetPeriod(n);
    const r = await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics?from=${p.from}&to=${p.to}`, { id: chA.id });
    expect(r.status).toBe(200);
    const cur = expected(n - 1, 0, [10]);
    const prev = expected(2 * n - 1, n, [10]);
    const m = r.body.data.metrics;
    expect(m.views.value).toBe(cur.views);
    expect(m.views.previous).toBe(prev.views);
    expect(m.views.deltaAbs).toBe(cur.views - prev.views);
    expect(m.views.deltaPct).toBe(Math.round(((cur.views - prev.views) / prev.views) * 1000) / 10);
    expect(m.subscribersNet.value).toBe(cur.subs);
    expect(m.watchTimeHours.value).toBe(cur.hours);
    expect(m.estRevenueUSD).toMatchObject({ value: null, isEstimate: true, deltaPct: null });
    expect(r.body.data.period).toMatchObject({ days: n, compareTo: fmt(addDays(parseISO(p.from), -1)) });
  });

  it("cache: hit kedua tercatat HIT di Redis dan < 500ms", async () => {
    session.userId = A.id;
    const p = presetPeriod(28);
    const url = `/api/channels/${chA.id}/metrics?from=${p.from}&to=${p.to}&x=1`;
    await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics?from=${p.from}&to=${p.to}`, { id: chA.id });
    const t0 = performance.now();
    const r = await call(metricsRoute.GET as Handler, url, { id: chA.id });
    const ms = performance.now() - t0;
    expect(r.headers.get("X-Cache")).toBe("HIT");
    expect(r.body.meta.cached).toBe(true);
    expect(ms).toBeLessThan(500);
  });

  it("pembanding sebagian => previousComplete=false (UI: 'Data pembanding tidak lengkap')", async () => {
    session.userId = A.id;
    const r = await call(metricsRoute.GET as Handler, `/api/channels/${chA2.id}/metrics?from=${d(27)}&to=${d(0)}`, { id: chA2.id });
    expect(r.body.data.previousDays).toBe(2);
    expect(r.body.data.previousComplete).toBe(false);
  });

  it("pembanding tanpa data sama sekali => delta null (N/A), bukan Infinity", async () => {
    session.userId = A.id;
    const r = await call(metricsRoute.GET as Handler, `/api/channels/${chA2.id}/metrics?from=${d(29)}&to=${d(0)}`, { id: chA2.id });
    expect(r.body.data.previousDays).toBe(0);
    expect(r.body.data.metrics.views.deltaPct).toBeNull();
    expect(r.body.data.metrics.views.previous).toBeNull();
    expect(JSON.stringify(r.body)).not.toMatch(/Infinity/);
  });
});

describe("time-series", () => {
  it("terurut kronologis, hari bolong = null (gap), total = metrik, pembanding sejajar", async () => {
    session.userId = A.id;
    for (const n of [7, 28, 90]) {
      const p = presetPeriod(n);
      const q = `?from=${p.from}&to=${p.to}`;
      const ts = await call(tsRoute.GET as Handler, `/api/channels/${chA.id}/timeseries${q}`, { id: chA.id });
      const m = await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics${q}`, { id: chA.id });
      const pts = ts.body.data.points;
      expect(pts).toHaveLength(n);
      expect(pts.map((x: { date: string }) => x.date)).toEqual([...pts.map((x: { date: string }) => x.date)].sort());
      expect(pts[0].date).toBe(p.from);
      expect(ts.body.data.totals.views).toBe(m.body.data.metrics.views.value);
      expect(ts.body.data.totals.subscribersNet).toBe(m.body.data.metrics.subscribersNet.value);
      expect(ts.body.data.totals.watchTimeHours).toBeCloseTo(m.body.data.metrics.watchTimeHours.value, 1);
      expect(pts[0].previousDate).toBe(p.compareFrom);
      expect(pts[n - 1].previousDate).toBe(p.compareTo);
      if (n >= 11) expect(pts.find((x: { date: string }) => x.date === d(10)).views).toBeNull();
    }
  });
});

describe("tabel video", () => {
  it("default sort views desc, paginasi 50, total sesuai, cache HIT", async () => {
    session.userId = A.id;
    const url = `/api/channels/${chA.id}/videos?from=${d(27)}&to=${d(0)}`;
    const r1 = await call(videosRoute.GET as Handler, url, { id: chA.id });
    expect(r1.status).toBe(200);
    expect(r1.body.meta).toEqual({ page: 1, limit: 50, total: 66, totalPages: 2 });
    expect(r1.body.data).toHaveLength(50);
    expect(r1.body.data[0].title).toBe("Video privat"); // tabel menampilkan semua (dengan badge)
    expect(r1.body.data[1]).toMatchObject({ title: "Resep Ayam Krispi", views: 8000, likes: 600, comments: 150, watchTimeHours: 266.7 });
    // CTR berbobot impresi: (50000*8% + 50000*4%) / 100000 = 6%
    expect(r1.body.data[1].ctrPct).toBe(6);
    // Retensi berbobot views: (60*5000 + 30*3000)/8000 = 48.75
    expect(r1.body.data[1].avgRetentionPct).toBe(48.8);
    const page2 = await call(videosRoute.GET as Handler, `${url}&page=2`, { id: chA.id });
    expect(page2.body.data).toHaveLength(16);
    expect(page2.body.data.at(-1)).toMatchObject({ title: "Tanpa data", views: null, hasStats: false });
    const again = await call(videosRoute.GET as Handler, url, { id: chA.id });
    expect(again.headers.get("X-Cache")).toBe("HIT");
  });

  it("sort asc, sort likes, search emoji & karakter khusus", async () => {
    session.userId = A.id;
    const base = `/api/channels/${chA.id}/videos?from=${d(27)}&to=${d(0)}`;
    const asc = await call(videosRoute.GET as Handler, `${base}&sort=views&order=asc`, { id: chA.id });
    expect(asc.body.data[0].title).toBe("Tips kecil");
    const likes = await call(videosRoute.GET as Handler, `${base}&sort=likes&order=desc`, { id: chA.id });
    expect(likes.body.data[0].title).toBe("Resep Ayam Krispi");
    const emoji = await call(videosRoute.GET as Handler, `${base}&search=${encodeURIComponent("🍳")}`, { id: chA.id });
    expect(emoji.body.data.map((v: { title: string }) => v.title)).toEqual(["Tutorial 🍳 spesial"]);
    const pct = await call(videosRoute.GET as Handler, `${base}&search=${encodeURIComponent("100%")}`, { id: chA.id });
    expect(pct.body.meta.total).toBe(1);
    const under = await call(videosRoute.GET as Handler, `${base}&search=_`, { id: chA.id });
    expect(under.body.meta.total).toBe(1);
    const bad = await call(videosRoute.GET as Handler, `${base}&sort=title;DROP`, { id: chA.id });
    expect(bad.status).toBe(400);
  });
});

describe("ranking", () => {
  it("views desc/asc terurut benar, privat & tanpa data dikecualikan", async () => {
    session.userId = A.id;
    const base = `/api/channels/${chA.id}/videos/ranking?from=${d(27)}&to=${d(0)}`;
    const top = await call(rankingRoute.GET as Handler, `${base}&sort=views&order=desc&limit=5`, { id: chA.id });
    const vs = top.body.data.items.map((i: { views: number }) => i.views);
    expect(vs).toEqual([...vs].sort((a, b) => b - a));
    expect(top.body.data.items[0]).toMatchObject({ rank: 1, title: "Resep Ayam Krispi" });
    expect(top.body.data.items.some((i: { title: string }) => i.title === "Video privat")).toBe(false);
    const bottom = await call(rankingRoute.GET as Handler, `${base}&sort=views&order=asc&limit=5`, { id: chA.id });
    const bs = bottom.body.data.items.map((i: { views: number }) => i.views);
    expect(bs).toEqual([...bs].sort((a, b) => a - b));
    expect(bottom.body.data.items[0].title).toBe("Tips kecil");
  });
  it("CTR: views kecil disembunyikan default, bisa dimatikan", async () => {
    session.userId = A.id;
    const base = `/api/channels/${chA.id}/videos/ranking?from=${d(27)}&to=${d(0)}&sort=ctr&order=desc`;
    const hidden = await call(rankingRoute.GET as Handler, base, { id: chA.id });
    expect(hidden.body.data.hideSmall).toBe(true);
    expect(hidden.body.data.items.map((i: { title: string }) => i.title)).toEqual([
      "Resep Ayam Krispi",
      "Tutorial 🍳 spesial",
      "Vlog 100% jujur_ok",
    ]);
    const shown = await call(rankingRoute.GET as Handler, `${base}&hideSmall=0`, { id: chA.id });
    expect(shown.body.data.items[0].title).toBe("Tips kecil");
  });
});

describe("detail video", () => {
  it("CTR, deret retensi, traffic source 100%, cache hit < 500ms", async () => {
    session.userId = A.id;
    const url = `/api/videos/${vids.top.id}/stats?from=${d(27)}&to=${d(0)}`;
    const r = await call(statsRoute.GET as Handler, url, { id: vids.top.id });
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(s).toMatchObject({ views: 8000, impressions: 100000, ctrPct: 6, avgRetentionPct: 48.8, likes: 600, comments: 150 });
    expect(s.retentionCurve).toEqual([
      { ratio: 0, pct: 100 },
      { ratio: 0.5, pct: 45 },
      { ratio: 1, pct: 20 },
    ]);
    expect(s.trafficSources.reduce((a: number, t: { pct: number }) => a + t.pct, 0)).toBeCloseTo(100, 0);
    expect(s.trafficSources.map((t: { source: string }) => t.source)).toEqual(["search", "suggested"]);
    const t0 = performance.now();
    const r2 = await call(statsRoute.GET as Handler, url, { id: vids.top.id });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(r2.headers.get("X-Cache")).toBe("HIT");
  });
});

describe("multi-channel", () => {
  it("user punya >= 3 channel dengan tepat satu aktif; ganti aktif; hapus aktif pindah otomatis", async () => {
    session.userId = A.id;
    const list = await call(channelsRoute.GET as Handler, `/api/channels`);
    expect(list.body.data).toHaveLength(3);
    expect(list.body.data.filter((c: { isActive: boolean }) => c.isActive)).toHaveLength(1);
    expect(list.body.meta.limit).toBe(5);
    JSON.stringify(list.body).match(/Enc|refresh|access-old/) && expect.fail("token bocor ke respons");

    const sel = await call(selectRoute.POST as Handler, `/api/channels/select`, {}, {
      method: "POST",
      body: JSON.stringify({ channelId: chA3.id }),
      headers: { "content-type": "application/json" },
    });
    expect(sel.body.data.activeChannelId).toBe(chA3.id);
    const forbidden = await call(selectRoute.POST as Handler, `/api/channels/select`, {}, {
      method: "POST",
      body: JSON.stringify({ channelId: chB.id }),
      headers: { "content-type": "application/json" },
    });
    expect(forbidden.status).toBe(403);

    const del = await call(channelRoute.DELETE as Handler, `/api/channels/${chA3.id}`, { id: chA3.id }, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect([chA.id, chA2.id]).toContain(del.body.data.activeChannelId);
    expect(await prisma.channel.count({ where: { userId: A.id } })).toBe(2);
  });
});

describe("kelengkapan pembanding berdasar historySince", () => {
  it("hari bolong tidak membuat pembanding 'tidak lengkap'; mulai sebelum histori => tidak lengkap", async () => {
    session.userId = A.id;
    await prisma.channel.update({ where: { id: chA.id }, data: { historySince: new Date(`${d(179)}T00:00:00Z`) } });
    const { redis } = await import("@/lib/redis");
    await redis().flushdb();
    const p28 = presetPeriod(28);
    const ok = await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics?from=${p28.from}&to=${p28.to}`, { id: chA.id });
    expect(ok.body.data.previousComplete).toBe(true);
    const p90 = presetPeriod(90);
    const r = await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics?from=${p90.from}&to=${p90.to}`, { id: chA.id });
    expect(r.body.data.previousComplete).toBe(true); // compareFrom = d(179) = historySince
    await prisma.channel.update({ where: { id: chA.id }, data: { historySince: new Date(`${d(89)}T00:00:00Z`) } });
    await redis().flushdb();
    const r2 = await call(metricsRoute.GET as Handler, `/api/channels/${chA.id}/metrics?from=${p90.from}&to=${p90.to}`, { id: chA.id });
    expect(r2.body.data.previousComplete).toBe(false);
  });
});

describe("rate limit", () => {
  it("bucket baca dan mutasi terpisah: banyak GET tidak memblokir POST connect/select", async () => {
    session.userId = A.id;
    const { redis } = await import("@/lib/redis");
    await redis().flushdb();
    for (let i = 0; i < 15; i++) await call(channelsRoute.GET as Handler, `/api/channels`);
    const sel = await call(selectRoute.POST as Handler, `/api/channels/select`, {}, {
      method: "POST",
      body: JSON.stringify({ channelId: chA.id }),
      headers: { "content-type": "application/json" },
    });
    expect(sel.status).toBe(200);
  });
  it("lebih dari 120 GET/menit => 429 RATE_LIMITED dengan Retry-After", async () => {
    session.userId = A.id;
    const { redis } = await import("@/lib/redis");
    await redis().flushdb();
    let last = { status: 0, headers: new Headers(), body: {} as { error?: { code: string } } };
    for (let i = 0; i < 121; i++) last = await call(channelsRoute.GET as Handler, `/api/channels`);
    expect(last.status).toBe(429);
    expect(last.body.error?.code).toBe("RATE_LIMITED");
    expect(last.headers.get("Retry-After")).toBe("60");
    await redis().flushdb();
  });
});
