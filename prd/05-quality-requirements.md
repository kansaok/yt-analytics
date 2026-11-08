# Quality Requirements
## Performa
- **Dashboard awal:** LCP <3 detik dan TTI <3,5 detik pada desktop broadband ≥10 Mbps, diukur Lighthouse desktop; skor Performance ≥90.
- **API Dashboard:** `GET /analytics/overview` p95 <1 detik saat cache hit Redis, p95 <3 detik saat cache miss / agregasi DB; `GET /analytics/growth` dan `/analytics/compare` target sama.
- **Interaktivitas grafik:** filter tanggal, hover tooltip, zoom <1 detik setelah data di-cache; rendering Recharts/ECharts tanpa blocking >200ms.
- **Tabel video:** paginasi server-side 50 baris per halaman; respons API p95 <800ms; render + sort/search client p95 <500ms; wajib loading skeleton, tidak boleh blank page.
- **Caching:** agregat harian channel/video di Redis dengan TTL 1–6 jam; `Cache-Control: private, max-age=300` untuk respons overview; `stale-while-revalidate` untuk grafik.
- **Budget frontend:** JS awal per route <250 KB gzip; gambar/diagram lazy-load; hindari fetch N+1 ke API.
## Keamanan
- **OAuth least-privilege:** hanya scope `openid email profile` + `https://www.googleapis.com/auth/yt-analytics.readonly` + `https://www.googleapis.com/auth/youtube.readonly`; dilarang scope upload/edit/komentar.
- **Token:** access/refresh token disimpan terenkripsi AES-256-GCM di kolom `OAuthTokens` dengan kunci dari env/KMS, tidak pernah di localStorage; refresh otomatis via NextAuth; revoke menghapus token <5 menit.
- **Transport & sesi:** HTTPS wajib + HSTS; cookie sesi `HttpOnly; Secure; SameSite=Lax`; expiry sesi 24 jam idle 30 hari max; CSRF protection aktif pada Route Handlers mutasi.
- **Isolasi data:** setiap request analytics/video wajib validasi `channelId milik userId` via middleware; uji akses silang user-channel harus 403; query via Prisma parameterized, tanpa SQL string concat.
- **Hardening:** header CSP, X-Content-Type-Options, Referrer-Policy; rate-limit 60 req/menit/IP untuk API publik + 10 req/menit untuk auth/sync trigger; validasi Zod untuk `from/to/channelId`.
## Privasi & Manajemen Data
- **Minimasi:** hanya simpan metadata channel/video dan agregat harian views/subs/watch time/revenue yang dibutuhkan dashboard; tidak menyimpan isi komentar atau data sensitif audiens individual.
- **Retensi:** data mentah sinkronisasi awal 90 hari terakhir; agregat harian dipertahankan; hapus permanen semua `Channels, ChannelDailyStats, Videos, VideoDailyStats, OAuthTokens` milik user maksimal 7 hari setelah disconnect/revoke atau hapus akun.
- **Consent & transparansi:** tampilkan timestamp `Terakhir disinkronkan` dan label `Estimasi` untuk revenue/retensi; halaman Kebijakan Privasi menjelaskan scope OAuth dan tujuan penggunaan data.
## Skalabilitas
- **Kapasitas MVP:** mendukung 1.000 channel terhubung, 200 pengguna konkuren dashboard, 100 req/detik API baca tanpa degradasi >20% latensi.
- **Sinkronisasi hemat kuota:** Sync Worker BullMQ terjadwal per channel (mis. 4x/hari channel aktif, 1x/hari tidak aktif); batching + agregat harian; exponential backoff + jitter saat 403 quotaExceeded; antrean prioritas untuk sync manual.
- **Database:** indeks `(channelId, date)` pada `ChannelDailyStats` dan `(videoId, date)` pada `VideoDailyStats`; paginasi cursor/offset; partisi per bulan jika >5 juta baris.
- **Stateless:** web/API stateless agar dapat horizontal scaling di Vercel; state sync/cache di PostgreSQL/Redis, bukan memori instance.
## Ketersediaan & Ketahanan
- **Target:** uptime 99,5% per bulan (±3,6 jam toleransi); RTO <4 jam, RPO <24 jam via backup harian PostgreSQL Supabase + PITR 7 hari.
- **Degradasi anggun:** jika YouTube API down/kuota habis, tampilkan data cache terakhir + banner `Data per HH:MM, sinkronisasi tertunda` dan nonaktifkan tombol sync manual sementara; error rate 5xx API <1%.
- **Keberhasilan sync:** success rate job sinkronisasi >98% per 24 jam; retry max 3x; dead-letter queue untuk investigasi.
## Kompatibilitas Platform & Perangkat
- **Browser:** Chrome, Edge, Firefox, Safari 2 versi stabil terakhir; tanpa error JS kritis; grafik dan tabel fungsional penuh.
- **Responsif desktop-first:** breakpoint 1280px+ penuh; 768–1279px tablet tanpa scroll horizontal; 360–767px mobile web dapat dibaca: kartu metrik stack vertikal, grafik scroll/zoom sentuh, tabel jadi scroll horizontal dengan kolom kunci sticky.
- **Jaringan:** tetap usable pada 3G lambat dengan skeleton + paginasi; tidak ada ketergantungan pada WebGL/native.
## Aksesibilitas
- **Standar:** WCAG 2.1 AA: rasio kontras teks ≥4,5:1 terang dan gelap; fokus keyboard terlihat; semua aksi dapat diakses keyboard + screen reader.
- **Grafik & tabel:** sediakan teks alternatif ringkasan metrik, `aria-label` pada chart, tabel dengan header semantik; hormati `prefers-reduced-motion` untuk animasi grafik.
- **Mode gelap:** palet gelap wajib berfungsi penuh dengan kontras setara; radius 10/14/18px dan ikon Phosphor tetap terbaca.
## Logging, Monitoring & Alerting
- **Logging:** log terstruktur JSON dengan `requestId, userIdHash, channelId, latency, status`; dilarang log token, email mentah, atau body sensitif; retensi log 30 hari.
- **Monitoring wajib:** Sentry untuk error frontend/backend; monitor uptime 1 menit; dashboard metrik: latensi p50/p95 per endpoint, hit-rate Redis, sisa kuota YouTube API, panjang antrean BullMQ, gagal sync per channel.
- **Alert:** Pager/email jika error rate >2% selama 5 menit, p95 overview >3 detik selama 10 menit, quota YouTube >80%, atau sync gagal >5% dalam 1 jam.
## Regulasi & Kepatuhan
- **Google/YouTube:** patuh YouTube API Services Terms of Service, Google API User Data Policy, dan kebijakan OAuth verification; tampilkan atribusi data YouTube; sediakan endpoint hapus data untuk audit Google.
- **PDP Indonesia:** patuh UU No. 27/2022: dasar persetujuan eksplisit saat OAuth, hak akses/koreksi/hapus, pemberitahuan insiden kebocoran ≤72 jam.
- **Kriteria rilis:** lolos verifikasi OAuth, Security Headers A, tidak ada secret di repo, dan uji hapus data saat revoke terbukti menghapus token + agregat user tersebut.