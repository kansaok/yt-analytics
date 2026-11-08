import { withApi, json } from "@/lib/api/handler";
import { rankingQuerySchema, searchParamsObject } from "@/lib/api/schemas";
import { resolvePeriod } from "@/lib/analytics/period";
import { rankVideos } from "@/lib/analytics/service";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { readThrough, DASH_TTL_SEC, ttlForStatus } from "@/lib/cache/dashboard-cache";
import { dashKey } from "@/lib/cache/keys";

type P = { id: string };
export const dynamic = "force-dynamic";

export const GET = withApi<P>(async ({ req, userId, params }) => {
  const ch = await requireChannelOwnership(userId, params.id);
  const q = rankingQuerySchema.parse(searchParamsObject(req.nextUrl.searchParams));
  const p = resolvePeriod(q);
  // Default: sembunyikan views kecil (<100) untuk CTR/retensi.
  const hideSmall =
    q.hideSmall === undefined ? q.sort === "ctr" || q.sort === "retention" : q.hideSmall === "1" || q.hideSmall === "true";
  const key = dashKey(params.id, p.from, p.to, "ranking", `${q.sort}-${q.order}-${q.limit}-${hideSmall ? 1 : 0}`);
  const { value, status } = await readThrough(
    key,
    () => rankVideos(params.id, p, { by: q.sort, order: q.order, limit: q.limit, hideSmall }),
    ttlForStatus(ch.status),
  );
  return json(
    { data: value, period: p, meta: { cached: status === "HIT", cacheTtlSec: DASH_TTL_SEC } },
    { headers: { "X-Cache": status, "Cache-Control": "private, max-age=300" } },
  );
});
