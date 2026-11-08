# Risks & Open Questions
## 1. Tabel Risiko
| ID | Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|
| R-01 | Kehabisan kuota YouTube Data API v3 & Analytics API akibat sinkronisasi multi-channel | **Tinggi** - Sinkronisasi gagal, dashboard basi, worker antrean macet untuk 1.000 channel MVP | **Tinggi** | Simpan hanya agregat harian di `ChannelDailyStats` / `VideoDailyStats`, bukan raw per-menit. Cache `GET /analytics/overview` dan `/growth` di Redis Upstash TTL 1-6 jam. Scheduler BullMQ dengan staggered cron per channel + exponential backoff + jitter. Prioritaskan channel aktif dipilih user. Tampilkan `lastSyncedAt` dan status kuota di UI. Implementasi circuit breaker jika error 403 quotaExceeded. |
| R-02 | Gagal verifikasi Google OAuth Brand & audit scope sensitif (`youtube.readonly`, `yt-analytics.readonly`) | **Tinggi** - Tidak bisa rilis publik, login dibatasi 100 tester, diblokir Google Trust & Safety | **Sedang** | Gunakan scope least-privilege saja, tanpa scope upload/comment. Siapkan Privacy Policy, Terms, demo video, dan domain terverifikasi sejak awal. Rilis internal dulu dengan mode Testing. Jangan simpan data di luar scope yang disetujui. Dokumentasikan retensi & penghapusan data untuk audit. |
| R-03 | Data revenue, retensi, CTR tertunda / tidak lengkap dari YouTube Analytics API | **Sedang** - Angka menyesatkan, komplain kreator/agensi soal akurasi | **Tinggi** | Beri label `Estimasi` untuk revenue dan `Data tertunda 24-48 jam` untuk retensi. Selalu tampilkan `timestamp sinkronisasi` di kartu metrik dan detail video. Jangan gunakan revenue untuk billing. Fallback ke cache terakhir jika API return kosong. |
| R-04 | Kebocoran / pencurian OAuth access & refresh token | **Tinggi** - Akses channel user disalahgunakan, pelanggaran kebijakan Google, kehilangan kepercayaan | **Rendah** | Enkripsi `OAuthTokens` at-rest (AES-256-GCM via KMS/Supabase Vault), HTTPS wajib, refresh token rotation via NextAuth.js. Isolasi query per `userId+channelId` di semua Route Handlers. Log audit akses token. Hapus token otomatis saat user revoke di Google atau `DELETE /channels/:id`. |
| R-05 | Pelanggaran ToS YouTube API (penyimpanan dilarang, scraping kompetitor) | **Tinggi** - API key dicabut Google | **Sedang** | Hanya simpan agregat yang diizinkan, patuh YouTube API Services ToS & Developer Policies. Untuk Fase 3 kompetitor hanya pakai Data API publik (views, subs, video list), tanpa scraping. Sediakan halaman hapus data & revoke akses sesuai kebijakan Google. |
| R-06 | Lonjakan beban scheduler & DB time-series saat 1.000 channel x ratusan video | **Sedang** - Latensi dashboard >3 detik, job BullMQ menumpuk, biaya Supabase/Upstash naik | **Sedang** | Paginasi tabel video 50 baris, agregasi di DB bukan di client. Index `(channelId, date)` dan `(videoId, date)`. Partisi / retensi data lama. Rate-limit sync: 1x/hari channel idle, 4x/hari channel aktif. Monitoring antrean BullMQ + alert gagal sync 3x berturut. |
## 2. Pertanyaan Terbuka
### OQ-01: Retensi historis data untuk MVP (30 / 90 / 365 hari)?
- **Konteks:** User Journey mensyaratkan sinkronisasi awal 90 hari terakhir. Berdampak pada kuota API dan ukuran `ChannelDailyStats`.
- **Opsi:** A) 30 hari - hemat kuota, cepat; B) 90 hari - sesuai journey; C) 365 hari - kaya insight tapi boros kuota 4x.
- **Rekomendasi Default:** B) 90 hari untuk metrik channel, 90 hari untuk 50 video terbaru + metadata penuh `Videos`. Data >90 hari diarsipkan/agregat bulanan.
- **Aksi Dev:** Buat parameter `SYNC_LOOKBACK_DAYS=90` di env agar bisa diubah tanpa refactor.
### OQ-02: Batas jumlah channel per user di MVP?
- **Konteks:** Fitur multi-channel tanpa batas akan meledakkan kuota dan kompleksitas UX switcher.
- **Opsi:** A) 3 channel/user; B) 5 channel/user; C) Tanpa batas.
- **Rekomendasi Default:** A) 3 channel/user untuk MVP, dengan pesan upgrade saat limit tercapai. Siapkan kolom `planLimit` untuk Fase pricing.
- **Aksi Dev:** Validasi di `POST /channels/select` + counter di tabel `Channels`.
### OQ-03: Model pricing dan batas ekspor / laporan terjadwal?
- **Konteks:** Ekspor PDF/Excel dan laporan terjadwal (Fase 2) butuh object storage + email (Resend/SendGrid) yang berbiaya.
- **Opsi:** A) Gratis terbatas (mis. 5 ekspor/bulan, 1 laporan mingguan); B) Freemium + Pro berbayar; C) Semua gratis di MVP.
- **Rekomendasi Default:** A) Gratis terbatas di MVP untuk validasi, hitung usage di tabel `Reports`. Jangan bangun billing penuh di MVP sesuai Di Luar Scope.
- **Aksi Dev:** Tambahkan `exportCount`, `reportScheduleCount` dan feature flag, tanpa integrasi payment gateway.
### OQ-04: Provider LLM final untuk Insight AI Fase 3?
- **Konteks:** Mempengaruhi biaya, privasi data, dan kualitas `Ringkas Insight Otomatis` dan `Prediksi Performa`.
- **Opsi:** A) OpenAI GPT-4o-mini; B) Anthropic Claude Haiku; C) Google Gemini Flash (satu vendor dengan Google Cloud).
- **Rekomendasi Default:** C) Gemini Flash untuk Fase 3 karena keselarasan ekosistem Google + biaya rendah untuk ringkasan, dengan abstraksi provider agar bisa ganti. Jangan kirim PII, hanya kirim agregat anonim.
- **Aksi Dev:** Jangan implementasi di MVP, tapi siapkan tabel `AIInsights` dan interface `AIService.generate()` kosong.
## 3. Rekomendasi
- Tetap gunakan `SYNC_LOOKBACK_DAYS=90`, limit 3 channel/user, dan ekspor terbatas sebagai default agar tidak mengubah scope MVP dan kuota API tetap aman.
- Prioritaskan pengajuan verifikasi OAuth Google sejak sprint awal karena lead time 2-6 minggu di luar kendali dev.
- Tambahkan banner `Data estimasi & terakhir disinkron pada HH:MM` di semua kartu metrik untuk menurunkan risiko komplain akurasi tanpa perubahan API.