# APIs & Integrations
## 1. Konvensi Umum API
- **Base URL:** `https://<app-domain>/api` + path di bawah. Semua path di PRD dibaca relatif terhadap `/api`.
- **Versi:** tanpa versioning URL di MVP (`/api/...`); penambahan versi dilakukan via header `Accept: application/json; v=1` bila breaking change.
- **Auth:** sesi cookie `httpOnly` dari NextAuth.js (Auth.js). Tidak ada API key publik di MVP. Semua request kecuali inisiasi OAuth wajib kirim cookie sesi.
- **Otorisasi channel:** setiap request ber-data channel wajib kirim `channelId` (query/body) dan lolos cek `Users ↔ Channels` milik user. Header konteks aktif: `X-Channel-Id` opsional sebagai pengganti query.
- **Format:** request/response JSON `application/json`; tanggal ISO-8601 `YYYY-MM-DD`, datetime UTC `YYYY-MM-DDTHH:mm:ssZ`.
- **Paginasi:** `?page=1&limit=50` (maks 100), respons sertakan `meta { page, limit, total, totalPages }`.
- **Rate limit internal:** 60 req/menit/user, 300 req/menit/IP; respons `429` dengan header `Retry-After`.
## 2. Daftar Endpoint
### 2.1 Auth & Channel (MVP - Fase 1)
| Method | Path | Deskripsi | Auth |
|---|---|---|---|
| GET | `/auth/google` | Inisiasi login OAuth Google (redirect ke Google consent). Query `?callbackUrl=/dashboard` | Publik |
| GET | `/auth/callback/google` | Callback OAuth, tukar code jadi session + simpan token terenkripsi | Publik (state validated) |
| POST | `/auth/signout` | Hapus sesi, tidak revoke token Google kecuali `?revoke=true` | Sesi |
| GET | `/channels` | List channel YouTube milik user yang terhubung + `syncStatus`, `lastSyncedAt` | Sesi |
| POST | `/channels/connect` | Daftarkan channel pasca-OAuth dari `mine:true` Data API. Body `{ youtubeChannelId }` | Sesi |
| POST | `/channels/select` | Set channel aktif untuk sesi dashboard. Body `{ channelId }` | Sesi + pemilik channel |
| GET | `/channels/:id` | Detail satu channel + status kuota/sync terakhir | Sesi + pemilik channel |
| DELETE | `/channels/:id` | Putus channel, hapus token channel & antrean sync-nya (patuh revoke Google) | Sesi + pemilik channel |
### 2.2 Dashboard Performa Channel (MVP - Fase 1)
| Method | Path | Deskripsi | Auth |
|---|---|---|---|
| GET | `/analytics/overview?channelId&from&to` | Kartu metrik agregat: views, subs net, watchTimeHours, avgViewDuration, estRevenue + delta vs periode sebelumnya | Sesi + akses channel |
| GET | `/analytics/growth?channelId&from&to&granularity=daily` | Time-series harian untuk grafik garis. `granularity=daily` (MVP) | Sesi + akses channel |
| GET | `/analytics/compare?channelId&from&to&compareFrom&compareTo` | Perbandingan periode saat ini vs sebelumnya per metrik + persen perubahan | Sesi + akses channel |
### 2.3 Analitik Video (MVP - Fase 1)
| Method | Path | Deskripsi | Auth |
|---|---|---|---|
| GET | `/videos?channelId&from&to&sort&order&search&page&limit` | Tabel performa video. `sort=views\|watchTime\|ctr\|retention\|likes\|comments\|publishedAt`, `order=asc\|desc`, `search=judul` | Sesi + akses channel |
| GET | `/videos/:id/stats?from&to` | Detail statistik satu video: CTR, retensi, engagement, traffic source breakdown | Sesi + akses channel video |
| GET | `/videos/ranking?channelId&from&to&by=views\|ctr\|retention&order=desc&limit=10` | Ranking video terbaik/terburuk berdasar metrik | Sesi + akses channel |
### 2.4 Fase Lanjutan (Fase 2-3, Non-MVP)
| Method | Path | Deskripsi | Auth |
|---|---|---|---|
| GET | `/audience/demographics?channelId&from&to` | Breakdown usia, gender, lokasi (country), perangkat | Sesi + akses channel |
| GET | `/audience/watch-time?channelId&from&to` | Heatmap jam x hari waktu tonton optimal | Sesi + akses channel |
| GET | `/audience/traffic-sources?channelId&from&to` | Proporsi search, suggested, browse, external, playlist | Sesi + akses channel |
| GET | `/reports?channelId` | List definisi laporan terjadwal | Sesi + akses channel |
| POST | `/reports/export` | Ekspor sekali jalan. Body `{ channelId, type: pdf\|xlsx, from, to, sections[] }` → job async, kembalikan `reportId` + `downloadUrl` saat ready | Sesi + akses channel |
| GET | `/reports/:id/download` | Unduh file dari object storage (signed URL 15 menit) | Sesi + akses channel |
| POST | `/reports/schedule` | Buat/ubah jadwal. Body `{ channelId, frequency: weekly\|monthly, dayOfWeek, recipients[], sections[] }` | Sesi + akses channel |
| DELETE | `/reports/:id` | Hapus jadwal laporan | Sesi + akses channel |
| GET | `/competitors?channelId` | List channel kompetitor yang dipantau | Sesi + akses channel |
| POST | `/competitors` | Tambah pantauan. Body `{ youtubeChannelId }` (data publik saja) | Sesi + akses channel |
| GET | `/competitors/compare?channelId&competitorIds[]&from&to` | Head-to-head subs, views, upload frequency side-by-side | Sesi + akses channel |
| GET | `/competitors/viral?channelId&days=28&limit=10` | Video kompetitor bertumbuh tercepat (views/day) | Sesi + akses channel |
| POST | `/ai/insights` | Generate ringkasan insight. Body `{ channelId, from, to, locale: id }` → job LLM, simpan ke `AIInsights` | Sesi + akses channel |
| GET | `/ai/insights?channelId&from&to` | Ambil hasil insight tersimpan + saran judul/topik & prediksi views | Sesi + akses channel |
## 3. Contoh Request / Response Endpoint Utama
### 3.1 `GET /channels`
```http
GET /api/channels HTTP/1.1
Cookie: next-auth.session-token=xxx
```
```json
{
  "data": [
    {
      "id": "ch_01J9Z8",
      "youtubeChannelId": "UCxxxx",
      "title": "Kanal Masak",
      "thumbnailUrl": "https://...",
      "subscriberCount": 125400,
      "isActive": true,
      "syncStatus": "synced",
      "lastSyncedAt": "2026-11-05T17:00:00Z"
    }
  ]
}
```
### 3.2 `POST /channels/select`
```http
POST /api/channels/select HTTP/1.1
Content-Type: application/json
{"channelId": "ch_01J9Z8"}
```
```json
{ "data": { "activeChannelId": "ch_01J9Z8" } }
```
### 3.3 `GET /analytics/overview`
```http
GET /api/analytics/overview?channelId=ch_01J9Z8&from=2026-10-06&to=2026-11-05 HTTP/1.1
```
```json
{
  "data": {
    "channelId": "ch_01J9Z8",
    "period": { "from": "2026-10-06", "to": "2026-11-05", "compareFrom": "2026-09-06", "compareTo": "2026-10-05" },
    "metrics": {
      "views": { "value": 842120, "deltaPct": 12.4 },
      "subscribersNet": { "value": 4210, "deltaPct": -3.1 },
      "watchTimeHours": { "value": 38450.5, "deltaPct": 8.9 },
      "estRevenueUSD": { "value": 1240.75, "isEstimate": true, "deltaPct": 5.2 }
    },
    "lastSyncedAt": "2026-11-05T17:00:00Z"
  },
  "meta": { "cached": true, "cacheTtlSec": 3600 }
}
```
### 3.4 `GET /videos` + `GET /videos/:id/stats`
```http
GET /api/videos?channelId=ch_01J9Z8&sort=views&order=desc&page=1&limit=50&search=resep HTTP/1.1
```
```json
{
  "data": [
    {
      "id": "vid_09A1",
      "youtubeVideoId": "dQw4w9WgXcQ",
      "title": "Resep Ayam Krispi",
      "publishedAt": "2026-10-12T10:00:00Z",
      "durationSec": 620,
      "views": 152300,
      "likes": 8200,
      "comments": 640,
      "ctrPct": 5.8,
      "avgRetentionPct": 42.5
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 214, "totalPages": 5 }
}
```
```http
GET /api/videos/vid_09A1/stats?from=2026-10-06&to=2026-11-05 HTTP/1.1
```
```json
{
  "data": {
    "videoId": "vid_09A1",
    "views": 152300,
    "impressions": 2625000,
    "ctrPct": 5.8,
    "avgViewDurationSec": 263,
    "avgRetentionPct": 42.5,
    "trafficSources": [
      { "source": "suggested", "views": 72000, "pct": 47.3 },
      { "source": "search", "views": 41000, "pct": 26.9 },
      { "source": "browse", "views": 22000, "pct": 14.4 }
    ],
    "daily": [{ "date": "2026-11-04", "views": 4200, "watchTimeHours": 310.5 }]
  }
}
```
## 4. Format Error Standar
- Semua error memakai envelope berikut + `traceId` untuk korelasi log:
```json
{
  "error": {
    "code": "CHANNEL_NOT_FOUND",
    "message": "Channel tidak ditemukan atau bukan milik akun ini.",
    "details": { "channelId": "ch_xxx" },
    "traceId": "req_abc123",
    "retryAfterSec": 60
  }
}
```
| HTTP | `code` | Kapan dipakai |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Query/body tidak valid (tanggal terbalik, `channelId` kosong) |
| 401 | `UNAUTHENTICATED` | Sesi hilang/kedaluwarsa; client harus redirect `/login` |
| 403 | `FORBIDDEN` / `OAUTH_SCOPE_MISSING` | Bukan pemilik channel atau scope Google kurang; minta re-consent |
| 404 | `NOT_FOUND` / `CHANNEL_NOT_FOUND` / `VIDEO_NOT_FOUND` | Resource tidak ada |
| 409 | `SYNC_IN_PROGRESS` | Sinkronisasi awal masih jalan; UI tampilkan progres + polling `GET /channels/:id` |
| 429 | `RATE_LIMITED` / `YOUTUBE_QUOTA_EXCEEDED` | Limit internal atau kuota YouTube habis; hormati `retryAfterSec` |
| 502 | `YOUTUBE_UPSTREAM_ERROR` | YouTube API 5xx/timeout setelah retry |
| 503 | `SYNC_WORKER_UNAVAILABLE` | Antrean BullMQ penuh/down |
## 5. Integrasi Pihak Ketiga
### 5.1 Google OAuth2 via NextAuth.js Google Provider
- **Kegunaan:** login dan otorisasi akses data YouTube milik user.
- **Scope least-privilege (wajib):** `openid email profile`, `https://www.googleapis.com/auth/yt-analytics.readonly`, `https://www.googleapis.com/auth/youtube.readonly`. Dilarang minta `youtube.force-ssl` / upload di MVP.
- **Data dikirim:** `client_id`, `redirect_uri`, `scope`, `access_type=offline`, `prompt=consent` saat pertama kali untuk dapat `refresh_token`.
- **Data disimpan:** `access_token` (memori saja) + `refresh_token` terenkripsi AES-256-GCM di `OAuthTokens`; rotasi otomatis oleh NextAuth callback.
- **Gagal:** `access_denied` → redirect ke `/connect?error=denied` dengan CTA hubungkan ulang; `invalid_grant` (revoke user) → tandai `Channels.syncStatus=revoked`, hapus token, kirim notifikasi re-connect; token kedaluwarsa → refresh 1x, jika gagal kembalikan `403 OAUTH_SCOPE_MISSING`.
### 5.2 YouTube Data API v3
- **Kegunaan:** metadata channel (`channels.list mine:true`), daftar video (`search.list`/`playlistItems`), statistik publik video, dan data kompetitor Fase 3 (`channels.list`, `videos.list` publik).
- **Data dikirim:** `youtubeChannelId` / `youtubeVideoId`, `part=snippet,statistics,contentDetails`, `pageToken`; tidak kirim PII selain ID.
- **Gagal:** `403 quotaExceeded` → hentikan job, jadwalkan ulang dengan exponential backoff (5m, 30m, 2j) via BullMQ, sajikan cache Redis + banner `Data per <lastSyncedAt>`; `404 notFound` → tandai video privat/dihapus; `5xx` → retry maks 3x lalu masuk DLQ + alert.
### 5.3 YouTube Analytics API
- **Kegunaan:** sumber utama metrik `views, subscribersGained/Lost, watchTime, averageViewDuration, ctr, impressions, trafficSource, demographics, deviceType` untuk `ChannelDailyStats` dan `VideoDailyStats`.
- **Data dikirim:** `ids=channel==MINE`, `metrics=...`, `dimensions=day,video,trafficSourceDetail,ageGroup,gender,country,deviceType`, `startDate/endDate`, `filters=video==<id>` untuk detail.
- **Gagal:** data tertunda 24-48 jam → simpan `isPartial=true` dan tampilkan label `Estimasi / Tertunda`; `400 invalidFilter` → catat dan lewati dimensi tanpa gagalkan seluruh sync; kuota habis → prioritaskan `overview+growth` dari cache agregat harian, tunda `demographics` ke jadwal malam.
### 5.4 YouTube Reporting API (Bulk)
- **Kegunaan:** backfill historis 90 hari MVP dan agregat harian skala 1.000 channel agar hemat kuota (job malam hari).
- **Data dikirim:** `jobType=channel_basic_a2/channel_demographics_a1`, `reportTypeId`, tanggal report; unduh CSV dari `mediaUrl` ke worker lalu agregasi ke PostgreSQL.
- **Gagal:** report belum ready (`PENDING`) → polling tiap 1 jam maks 24 jam; unduhan gagal → retry 3x lalu fallback ke Analytics API harian untuk tanggal tersebut dan tandai `source=analytics_fallback`.
### 5.5 LLM untuk Insight AI (Fase 3)
- **Kegunaan:** `POST /ai/insights`: ringkasan naik-turun performa, saran judul/topik/tag, prediksi potensi views dari agregat historis.
- **Data dikirim:** hanya agregat anonim (tren views/CTR/retensi, topik video, bukan email/token), plus `locale=id`; dilarang kirim `refresh_token` atau PII mentah ke LLM.
- **Gagal:** timeout (>30 dtk) → job async BullMQ retry 2x, UI tampilkan `generating`; output tidak valid → validasi skema JSON, fallback ke template rule-based; nonaktifkan tombol AI bila provider down dengan pesan eksplisit.
### 5.6 Resend / SendGrid untuk Email Laporan (Fase 2)
- **Kegunaan:** kirim laporan terjadwal mingguan/bulanan + link unduh PDF/Excel (signed URL) via `POST /reports/schedule`.
- **Data dikirim:** `to`, `subject`, `html` ringkasan metrik, `attachments` atau link object storage; tanpa token OAuth.
- **Gagal:** bounce/block → tandai `Reports.lastStatus=bounced`, tidak retry otomatis selain 1x; `429 provider` → antre ulang BullMQ dengan delay 10 menit; kegagalan total tidak memblokir dashboard, hanya badge status laporan.