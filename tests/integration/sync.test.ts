import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { addDays, parseISO } from "date-fns";
import { Queue, QueueEvents } from "bullmq";
import { prisma } from "@/lib/db/prisma";
import { redis, bullConnection } from "@/lib/redis";
import { syncChannel } from "@/lib/sync/sync-channel";
import { deleteUserData, purgeExpiredRevokedChannels } from "@/lib/channels/service";
import { decryptTokenPair } from "@/lib/crypto/tokens";
import { fmt, todayUtc } from "@/lib/analytics/period";
import { startWorkers } from "@/lib/queue/workers";
import { Q_INITIAL } from "@/lib/queue/queues";
import { circuitKey } from "@/lib/cache/keys";
import { makeChannel, makeToken, makeUser, resetDb } from "./helpers";

const YT = "UCabcdefghijklmnopqrstuv";
let quota = false;
let refreshCalls = 0;
let audienceCalls = 0;

function analyticsReply(url: URL) {
  if (quota)
    return HttpResponse.json(
      { error: { code: 403, message: "quota", errors: [{ reason: "quotaExceeded" }] } },
      { status: 403 },
    );
  const metrics = url.searchParams.get("metrics")!;
  const dims = url.searchParams.get("dimensions")!;
  const start = url.searchParams.get("startDate")!;
  const end = url.searchParams.get("endDate")!;
  const days: string[] = [];
  for (let d = parseISO(start); fmt(d) <= end; d = addDays(d, 1)) days.push(fmt(d));
  if (dims === "ageGroup,gender") {
    audienceCalls++;
    return HttpResponse.json({
      columnHeaders: [{ name: "ageGroup" }, { name: "gender" }, { name: "viewerPercentage" }],
      rows: [["age18-24", "male", 30], ["age18-24", "female", 20], ["age25-34", "male", 30], ["age25-34", "female", 20]],
    });
  }
  if (dims === "country")
    return HttpResponse.json({
      columnHeaders: [{ name: "country" }, { name: "views" }, { name: "estimatedMinutesWatched" }],
      rows: [["ID", 700, 3000], ["US", 200, 800]],
    });
  if (dims === "deviceType")
    return HttpResponse.json({
      columnHeaders: [{ name: "deviceType" }, { name: "views" }, { name: "estimatedMinutesWatched" }],
      rows: [["MOBILE", 800, 3000], ["DESKTOP", 200, 800]],
    });
  if (dims === "elapsedVideoTimeRatio")
    return HttpResponse.json({
      columnHeaders: [{ name: "elapsedVideoTimeRatio" }, { name: "audienceWatchRatio" }],
      rows: [[0.01, 1], [0.5, 0.5], [1, 0.2]],
    });
  if (metrics.startsWith("videoThumbnailImpressions"))
    return HttpResponse.json({ error: { code: 400, message: "Unknown identifier", errors: [{ reason: "badRequest" }] } }, { status: 400 });
  if (dims === "day,insightTrafficSourceType")
    return HttpResponse.json({
      columnHeaders: [{ name: "day" }, { name: "insightTrafficSourceType" }, { name: "views" }],
      rows: days.flatMap((d) => [[d, "YT_SEARCH", 3], [d, "RELATED_VIDEO", 7]]),
    });
  if (url.searchParams.get("filters"))
    return HttpResponse.json({
      columnHeaders: ["day", ...metrics.split(",")].map((name) => ({ name })),
      rows: days.map((d) => [d, 10, 1, 0, 25, 150, 42.5]),
    });
  return HttpResponse.json({
    columnHeaders: ["day", ...metrics.split(",")].map((name) => ({ name })),
    rows: days.map((d, i) => [d, 1000 + i, 10, 2, 3000]),
  });
}

const server = setupServer(
  http.post("https://oauth2.googleapis.com/token", () => {
    refreshCalls++;
    return HttpResponse.json({ access_token: "access-new", expires_in: 3599, token_type: "Bearer", scope: "x" });
  }),
  http.get("https://youtube.googleapis.com/youtube/v3/channels", () =>
    HttpResponse.json({
      items: [
        {
          id: YT,
          snippet: { title: "Kanal Mock", customUrl: "@mock", thumbnails: { default: { url: "https://yt3.ggpht.com/x" } } },
          statistics: { subscriberCount: "1234" },
          contentDetails: { relatedPlaylists: { uploads: "UUmock" } },
        },
      ],
    }),
  ),
  http.get("https://youtube.googleapis.com/youtube/v3/playlistItems", () =>
    HttpResponse.json({ items: [{ contentDetails: { videoId: "vid00000001" } }, { contentDetails: { videoId: "vid00000002" } }] }),
  ),
  http.get("https://youtube.googleapis.com/youtube/v3/videos", () =>
    HttpResponse.json({
      items: ["vid00000001", "vid00000002"].map((id, i) => ({
        id,
        snippet: { title: `Video ${i}`, publishedAt: new Date(Date.now() - (i + 5) * 86400_000).toISOString() },
        contentDetails: { duration: "PT10M" },
        status: { privacyStatus: "public" },
      })),
    }),
  ),
  http.get("https://youtubeanalytics.googleapis.com/v2/reports", ({ request }) => analyticsReply(new URL(request.url))),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(async () => {
  server.close();
});
beforeEach(async () => {
  await resetDb();
  quota = false;
  refreshCalls = 0;
  audienceCalls = 0;
});
afterEach(() => server.resetHandlers());

describe("sync YouTube -> time-series PostgreSQL", () => {
  it("sync awal 90 hari: refresh token kedaluwarsa, simpan agregat harian, video, retensi", async () => {
    const u = await makeUser("a@test.id");
    const t = await makeToken(u.id, "sub-a", { expired: true });
    const ch = await makeChannel(u.id, YT, t.id);
    await prisma.channel.update({ where: { id: ch.id }, data: { lastSyncAt: null } });

    const res = await syncChannel(ch.id, "initial");
    expect(res.channelDays).toBe(90);

    // token di-refresh, tersimpan terenkripsi (bukan plaintext)
    expect(refreshCalls).toBe(1);
    const tok = await prisma.oAuthToken.findUniqueOrThrow({ where: { id: t.id } });
    expect(tok.accessTokenEnc).not.toContain("access-new");
    expect(decryptTokenPair(tok).accessToken).toBe("access-new");
    expect(tok.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const days = await prisma.channelDailyStat.findMany({ where: { channelId: ch.id }, orderBy: { date: "asc" } });
    expect(days).toHaveLength(90);
    expect(days[0].date.toISOString().slice(0, 10)).toBe(fmt(addDays(parseISO(todayUtc()), -89)));
    expect(days[0]).toMatchObject({ views: 1000n, subsGained: 10, subsLost: 2, subsNet: 8, watchTimeMinutes: 3000n });
    expect(days[0].estimatedRevenue).toBeNull();

    const after = await prisma.channel.findUniqueOrThrow({ where: { id: ch.id } });
    expect(after).toMatchObject({ status: "ACTIVE", syncError: null, title: "Kanal Mock", subscriberCache: 1234 });
    expect(after.lastSyncAt).not.toBeNull();

    const vids = await prisma.video.findMany({ where: { channelId: ch.id } });
    expect(vids).toHaveLength(2);
    expect(vids[0].durationSeconds).toBe(600);
    expect(vids[0].retentionCurve).toHaveLength(3);
    const vstat = await prisma.videoDailyStat.findFirstOrThrow({ where: { videoId: vids[0].id } });
    expect(vstat).toMatchObject({ views: 10n, likes: 1, impressions: 0n, ctr: 0, retentionAvgPct: 42.5 });
    expect(vstat.trafficSource).toEqual({ search: 3, suggested: 7 });

    // audiens: 3 jenis x 2 jendela (28, 90) tersimpan sebagai agregat
    const aud = await prisma.channelAudienceStat.findMany({ where: { channelId: ch.id } });
    expect(aud).toHaveLength(6);
    expect(new Set(aud.map((a) => a.windowDays))).toEqual(new Set([28, 90]));
    const age = aud.find((a) => a.kind === "AGE_GENDER" && a.windowDays === 28)!;
    expect((age.data as { pct: number }[]).reduce((a, x) => a + x.pct, 0)).toBe(100);
    expect(audienceCalls).toBe(2);
  });

  it("sync berkala tidak menduplikasi tanggal", async () => {
    const u = await makeUser("b@test.id");
    const t = await makeToken(u.id, "sub-b");
    const ch = await makeChannel(u.id, YT, t.id);
    await syncChannel(ch.id, "initial");
    await syncChannel(ch.id, "incremental");
    expect(audienceCalls).toBe(2); // tidak ditarik ulang dalam 20 jam (hemat kuota)
    const dup = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int n FROM (SELECT date FROM "ChannelDailyStats" WHERE "channelId" = ${ch.id}::uuid GROUP BY date HAVING COUNT(*) > 1) x`;
    expect(dup[0].n).toBe(0);
    expect(await prisma.channelDailyStat.count({ where: { channelId: ch.id } })).toBe(90);
  });

  it("kuota habis: error QuotaExceeded, data lama tidak dihapus, banner sync tertunda", async () => {
    const u = await makeUser("c@test.id");
    const t = await makeToken(u.id, "sub-c");
    const ch = await makeChannel(u.id, YT, t.id);
    await syncChannel(ch.id, "initial");
    quota = true;
    await expect(syncChannel(ch.id, "incremental")).rejects.toMatchObject({ name: "QuotaExceededError" });
    expect(await prisma.channelDailyStat.count({ where: { channelId: ch.id } })).toBe(90);
    const after = await prisma.channel.findUniqueOrThrow({ where: { id: ch.id } });
    expect(after.syncError).toMatch(/Sync tertunda/);
  });

  it("refresh ditolak (invalid_grant): token dihapus, channel REVOKED", async () => {
    server.use(
      http.post("https://oauth2.googleapis.com/token", () => HttpResponse.json({ error: "invalid_grant" }, { status: 400 })),
    );
    const u = await makeUser("d@test.id");
    const t = await makeToken(u.id, "sub-d", { expired: true });
    const ch = await makeChannel(u.id, YT, t.id);
    await expect(syncChannel(ch.id, "incremental")).rejects.toMatchObject({ name: "AuthRevokedError" });
    expect(await prisma.oAuthToken.count({ where: { id: t.id } })).toBe(0);
    const revoked = await prisma.channel.findUniqueOrThrow({ where: { id: ch.id } });
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revokedAt).not.toBeNull();
  });

  it("menghapus data channel REVOKED setelah tujuh hari", async () => {
    const u = await makeUser("retention@test.id");
    const ch = await makeChannel(u.id, YT);
    await prisma.channel.update({
      where: { id: ch.id },
      data: { status: "REVOKED", revokedAt: new Date("2026-01-01T00:00:00Z") },
    });
    await prisma.channelDailyStat.create({
      data: { channelId: ch.id, date: new Date("2026-01-01T00:00:00Z"), views: 1n, watchTimeMinutes: 1n },
    });
    await expect(purgeExpiredRevokedChannels(new Date("2026-01-08T00:00:01Z"))).resolves.toEqual({ deletedChannels: 1 });
    expect(await prisma.channel.count({ where: { id: ch.id } })).toBe(0);
    expect(await prisma.channelDailyStat.count({ where: { channelId: ch.id } })).toBe(0);
  });

  it("hapus akun menghapus token, channel, dan agregatnya", async () => {
    const u = await makeUser("erase@test.id");
    const t = await makeToken(u.id, "fixture-delete");
    const ch = await makeChannel(u.id, YT, t.id);
    await prisma.channelDailyStat.create({
      data: { channelId: ch.id, date: new Date("2026-01-01T00:00:00Z"), views: 1n, watchTimeMinutes: 1n },
    });
    await expect(deleteUserData(u.id)).resolves.toMatchObject({ deletedUserId: u.id, deletedChannels: 1 });
    await expect(prisma.user.findUnique({ where: { id: u.id } })).resolves.toBeNull();
    expect(await prisma.oAuthToken.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.channelDailyStat.count({ where: { channelId: ch.id } })).toBe(0);
  });

  it("job BullMQ retry dengan backoff saat kuota habis, lalu circuit breaker", async () => {
    process.env.SYNC_BACKOFF_SCALE = "0.0001"; // 5m => ~30ms agar tes cepat
    const u = await makeUser("e@test.id");
    const t = await makeToken(u.id, "sub-e");
    const ch = await makeChannel(u.id, YT, t.id);
    quota = true;
    const ws = startWorkers();
    const q = new Queue(Q_INITIAL, { connection: bullConnection() });
    const events = new QueueEvents(Q_INITIAL, { connection: bullConnection() });
    await events.waitUntilReady();
    const attempts: number[] = [];
    ws.initial.on("failed", (job) => attempts.push(job?.attemptsMade ?? 0));
    const job = await q.add(
      "sync",
      { channelId: ch.id, reason: "initial" },
      { attempts: 3, backoff: { type: "custom" }, jobId: `t-${Date.now()}` },
    );
    await expect(job.waitUntilFinished(events, 20000)).rejects.toThrow();
    const final = await q.getJob(job.id!);
    expect(final?.attemptsMade).toBe(3);
    expect(attempts).toEqual([1, 2, 3]);
    expect(await redis().exists(circuitKey(ch.id))).toBe(1);
    await Promise.all([ws.initial.close(), ws.incremental.close(), ws.scheduler.close(), q.obliterate({ force: true })]);
    await Promise.all([q.close(), events.close()]);
    delete process.env.SYNC_BACKOFF_SCALE;
  });
});
