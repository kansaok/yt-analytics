import { Queue } from "bullmq";
import { bullConnection } from "@/lib/redis";
import { ApiError } from "@/lib/api/errors";

export const Q_INITIAL = "sync-initial";
export const Q_INCREMENTAL = "sync-incremental";
export type SyncJobData = { channelId: string; reason: "initial" | "scheduled" | "manual" };

const g = globalThis as unknown as { queues?: Record<string, Queue<SyncJobData>> };

export function queue(name: typeof Q_INITIAL | typeof Q_INCREMENTAL) {
  g.queues ??= {};
  g.queues[name] ??= new Queue<SyncJobData>(name, {
    connection: bullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "custom" },
      removeOnComplete: { count: 500, age: 86400 },
      removeOnFail: false, // gagal permanen = dead-letter untuk investigasi
    },
  });
  return g.queues[name]!;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function enqueueInitialSync(channelId: string) {
  try {
    return await queue(Q_INITIAL).add("sync", { channelId, reason: "initial" }, { jobId: `initial-${channelId}`, priority: 1 });
  } catch {
    throw new ApiError("SYNC_WORKER_UNAVAILABLE", "Antrean sinkronisasi tidak tersedia. Coba lagi sebentar.");
  }
}

export async function enqueueManualSync(channelId: string) {
  try {
    return await queue(Q_INCREMENTAL).add(
      "sync",
      { channelId, reason: "manual" },
      { jobId: `manual-${channelId}-${Date.now()}`, priority: 1 },
    );
  } catch {
    throw new ApiError("SYNC_WORKER_UNAVAILABLE", "Antrean sinkronisasi tidak tersedia. Coba lagi sebentar.");
  }
}

/** Dedup per channel per jadwal: jobId memuat tanggal + slot 4 jam. */
export async function enqueueScheduledSync(channelId: string, now = new Date()) {
  const slot = Math.floor(now.getUTCHours() / 4);
  return queue(Q_INCREMENTAL).add(
    "sync",
    { channelId, reason: "scheduled" },
    { jobId: `sched-${channelId}-${today()}-${slot}`, priority: 5 },
  );
}

export async function removeChannelJobs(channelId: string) {
  for (const name of [Q_INITIAL, Q_INCREMENTAL] as const) {
    const q = queue(name);
    const jobs = await q.getJobs(["waiting", "delayed", "prioritized", "paused"]);
    await Promise.all(jobs.filter((j) => j.data.channelId === channelId).map((j) => j.remove().catch(() => undefined)));
  }
}
