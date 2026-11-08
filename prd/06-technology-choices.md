# Technology Choices
## Frontend Web
- **Stack utama:** Next.js 14 + React 18 + TypeScript 5 (Node.js 20 LTS).
- **Alasan:** Satu bahasa end-to-end, SSR/ISR untuk dashboard cepat dan SEO, Route Handlers menyatu dengan backend monolit, cocok untuk MVP SaaS web responsif desktop-first.
- **Alternatif dipertimbangkan:** Remix / SvelteKit - ditolak karena ekosistem NextAuth + Vercel + Recharts lebih matang; Vite SPA murni - ditolak karena butuh SSR untuk first-load <3 detik.
- **Styling & Komponen UI:** Tailwind CSS 3 + shadcn/ui (Radix UI primitives) + Phosphor Icons regular.
- **Alasan:** Utility-first konsisten, shadcn copy-paste tanpa dependensi UI berat, mudah terapkan token Gaya Laut v1.
- **Alternatif:** MUI / Ant Design - ditolak karena bundle besar dan sulit kustom tema; Chakra UI - ditolak karena maintenance dan fleksibilitas token lebih rendah.
- **Grafik:** Recharts 2 sebagai default (kartu metrik, garis pertumbuhan, bar perbandingan) + Apache ECharts 5 opsional untuk heatmap jam/hari dan grafik dense >500 titik.
- **Alasan:** Recharts deklaratif React dan cepat diimplementasi; ECharts canvas-based untuk performa dataset besar tanpa lag interaksi.
- **Alternatif:** Chart.js / Victory - ditolak karena interaktivitas tooltip sinkron dan custom theme lebih terbatas; D3 murni - ditolak karena overkill untuk MVP.
- **State & Data Fetching:** TanStack Query 5 + Zustand 4 + date-fns 3 + zod 3 untuk validasi query `channelId&from&to`.
- **Alasan:** Caching dashboard per channel/tanggal mengurangi hit API, validasi runtime cegah query invalid ke Analytics Service.
## Backend
- **Framework API:** Next.js 14 Route Handlers (REST) + Prisma ORM 5 + arsitektur monolit modular (modul `auth`, `sync`, `analytics`, `report`).
- **Alasan:** Satu repo deploy, validasi scope `user-channel` per request terpusat via middleware, Prisma type-safe untuk agregat harian.
- **Alternatif:** NestJS / Django + Python - ditolak untuk MVP karena dua bahasa dan hosting terpisah; tRPC - ditolak agar kontrak REST tetap stabil untuk ekspor dan worker.
- **Antrean & Scheduler:** BullMQ 5 + Redis 7 (Upstash Redis) untuk `sync-channel`, `sync-videos`, `rollup-daily`.
- **Alasan:** Rate-limit kuota YouTube API, retry dengan backoff exponential, penjadwalan per channel (mis. tiap 6 jam + on-demand).
- **Alternatif:** In-memory cron / pg-boss - ditolak karena hilang saat restart dan tidak skalabel ke 1.000 channel; Celery - ditolak karena beda stack bahasa.
- **Library integrasi:** `googleapis` npm (YouTube Data API v3, YouTube Analytics API, YouTube Reporting API) + `google-auth-library` untuk refresh token.
## Database
- **Primer:** PostgreSQL 15+ managed Supabase (termasuk pg_cron opsional untuk trigger agregasi).
- **Alasan:** Relasional cocok untuk `Users, OAuthTokens, Channels, ChannelDailyStats, Videos, VideoDailyStats`, dukung index time-series `(channelId, date)` dan `(videoId, date)` untuk grafik dan perbandingan periode.
- **Alternatif:** MySQL / PlanetScale - ditolak karena fitur time-series dan JSONB Postgres lebih kuat; MongoDB - ditolak karena agregat harian butuh join dan konsistensi relasional; TimescaleDB - ditunda ke pasca-MVP jika volume >10 jt baris/hari.
- **Cache:** Upstash Redis sebagai cache baca dashboard (TTL 15–60 menit per `channelId:from:to`, invalidasi saat sync selesai).
- **Alasan:** Penuhi target grafik <1 detik setelah cache dan hemat kuota API.
## Storage
- **File ekspor:** Supabase Storage (S3-compatible) untuk PDF/Excel laporan, path `exports/{userId}/{channelId}/{reportId}.pdf|xlsx` dengan signed URL 7 hari.
- **Alasan:** Satu vendor dengan Postgres, ACL per user, mudah hapus saat revoke akses sesuai ToS Google.
- **Alternatif:** AWS S3 langsung / Vercel Blob - ditolak untuk MVP agar tidak tambah akun dan IAM; lokal disk - ditolak karena ephemeral di Vercel.
- **Generasi file:** `pdfkit` / `@react-pdf/renderer` untuk PDF, `exceljs` untuk XLSX dijalankan di Route Handler / worker terpisah agar tidak block UI.
## Auth
- **Standar:** NextAuth.js v5 (Auth.js) Google Provider dengan OAuth2 least-privilege, refresh token rotation, token terenkripsi (AES-256-GCM via `ENCRYPTION_KEY`) di tabel `OAuthTokens`.
- **Scope Google:** `openid email profile`, `youtube.readonly`, `yt-analytics.readonly`, `yt-analytics-monetary.readonly` (revenue opsional per persetujuan user).
- **Alasan:** Standar industri, handle callback, expiry, dan multi-channel select tanpa simpan password; isolasi data per `userId-channelId`.
- **Alternatif:** Passport.js custom / Firebase Auth - ditolak karena handling refresh token YouTube manual dan risiko scope berlebih; Clerk/Auth0 - ditolak karena biaya dan ketergantungan vendor untuk MVP.
## Hosting / Deploy
- **Aplikasi web + API:** Vercel (Production + Preview per PR), region `sin1` terdekat, HTTPS wajib, env terenkripsi.
- **Data & antrean:** Supabase (Postgres + Storage) + Upstash (Redis + QStash scheduler jika perlu).
- **Alasan:** Deploy tercepat untuk Next.js 14, autoscale untuk dashboard, managed service kurangi ops untuk target 1.000 channel dan uptime 99,5%.
- **Alternatif:** VPS Docker / AWS ECS - ditolak karena overhead ops; Cloudflare Pages - ditolak karena Route Handlers + BullMQ butuh Node runtime lama.
## CI/CD
- **Pipeline:** GitHub Actions + Vercel Git Integration.
- **Stages wajib:** `lint` (ESLint 8 + Prettier 3 + tsc --noEmit) → `test` (unit) → `build` → `migrate --check` (Prisma) → deploy Preview → e2e smoke → promote Production + tag rilis Fase 1/2/3.
- **Alasan:** Cegah migrasi merusak, setiap PR dapat URL preview untuk QA dashboard dan tabel video 50 baris.
- **Alternatif:** GitLab CI / Jenkins - ditolak karena repo di GitHub dan integrasi Vercel bawaan lebih sederhana.
## Testing
- **Unit + integrasi:** Vitest 1 + Testing Library + MSW untuk mock YouTube API dan agregasi `overview/growth/compare`.
- **E2E:** Playwright 1 (Chromium/Firefox/WebKit) untuk alur login OAuth (mock), pilih channel, ganti tanggal, buka detail video.
- **Kualitas tambahan:** Lighthouse CI (performa <3 detik), `k6` smoke untuk endpoint `/analytics/overview` dengan cache, Secret scanning dan `npm audit`.
- **Alasan:** Cakupan cepat tanpa Selenium berat; Playwright wajib validasi Chrome/Edge/Firefox/Safari terbaru sesuai Quality Requirements.
- **Alternatif:** Jest + Cypress - ditolak karena Vitest lebih cepat untuk Vite/Next dan Playwright multi-browser lebih stabil.
## Design System
- **Acuan:** Gaya Laut (v1), detail token lengkap di `DESIGN.md`.
- **Token wajib:** Latar terang `#EDF4F5`, permukaan `#FFFFFF`, teks `#12262B`, utama `#0E4D5C`, aksen `#A84A14`, garis `#C5D6DA`; mode gelap wajib berfungsi penuh dengan kontras AA.
- **Tipografi & bentuk:** Judul + isi Plus Jakarta Sans, kode IBM Plex Mono; radius kontrol 10px, kartu 14px, overlay 18px; kartu tanpa bayangan, border 1px `border-line`.
- **Implementasi:** Token sebagai CSS variables + `tailwind.config` (`colors.sea.*`, `radius.*`), dial ENERGY 1 / RHYTHM 2 / MOTION 2 untuk batasi animasi grafik agar tetap tenang.