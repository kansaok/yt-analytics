import { withApi, json } from "@/lib/api/handler";
import { searchParamsObject } from "@/lib/api/schemas";
import { rangeQuerySchema, resolvePeriod } from "@/lib/analytics/period";
import { getVideoStats } from "@/lib/analytics/service";
import { requireVideoOwnership } from "@/lib/auth/ownership";
import { readThrough, DASH_TTL_SEC } from "@/lib/cache/dashboard-cache";
import { videoKey } from "@/lib/cache/keys";

type P = { id: string };
export const dynamic = "force-dynamic";

/** Detail video: CTR, deret retensi, traffic source, tren harian. Akses dicek via channel pemilik. */
export const GET = withApi<P>(async ({ req, userId, params }) => {
  const v = await requireVideoOwnership(userId, params.id);
  const q = rangeQuerySchema.parse(searchParamsObject(req.nextUrl.searchParams));
  const p = resolvePeriod(q);
  const { value, status } = await readThrough(videoKey(v.channelId, v.id, p.from, p.to), () => getVideoStats(v.id, p));
  return json(
    { data: { ...value, channelId: v.channelId }, meta: { cached: status === "HIT", cacheTtlSec: DASH_TTL_SEC } },
    { headers: { "X-Cache": status, "Cache-Control": "private, max-age=300" } },
  );
});
