import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6381"),
  AUTH_URL: z.string().url().default("http://localhost:3100"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  ENCRYPTION_KEY: z.string().default(""),
  ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  ENCRYPTION_KEY_PREVIOUS: z.string().default(""),
  ENCRYPTION_KEY_PREVIOUS_VERSION: z.coerce.number().int().min(1).optional(),
  SYNC_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(365).default(90),
  SYNC_VIDEO_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(50),
  MAX_CHANNELS_PER_USER: z.coerce.number().int().min(1).max(50).default(5),
  MANUAL_SYNC_COOLDOWN_SEC: z.coerce.number().int().min(0).default(900),
  AUTH_DEV_LOGIN: z.string().default("0"),
  YOUTUBE_FIXTURES: z.string().default("0"),
});

let cached: z.infer<typeof schema> | null = null;
export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

/**
 * Build produksi lokal khusus e2e (next build + next start di mesin developer).
 * Wajib tiga syarat sekaligus, termasuk AUTH_URL localhost, agar tidak mungkin aktif di deploy nyata.
 */
function localE2eBuild() {
  const e = env();
  return process.env.E2E_LOCAL_BUILD === "1" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(e.AUTH_URL);
}

/** Login tanpa Google + data YouTube dari generator lokal. Tidak pernah aktif di produksi. */
export function devModeEnabled() {
  const e = env();
  return (e.NODE_ENV !== "production" || localE2eBuild()) && e.AUTH_DEV_LOGIN === "1";
}
export function fixturesEnabled() {
  const e = env();
  return (e.NODE_ENV !== "production" || localE2eBuild()) && (e.YOUTUBE_FIXTURES === "1" || e.AUTH_DEV_LOGIN === "1");
}
