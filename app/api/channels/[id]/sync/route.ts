import { withApi, json } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { enqueueManualSync } from "@/lib/queue/queues";
import { redis } from "@/lib/redis";
import { manualSyncLockKey, quotaPauseKey } from "@/lib/cache/keys";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

type P = { id: string };

/** Tombol "Sinkron Sekarang": maks 1x per 15 menit per channel. */
export const POST = withApi<P>(
  async ({ userId, params }) => {
    const ch = await requireChannelOwnership(userId, params.id);
    if (ch.status === "REVOKED")
      throw new ApiError("OAUTH_SCOPE_MISSING", "Koneksi YouTube terputus. Hubungkan ulang dulu.");
    if (ch.status === "SYNCING") throw new ApiError("SYNC_IN_PROGRESS", "Sinkronisasi sedang berjalan.");
    const cooldown = env().MANUAL_SYNC_COOLDOWN_SEC;
    const r = redis();
    if (await r.exists(quotaPauseKey()))
      throw new ApiError("YOUTUBE_QUOTA_EXCEEDED", "Kuota YouTube API sedang habis. Data lama tetap tampil.", undefined, 300);
    if (cooldown > 0) {
      const ok = await r.set(manualSyncLockKey(ch.id), "1", "EX", cooldown, "NX");
      if (!ok) {
        const ttl = await r.ttl(manualSyncLockKey(ch.id));
        throw new ApiError(
          "RATE_LIMITED",
          `Sinkron manual dibatasi 1 kali per ${Math.round(cooldown / 60)} menit. Coba lagi dalam ${Math.ceil(ttl / 60)} menit.`,
          undefined,
          ttl,
        );
      }
    }
    await enqueueManualSync(ch.id);
    await prisma.channel.update({ where: { id: ch.id }, data: { status: "SYNCING" } });
    return json({ data: { queued: true } }, { status: 202 });
  },
  { rateLimit: 10 },
);
