import { withApi, json } from "@/lib/api/handler";
import { searchParamsObject } from "@/lib/api/schemas";
import { audienceWindowFor, rangeQuerySchema, resolvePeriod } from "@/lib/analytics/period";
import { getDemographics } from "@/lib/analytics/audience";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { readThrough } from "@/lib/cache/dashboard-cache";
import { dashKey } from "@/lib/cache/keys";

type P = { id: string };
export const dynamic = "force-dynamic";
const TTL_24H = 24 * 3600;

/** Demografi (usia, gender, negara, perangkat) dari snapshot tersinkron. Cache Redis 24 jam. */
export const GET = withApi<P>(async ({ req, userId, params }) => {
  await requireChannelOwnership(userId, params.id);
  const q = rangeQuerySchema.parse(searchParamsObject(req.nextUrl.searchParams));
  const p = resolvePeriod(q);
  const w = audienceWindowFor(p.days);
  const { value, status } = await readThrough(
    dashKey(params.id, "w", String(w), "audience-demographics"),
    () => getDemographics(params.id, p),
    TTL_24H,
  );
  return json(
    // requestedDays bergantung pada permintaan, bukan pada snapshot yang di-cache per jendela.
    { data: { ...value, requestedDays: p.days }, meta: { cached: status === "HIT", cacheTtlSec: TTL_24H } },
    { headers: { "X-Cache": status, "Cache-Control": "private, max-age=300" } },
  );
});
