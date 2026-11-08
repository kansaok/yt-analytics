import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { ApiError } from "./errors";
import { getSessionUserId } from "@/lib/auth/session";
import { redis } from "@/lib/redis";

type Ctx<P> = { req: NextRequest; userId: string; params: P; traceId: string };
type Handler<P> = (ctx: Ctx<P>) => Promise<NextResponse>;

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);
export const CSRF_COOKIE = "yta-csrf";

const isMutation = (method: string) => !["GET", "HEAD", "OPTIONS"].includes(method);

function csrfMatches(req: NextRequest) {
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  const header = req.headers.get("x-csrf-token");
  if (!cookie || !header || cookie.length !== header.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
}

function setCsrfCookie(req: NextRequest, res: NextResponse) {
  if (req.cookies.has(CSRF_COOKIE)) return;
  res.cookies.set(CSRF_COOKIE, randomBytes(32).toString("base64url"), {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/** Rate limit sederhana per user per menit (fixed window di Redis). Redis mati => lewati. */
async function rateLimit(bucket: string, limit: number) {
  try {
    const key = `rl:${bucket}:${Math.floor(Date.now() / 60000)}`;
    const n = await redis().incr(key);
    if (n === 1) await redis().expire(key, 61);
    if (n > limit) throw new ApiError("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi sebentar.", undefined, 60);
  } catch (e) {
    if (e instanceof ApiError) throw e;
  }
}

/** IP pertama disediakan reverse proxy tepercaya; alamat tak tersedia tetap dibatasi bersama. */
function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function errorResponse(err: unknown, traceId: string) {
  let apiErr: ApiError;
  if (err instanceof ApiError) apiErr = err;
  else if (err instanceof ZodError)
    apiErr = new ApiError("VALIDATION_ERROR", "Parameter tidak valid.", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  else apiErr = new ApiError("INTERNAL", "Terjadi kesalahan pada server.");
  const headers: Record<string, string> = {};
  if (apiErr.retryAfterSec) headers["Retry-After"] = String(apiErr.retryAfterSec);
  return NextResponse.json(
    {
      error: {
        code: apiErr.code,
        message: apiErr.message,
        details: apiErr.details,
        traceId,
        retryAfterSec: apiErr.retryAfterSec,
      },
    },
    { status: apiErr.status, headers },
  );
}

/**
 * Pembungkus semua Route Handler ber-sesi: auth, rate limit, traceId, log JSON terstruktur
 * (tanpa token/email mentah), dan envelope error standar.
 */
export function withApi<P = Record<string, string>>(
  handler: Handler<P>,
  opts: { rateLimit?: number } = {},
) {
  return async (req: NextRequest, ctx: { params: P }) => {
    const traceId = `req_${randomUUID().slice(0, 12)}`;
    const started = Date.now();
    let status = 500;
    let userId: string | null = null;
    try {
      userId = await getSessionUserId();
      if (!userId) throw new ApiError("UNAUTHENTICATED", "Sesi berakhir. Silakan masuk lagi.");
      // Auth.js menangani CSRF endpoint OAuth sendiri. Semua mutasi API aplikasi perlu double-submit token.
      if (isMutation(req.method) && process.env.NODE_ENV !== "test" && !csrfMatches(req))
        throw new ApiError("FORBIDDEN", "Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.");
      // Bucket terpisah: baca 60/menit/user, mutasi & pemicu sync 10/menit/user (prd/05, prd/09).
      await rateLimit(
        opts.rateLimit ? `u:${userId}:mut` : `u:${userId}:read`,
        opts.rateLimit ?? Number(process.env.RATE_LIMIT_READ_PER_MIN ?? 120),
      );
      await rateLimit(`ip:${clientIp(req)}`, Number(process.env.RATE_LIMIT_IP_PER_MIN ?? 300));
      const res = await handler({ req, userId, params: ctx?.params ?? ({} as P), traceId });
      status = res.status;
      res.headers.set("X-Trace-Id", traceId);
      setCsrfCookie(req, res);
      return res;
    } catch (err) {
      const res = errorResponse(err, traceId);
      status = res.status;
      if (status >= 500) console.error(JSON.stringify({ traceId, error: String((err as Error)?.stack ?? err) }));
      return res;
    } finally {
      const channelId = (ctx?.params as Record<string, string> | undefined)?.id;
      console.log(
        JSON.stringify({
          requestId: traceId,
          method: req.method,
          path: req.nextUrl.pathname,
          userIdHash: userId ? hash(userId) : null,
          channelId: channelId ?? null,
          status,
          latencyMs: Date.now() - started,
        }),
      );
    }
  };
}

export function json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: init?.headers });
}
