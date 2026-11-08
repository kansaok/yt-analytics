// Lingkungan uji: DB & Redis lokal terpisah dari data pengembangan.
process.env.DATABASE_URL = "postgresql://analitik:analitik@localhost:5434/analitik_test?schema=public";
process.env.REDIS_URL = "redis://localhost:6381/1";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";
process.env.AUTH_URL = "http://localhost:3100";
process.env.SYNC_LOOKBACK_DAYS = "90";
process.env.SYNC_VIDEO_DAILY_LIMIT = "50";
process.env.MAX_CHANNELS_PER_USER = "5";
process.env.MANUAL_SYNC_COOLDOWN_SEC = "900";
