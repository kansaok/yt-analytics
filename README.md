# Analitik Kanal

Dashboard analitik YouTube untuk melihat performa channel, video, audiens, dan sumber traffic dalam satu aplikasi. Dibangun dengan Next.js, Prisma, PostgreSQL/Supabase, Redis/Upstash, BullMQ, dan YouTube Data/Analytics API.

> Status: MVP Fase 1 dan Fase 2 selesai. Produksi membutuhkan konfigurasi Supabase, Upstash, Google OAuth, dan worker terpisah. Ikuti [panduan deployment](docs/DEPLOYMENT.md).

## Kemampuan utama

- Login Google OAuth dengan scope YouTube dan YouTube Analytics hanya-baca.
- Multi-channel: hubungkan beberapa akun/channel dan beralih channel aktif.
- Sinkronisasi awal 90 hari serta sinkronisasi incremental terjadwal tiap 4 jam.
- Dashboard views, subscriber bersih, watch time, perbandingan periode, dan grafik pertumbuhan.
- Tabel video dengan pencarian, urutkan, pagination, ranking terbaik/terburuk, serta perbandingan maksimal tiga video.
- Detail video: CTR, retensi, traffic source, dan tren harian.
- Audiens: demografi, perangkat, negara, waktu optimal per hari, dan sumber traffic.
- Penanda bila satu video menyumbang lebih dari 80% sebuah sumber traffic.
- Cache Redis, pembatasan request per user/IP, CSRF untuk mutasi API, dan token Google terenkripsi AES-256-GCM.
- Endpoint health check: `GET /api/health`.

## Stack

| Area | Teknologi |
|---|---|
| Web | Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts |
| Auth | Auth.js/NextAuth v5 + Google OAuth |
| Database | PostgreSQL dengan Prisma; lokal Docker, produksi Supabase |
| Cache & antrean | Redis/Upstash + BullMQ |
| Data | YouTube Data API v3 dan YouTube Analytics API |
| Test | Vitest, MSW, Playwright |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

## Arsitektur ringkas

```text
Browser
  │
  ▼
Next.js di Vercel ── Prisma ── Supabase PostgreSQL
  │                     │
  ├── Redis cache ──────┘
  │
  └── BullMQ job ── Worker terpisah ── YouTube API
```

Vercel hanya menjalankan web/API serverless. Worker BullMQ harus dijalankan pada proses/container terpisah agar sinkronisasi terjadwal tetap berjalan.

## Menjalankan lokal

Prasyarat: Node.js 20+ dan Docker.

```bash
npm install
cp .env.example .env
npm run db:up
npx prisma migrate deploy
npm run dev
```

Pada terminal kedua:

```bash
npm run worker
```

Web lokal tersedia di `http://localhost:3100`.

Untuk mencoba tanpa OAuth Google asli, isi `AUTH_DEV_LOGIN=1` di `.env`; mode ini hanya aktif di luar produksi dan menampilkan banner data uji.

Panduan lokal lengkap tersedia di [docs/RUNNING.md](docs/RUNNING.md).

## Environment variable

Lihat [.env.example](.env.example) untuk daftar lokal. Nilai produksi minimum:

```text
DATABASE_URL=
REDIS_URL=
AUTH_SECRET=
AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ENCRYPTION_KEY=
ENCRYPTION_KEY_VERSION=1
```

Jangan commit `.env` atau mengirim secret melalui chat. Untuk Supabase Transaction Pooler port `6543`, tambahkan `pgbouncer=true&connection_limit=1` pada `DATABASE_URL` agar Prisma tidak gagal karena prepared statement.

## Deploy produksi

Panduan step-by-step yang membedakan tugas agent dan user tersedia di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Dokumen tersebut mencakup GitHub Actions, Vercel, Supabase, Upstash, Google OAuth, worker terpisah, health check, runtime log, dan troubleshooting.

## Pengujian

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
```

Untuk konfigurasi lintas browser (Chromium, Firefox, WebKit, Edge):

```bash
npx playwright install --with-deps
npm run test:e2e:cross
```

CI menjalankan lint/typecheck, unit test, dan integration test dengan PostgreSQL serta Redis terisolasi.

## Batasan MVP yang diketahui

- Estimasi revenue tidak diambil karena scope monetisasi tidak diminta.
- Kata kunci YouTube Search belum tersedia dari pipeline data saat ini.
- Heatmap waktu optimal tersedia per hari dalam minggu; YouTube Analytics tidak menyediakan data per jam untuk kebutuhan ini.
- Sentry, Lighthouse/k6, serta provider uptime monitor belum dikonfigurasi.

Lihat [docs/HANDOFF.md](docs/HANDOFF.md) untuk daftar teknis dan keputusan produk yang lebih lengkap.

## Dokumen proyek

- [Deployment produksi](docs/DEPLOYMENT.md)
- [Menjalankan dan menguji lokal](docs/RUNNING.md)
- [Keputusan teknis](docs/DECISIONS.md)
- [PRD](prd/00-garis-besar.md)
- [Fase 1](phases/01-fase-1.md)
- [Fase 2](phases/02-fase-2.md)

## Keamanan

Token Google disimpan terenkripsi dan tidak dikirim ke browser. Aplikasi menyediakan penghapusan akun/data, pembersihan data channel yang dicabut setelah tujuh hari, rate limit, dan CSRF protection. Sebelum rilis publik, lakukan review legal terhadap Kebijakan Privasi dan verifikasi OAuth Google.
