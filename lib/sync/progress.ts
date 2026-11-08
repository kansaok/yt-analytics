import { redis } from "@/lib/redis";
import { syncProgressKey } from "@/lib/cache/keys";

export type SyncProgress = { step: string; done?: number; total?: number; updatedAt: string };

export async function setProgress(channelId: string, p: Omit<SyncProgress, "updatedAt">) {
  try {
    await redis().set(syncProgressKey(channelId), JSON.stringify({ ...p, updatedAt: new Date().toISOString() }), "EX", 3600);
  } catch {
    /* progres hanya informatif */
  }
}
export async function getProgress(channelId: string): Promise<SyncProgress | null> {
  try {
    const v = await redis().get(syncProgressKey(channelId));
    return v ? (JSON.parse(v) as SyncProgress) : null;
  } catch {
    return null;
  }
}
export async function clearProgress(channelId: string) {
  try {
    await redis().del(syncProgressKey(channelId));
  } catch {
    /* noop */
  }
}
