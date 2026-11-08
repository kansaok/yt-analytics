import { createHash } from "node:crypto";
import { withApi, json } from "@/lib/api/handler";
import { searchParamsObject, videosQuerySchema } from "@/lib/api/schemas";
import { resolvePeriod } from "@/lib/analytics/period";
import { listVideos } from "@/lib/analytics/service";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { readThrough, DASH_TTL_SEC, ttlForStatus } from "@/lib/cache/dashboard-cache";
import { dashKey } from "@/lib/cache/keys";

type P = { id: string };
export const dynamic = "force-dynamic";

/** Tabel performa video: sort, search, paginasi server-side (50/halaman, maks 100). */
export const GET = withApi<P>(async ({ req, userId, params }) => {
  const ch = await requireChannelOwnership(userId, params.id);
  const q = videosQuerySchema.parse(searchParamsObject(req.nextUrl.searchParams));
  const p = resolvePeriod(q);
  const extra = createHash("sha1")
    .update(JSON.stringify([q.sort, q.order, q.search ?? "", q.published ?? "", q.page, q.limit]))
    .digest("hex")
    .slice(0, 16);
  const { value, status } = await readThrough(
    dashKey(params.id, p.from, p.to, "videos", extra),
    () => listVideos(params.id, p, q),
    ttlForStatus(ch.status),
  );
  return json(
    { ...value, period: p, cache: { cached: status === "HIT", cacheTtlSec: DASH_TTL_SEC } },
    { headers: { "X-Cache": status, "Cache-Control": "private, max-age=300" } },
  );
});
