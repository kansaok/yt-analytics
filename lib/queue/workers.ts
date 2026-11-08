import { Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import { bullConnection } from "@/lib/redis";
import { prisma } from "@/lib/db/prisma";
import { syncChannel, CircuitOpenError } from "@/lib/sync/sync-channel";
import { AuthRevokedError, backoffDelay, QuotaExceededError, YtNotFoundError } from "@/lib/youtube/quota";
import { redis } from "@/lib/redis";
import { circuitKey } from "@/lib/cache/keys";
import { enqueueScheduledSync, Q_INCREMENTAL, Q_INITIAL, type SyncJobData } from "./queues";
import { purgeExpiredRevokedChannels } from "@/lib/channels/service";

export const Q_SCHEDULER = "sync-scheduler";
/** prd/07 §7: cron 0 *\/4 * * * */
export const INCREMENTAL_CRON = "0 */4 * * *";

const scale = () => Number(process.env.SYNC_BACKOFF_SCALE ?? 1);

async function runJob(job: Job<SyncJobData>) {
  try {
    return await syncChannel(job.data.channelId, job.data.reason === "initial" ? "initial" : "incremental");
  } catch (err) {
    if (err instanceof AuthRevokedError || err instanceof YtNotFoundError) throw new UnrecoverableError(err.message);
    if (err instanceof QuotaExceededError && job.attemptsMade + 1 >= (job.opts.attempts ?? 3)) {
      // circuit breaker per channel 30 menit setelah retry habis
      await redis().set(circuitKey(job.data.channelId), "1", "EX", 1800).catch(() => undefined);
    }
    if (err instanceof CircuitOpenError) throw err;
    throw err;
  }
}

export function startWorkers() {
  const settings = {
    backoffStrategy: (attemptsMade: number, _type?: string, err?: Error) => backoffDelay(attemptsMade, err, scale()),
  };
  const initial = new Worker<SyncJobData>(Q_INITIAL, runJob, { connection: bullConnection(), concurrency: 2, settings });
  const incremental = new Worker<SyncJobData>(Q_INCREMENTAL, runJob, {
    connection: bullConnection(),
    concurrency: 5,
    settings,
  });
  const scheduler = new Worker(
    Q_SCHEDULER,
    async () => {
      const cleanup = await purgeExpiredRevokedChannels();
      const channels = await prisma.channel.findMany({ where: { status: { in: ["ACTIVE", "ERROR"] } }, select: { id: true } });
      for (const c of channels) await enqueueScheduledSync(c.id);
      return { enqueued: channels.length, ...cleanup };
    },
    { connection: bullConnection() },
  );
  for (const w of [initial, incremental, scheduler]) {
    w.on("failed", (job, err) =>
      console.error(JSON.stringify({ queue: w.name, jobId: job?.id, attempts: job?.attemptsMade, error: err.name, msg: err.message })),
    );
    w.on("completed", (job, res) => console.log(JSON.stringify({ queue: w.name, jobId: job.id, result: res })));
  }
  return { initial, incremental, scheduler };
}

export async function registerSchedule() {
  const q = new Queue(Q_SCHEDULER, { connection: bullConnection() });
  await q.upsertJobScheduler("incremental-all", { pattern: INCREMENTAL_CRON }, { name: "fanout" });
  return q;
}
