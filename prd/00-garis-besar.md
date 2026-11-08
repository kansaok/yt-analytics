## 1. Product Summary
- Menyelesaikan masalah kreator dan agensi yang kesulitan membaca YouTube Studio yang terfragmentasi untuk mengambil keputusan konten berbasis data.
- Tujuan produk: menyediakan analitik YouTube terpusat, visual, dan actionable untuk performa channel, video, audiens, kompetitor, dan rekomendasi AI.
- Target pengguna: YouTuber individu, tim content creator, agensi digital, dan brand dengan channel YouTube aktif.
- Proposisi nilai: sinkronisasi otomatis via OAuth, dashboard web responsif, dan insight bahasa natural tanpa analisis manual.
- Model awal: web app SaaS multi-channel dengan fase rilis bertahap dari MVP analitik hingga AI.

## 2. Scope
**Termasuk MVP**
- Login OAuth Google, pilih channel, sinkronisasi views/subscriber/watch time, dan multi-channel.
- Dashboard performa channel: kartu metrik, grafik pertumbuhan harian, perbandingan periode.
- Analitik per video: tabel performa, detail CTR/retensi/traffic source, ranking terbaik/terburuk.

**Di Luar Scope**
- Aplikasi mobile native, upload/edit video, dan manajemen komentar YouTube.
- Analisis kompetitor, laporan terjadwal/ekspor PDF-Excel lanjutan, dan fitur AI.
- Monetisasi ads, integrasi TikTok/Instagram, dan billing langganan penuh di MVP.

## 3. Key Features
### Fase 1 - Fondasi Analitik
- Integrasi Akun YouTube: hubungkan channel via OAuth untuk sinkronisasi otomatis.
- Login OAuth Google: autentikasi aman dan pemilihan channel yang dianalisis.
- Sinkronisasi Data Otomatis: tarik views, subscriber, watch time berkala via YouTube API.
- Manajemen Multi-Channel: tambah dan beralih antar channel dalam satu akun.
- Dashboard Performa Channel: ringkasan metrik utama dalam satu tampilan visual.
- Kartu Metrik Utama: total views, subscriber baru, watch time, estimasi revenue.
- Grafik Pertumbuhan: tren harian interaktif dalam grafik garis.
- Perbandingan Periode: bandingkan periode saat ini vs sebelumnya.
- Analitik Video Per Konten: analisis per video berdasar views, CTR, retensi, engagement.
- Tabel Performa Video: daftar video dengan views, like, komentar, durasi tonton.
- Detail Statistik Video: CTR thumbnail, retensi audiens, traffic source per video.
- Ranking Video Terbaik: urutkan video tertinggi/terendah untuk evaluasi.
### Fase 2 - Audiens dan Laporan
- Analisis Audiens dan Traffic: pahami demografi dan sumber penemuan video.
- Demografi Penonton: breakdown usia, gender, lokasi, perangkat.
- Waktu Tonton Optimal: heatmap jam/hari saat audiens paling aktif.
- Sumber Traffic: analisis search, suggested, browse, eksternal.
- Laporan dan Ekspor Data: buat laporan siap presentasi dan bagikan.
- Ekspor PDF dan Excel: unduh data dan grafik sebagai PDF/spreadsheet.
- Laporan Terjadwal: kirim ringkasan mingguan/bulanan otomatis via email.
- Filter Tanggal Kustom: saring data berdasar tanggal, video, atau playlist.
### Fase 3 - Kompetitor dan AI
- Analisis Kompetitor: pantau dan bandingkan performa dengan channel sejenis.
- Tracking Channel Kompetitor: pantau pertumbuhan subscriber dan views kompetitor.
- Perbandingan Head-to-Head: bandingkan metrik utama side-by-side.
- Deteksi Video Viral: temukan video kompetitor bertumbuh tercepat untuk inspirasi.
- Insight AI dan Rekomendasi: rekomendasi konten berbasis pola data.
- Ringkasan Insight Otomatis: jelaskan naik-turun performa dalam bahasa natural.
- Saran Judul dan Topik: rekomendasikan topik, judul, tag dari keyword berperforma tinggi.
- Prediksi Performa Video: prediksi potensi views video baru dari data historis.

## 4. User Journey
- Pengguna daftar/login di web, klik Hubungkan YouTube, setujui scope OAuth Google, dan pilih channel.
- Sistem sinkronisasi awal menarik 90 hari terakhir views, subscriber, dan daftar video.
- Pengguna membuka dashboard, melihat kartu metrik dan grafik tren, lalu ubah rentang tanggal dan bandingkan periode.
- Pengguna buka tabel video, sortir views terendah, klik video untuk lihat CTR, retensi, dan traffic source.
- Pengguna memutuskan topik berikutnya berdasar ranking video terbaik dan retensi tertinggi.

## 5. Quality Requirements
- Platform Web: responsif desktop-first, mendukung Chrome/Edge/Firefox/Safari terbaru, mobile web dapat dibaca.
- Performa: dashboard awal <3 detik, grafik interaktif <1 detik setelah cache, paginasi tabel video 50 baris.
- Keamanan: OAuth2 Google least-privilege, token terenkripsi, isolasi data per user-channel, HTTPS wajib.
- Skala: dukung 1.000 channel MVP dengan sinkronisasi terjadwal dan cache agregat harian agar hemat kuota API.
- Ketersediaan & regulasi: uptime target 99,5%, patuh ToS YouTube API dan kebijakan privasi Google, hapus data saat revoke akses.

## 6. Technology Choices
### Web
- Next.js 14 + React 18 + TypeScript: framework fullstack untuk SSR dashboard cepat dan satu bahasa end-to-end.
- Tailwind CSS + shadcn/ui + Recharts/ECharts: mempercepat UI konsisten dan grafik interaktif tanpa library berat.
- NextAuth.js (Auth.js) Google Provider: menangani OAuth Google dan refresh token secara standar dan aman.
### Backend
- Next.js Route Handlers + Prisma ORM + PostgreSQL (Supabase): monolit modular untuk API, job sinkronisasi, dan data time-series.
- Redis + BullMQ (Upstash): cache metrik harian dan antrean sinkronisasi berkala agar tidak kena limit kuota YouTube.
- Alasan pilihan: stack JS tunggal tercepat untuk MVP web analitik, mudah di-hosting di Vercel; trade-off kurang optimal untuk ETL sangat besar dibanding Python/Django.
### Design System
- Mengikuti Gaya Laut (v1): tenang dan meyakinkan untuk layanan data sensitif.
- Palet terang: latar #EDF4F5, permukaan #FFFFFF, teks #12262B, utama #0E4D5C, aksen #A84A14, garis #C5D6DA; palet gelap wajib berfungsi penuh.
- Font: judul Plus Jakarta Sans, isi Plus Jakarta Sans, kode IBM Plex Mono; bentuk radius kontrol 10px, kartu 14px, overlay 18px; kartu tanpa bayangan; ikon Phosphor Icons regular; dial ENERGY 1 / RHYTHM 2 / MOTION 2.
- Detail lengkap ada di berkas DESIGN.md pada paket ekspor.

## 7. System Design
- Client Web Next.js: SPA/SSR untuk dashboard, grafik, dan tabel; memanggil Backend API via REST dengan sesi NextAuth.
- API Backend: modul Auth, Sync Service, Analytics Service, Report Service; validasi scope channel per request.
- Sync Worker BullMQ + Scheduler: menarik YouTube Data/Analytics API berkala, menyimpan agregat harian ke PostgreSQL dan cache Redis.
- Penyimpanan: PostgreSQL untuk data inti, Redis untuk cache dashboard, object storage untuk file ekspor PDF/Excel.
- Alur: Web -> API -> Cache/DB; jika miss, API trigger agregasi; worker mengisi data agar kuota hemat dan UI tetap cepat.

## 8. Data Model
- Users: akun aplikasi dan preferensi, relasi ke koneksi OAuth Google.
- OAuthTokens: menyimpan access/refresh token terenkripsi per user.
- Channels: channel YouTube terhubung dan status sinkronisasi milik user.
- ChannelDailyStats: agregat harian views, subs, watch time, revenue untuk grafik dan perbandingan.
- Videos: metadata video per channel yang disinkronkan.
- VideoDailyStats: metrik harian per video plus CTR, retensi, engagement untuk detail dan ranking.
- Competitors & CompetitorSnapshots (Fase 3): daftar pantauan dan snapshot publik.
- Reports & AIInsights (Fase 2-3): definisi laporan terjadwal dan hasil insight AI.

## 9. APIs & Integrations
- Auth & Channel: `POST /auth/google`, `GET /channels`, `POST /channels/select`, `DELETE /channels/:id`.
- Dashboard: `GET /analytics/overview?channelId&from&to`, `GET /analytics/growth`, `GET /analytics/compare`.
- Video: `GET /videos?sort&search`, `GET /videos/:id/stats`, `GET /videos/ranking`.
- Fase lanjutan: `GET /audience/*`, `POST /reports/export`, `POST /reports/schedule`, `GET /competitors/compare`, `POST /ai/insights`.
- Integrasi pihak ketiga: Google OAuth2, YouTube Data API v3, YouTube Analytics API, YouTube Reporting API; LLM untuk insight, Resend/SendGrid untuk email laporan.

## 10. Risks & Open Questions
- Risiko kuota YouTube API: sinkronisasi multi-channel bisa boros; mitigasi dengan agregat harian, cache, dan backoff.
- Risiko kepatuhan Google OAuth verification dan scope sensitif: butuh verifikasi brand dan audit privasi sebelum rilis publik.
- Risiko akurasi revenue dan retensi: data API tertunda/tidak lengkap; perlu label estimasi dan timestamp sinkronisasi.
- Open: retensi historis berapa hari untuk MVP (30/90/365)? Batas jumlah channel per user?
- Open: model pricing dan batas ekspor/laporan? Provider LLM final untuk fitur AI Fase 3?