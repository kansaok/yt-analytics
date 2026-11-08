import { withApi, json } from "@/lib/api/handler";
import { getWatchHeatmap } from "@/lib/analytics/audience";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { readThrough } from "@/lib/cache/dashboard-cache";
import { dashKey } from "@/lib/cache/keys";
import { prisma } from "@/lib/db/prisma";

type P = { id: string };
export const dynamic = "force-dynamic";
const TTL_DAILY = 24 * 3600;

/** Waktu tonton optimal: rata-rata per hari dalam minggu (YouTube tidak menyediakan data per jam). Cache harian. */
export const GET = withApi<P>(async ({ userId, params }) => {
  await requireChannelOwnership(userId, params.id);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
  const today = new Date().toISOString().slice(0, 10);
  const { value, status } = await readThrough(
    dashKey(params.id, today, today, "watch-heatmap"),
    () => getWatchHeatmap(params.id, u.timezone),
    TTL_DAILY,
  );
  return json(
    { data: value, meta: { cached: status === "HIT", cacheTtlSec: TTL_DAILY } },
    { headers: { "X-Cache": status, "Cache-Control": "private, max-age=300" } },
  );
});
