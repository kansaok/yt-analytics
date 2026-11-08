import Redis from "ioredis";
import { env } from "@/lib/env";

const g = globalThis as unknown as { redis?: Redis };

export function redis(): Redis {
  if (!g.redis) {
    g.redis = new Redis(env().REDIS_URL, {
      maxRetriesPerRequest: 1,
      // Antre perintah sampai koneksi siap, tapi batasi waktu agar Redis mati => cepat fallback ke PG.
      enableOfflineQueue: true,
      commandTimeout: 1000,
      connectTimeout: 1500,
    });
    g.redis.on("error", () => {
      /* dicatat oleh pemanggil; fallback ke PG */
    });
  }
  return g.redis;
}

/** Koneksi terpisah untuk BullMQ (butuh maxRetriesPerRequest=null). */
export function bullConnection(): Redis {
  return new Redis(env().REDIS_URL, { maxRetriesPerRequest: null });
}
