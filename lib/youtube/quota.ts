/** Klasifikasi error Google API agar worker tahu harus retry, berhenti, atau melewati dimensi. */
export class QuotaExceededError extends Error {
  name = "QuotaExceededError";
}
export class AuthRevokedError extends Error {
  name = "AuthRevokedError";
}
export class YtNotFoundError extends Error {
  name = "YtNotFoundError";
}
export class YtBadRequestError extends Error {
  name = "YtBadRequestError";
}
export class YtUpstreamError extends Error {
  name = "YtUpstreamError";
}

type GErr = {
  code?: number | string;
  status?: number;
  response?: { status?: number; data?: { error?: string | { errors?: { reason?: string }[]; message?: string } } };
  errors?: { reason?: string }[];
  message?: string;
};

const QUOTA_REASONS = new Set(["quotaExceeded", "rateLimitExceeded", "dailyLimitExceeded", "userRateLimitExceeded"]);

export function classifyGoogleError(err: unknown): Error {
  const e = err as GErr;
  const status = Number(e?.response?.status ?? e?.status ?? e?.code ?? 0);
  const data = e?.response?.data?.error;
  const reasons = [
    ...(e?.errors ?? []),
    ...(typeof data === "object" && data?.errors ? data.errors : []),
  ].map((r) => r.reason ?? "");
  const msg = (typeof data === "object" ? data?.message : data) ?? e?.message ?? "Google API error";
  if (data === "invalid_grant" || /invalid_grant/.test(String(e?.message))) return new AuthRevokedError(msg);
  if (status === 429 || (status === 403 && reasons.some((r) => QUOTA_REASONS.has(r)))) return new QuotaExceededError(msg);
  if (status === 401) return new AuthRevokedError(msg);
  if (status === 403 && reasons.some((r) => r === "insufficientPermissions" || r === "forbidden"))
    return new AuthRevokedError(msg);
  if (status === 404) return new YtNotFoundError(msg);
  if (status === 400) return new YtBadRequestError(msg);
  if (status >= 500) return new YtUpstreamError(msg);
  return err instanceof Error ? err : new Error(msg);
}

/** Jadwal backoff kuota dari PRD 5.2: 5m, 30m, 2j (+ jitter 0-10%). */
export const QUOTA_BACKOFF_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export function backoffDelay(attemptsMade: number, err: Error | undefined, scale = 1, rand = Math.random) {
  const jitter = (base: number) => Math.round(base * (1 + rand() * 0.1));
  if (err?.name === "QuotaExceededError") {
    const base = QUOTA_BACKOFF_MS[Math.min(attemptsMade - 1, QUOTA_BACKOFF_MS.length - 1)];
    return Math.max(1, Math.round(jitter(base) * scale));
  }
  // error lain: eksponensial 60s, 120s, 240s
  return Math.max(1, Math.round(jitter(60_000 * 2 ** Math.max(0, attemptsMade - 1)) * scale));
}
