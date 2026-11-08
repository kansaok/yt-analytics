import { redis } from "@/lib/redis";
import { channelPattern } from "./keys";

export type CacheStatus = "HIT" | "MISS" | "BYPASS";
export const DASH_TTL_SEC = 3600;
/** Selama sync berjalan data masih bertambah: cache pendek agar tidak menahan hasil kosong/parsial. */
export const ttlForStatus = (status: string) => (status === "SYNCING" ? 10 : DASH_TTL_SEC);

/** Read-through cache: Redis dulu, kalau miss baca loader (PG) lalu tulis. Redis mati => bypass. */
export async function readThrough<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSec = DASH_TTL_SEC,
): Promise<{ value: T; status: CacheStatus }> {
  const r = redis();
  let hit: string | null = null;
  let redisOk = true;
  try {
    hit = await r.get(key);
  } catch {
    redisOk = false;
  }
  if (hit) return { value: JSON.parse(hit) as T, status: "HIT" };
  const value = await loader();
  if (redisOk) {
    try {
      await r.set(key, JSON.stringify(value), "EX", ttlSec);
    } catch {
      redisOk = false;
    }
  }
  return { value, status: redisOk ? "MISS" : "BYPASS" };
}

export async function invalidateChannel(channelId: string): Promise<number> {
  const r = redis();
  let cursor = "0";
  let removed = 0;
  do {
    const [next, keys] = await r.scan(cursor, "MATCH", channelPattern(channelId), "COUNT", 200);
    cursor = next;
    if (keys.length) removed += await r.del(...keys);
  } while (cursor !== "0");
  return removed;
}
