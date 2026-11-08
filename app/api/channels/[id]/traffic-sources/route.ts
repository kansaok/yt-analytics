import { withApi, json } from "@/lib/api/handler";
import { searchParamsObject } from "@/lib/api/schemas";
import { rangeQuerySchema, resolvePeriod } from "@/lib/analytics/period";
import { getTrafficSources } from "@/lib/analytics/audience";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { readThrough, DASH_TTL_SEC, ttlForStatus } from "@/lib/cache/dashboard-cache";
import { dashKey } from "@/lib/cache/keys";

type P = { id: string };
export const dynamic = "force-dynamic";

/** Proporsi views per sumber (search, suggested, browse, eksternal, lainnya), total 100%, plus delta vs periode lalu. */
export const GET = withApi<P>(async ({ req, userId, params }) => {
  const ch = await requireChannelOwnership(userId, params.id);
  const q = rangeQuerySchema.parse(searchParamsObject(req.nextUrl.searchParams));
  const p = resolvePeriod(q);
  const { value, status } = await readThrough(
    dashKey(params.id, p.from, p.to, "traffic-sources"),
    () => getTrafficSources(params.id, p),
    ttlForStatus(ch.status),
  );
  return json(
    { data: value, meta: { cached: status === "HIT", cacheTtlSec: DASH_TTL_SEC } },
    { headers: { "X-Cache": status, "Cache-Control": "private, max-age=300" } },
  );
});
