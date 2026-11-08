# Menjalankan & Menguji (Fase 1)

## Prasyarat
- Node.js 20+ (diuji di 22), Docker.

## Setup sekali
```bash
npm install
cp .env.example .env          # isi AUTH_SECRET & ENCRYPTION_KEY: openssl rand -base64 32
npm run db:up                 # Postgres :5434 + Redis :6381 (pengganti Supabase/Upstash)
npx prisma migrate deploy
```

## Menjalankan
Dua proses (web dan worker terpisah, sesuai prd/07 §7):
```bash
npm run dev       # web di http://localhost:3100
npm run worker    # BullMQ: sync-initial, sync-incremental, scheduler cron 0 */4 * * *
```

### Tanpa kredensial Google (mode data uji)
Set `AUTH_DEV_LOGIN=1` di `.env` (hanya berlaku di luar produksi). Halaman login menampilkan
"Masuk mode pengembangan (data uji)". Channel uji dan angkanya berasal dari generator lokal, dan UI
menampilkan banner "Mode data uji".

### Dengan Google asli
1. Google Cloud Console: aktifkan YouTube Data API v3 dan YouTube Analytics API.
2. OAuth Client (Web). Authorized redirect URIs:
   - `http://localhost:3100/api/auth/callback/google` (login)
   - `http://localhost:3100/api/youtube/callback` (Tambah channel / akun Google lain)
3. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, lalu set `AUTH_DEV_LOGIN=0`.
4. Selama aplikasi berstatus "Testing" di Google, tambahkan akun penguji di OAuth consent screen.

## Pindah ke Supabase/Upstash
Ganti `DATABASE_URL` (Supabase, connection pooling + `directUrl` bila perlu) dan `REDIS_URL` (Upstash `rediss://...`),
lalu jalankan `npx prisma migrate deploy`.

## Fase 2 (audiens)
Halaman `/audience` (tab Demografi, Waktu optimal, Sumber traffic). Data demografi ditarik worker bersama sinkronisasi
(maks 1x per 20 jam per channel). **Restart worker** setelah memperbarui kode agar sinkronisasi audiens aktif.
Untuk channel yang sudah terhubung sebelum Fase 2, tekan "Sinkron Sekarang" sekali agar data audiens terisi.
Variabel baru: `RATE_LIMIT_READ_PER_MIN` (default 120).

## Tes
```bash
npm test                  # Vitest (61 tes): unit + integrasi + scope-guard (DB analitik_test & Redis db 1, Google API di-mock MSW)
npm run lint              # ESLint + tsc --noEmit
```
Sekali saja sebelum tes integrasi:
```bash
docker exec yta2-postgres-1 psql -U analitik -c "CREATE DATABASE analitik_test"
DATABASE_URL="postgresql://analitik:analitik@localhost:5434/analitik_test?schema=public" npx prisma migrate deploy
```

### E2E (Playwright, Chromium)
Dijalankan terhadap build produksi lokal. Mode dev Next 14 di mesin 8 GB bisa butuh lebih dari 15 menit untuk
mengompilasi satu route.
```bash
npx playwright install chromium
E2E_LOCAL_BUILD=1 npx next build
E2E_LOCAL_BUILD=1 npx next start -p 3100 &     # AUTH_DEV_LOGIN=1 di .env
npm run worker &
npx playwright test
```
`E2E_LOCAL_BUILD=1` hanya mengizinkan login uji di `next start` bila `AUTH_URL` adalah localhost.
