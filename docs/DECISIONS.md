# Keputusan Proyek (Fase 1)

Keputusan Product Owner atas konflik/ambiguitas dokumen, 6 Nov 2026.

| ID | Topik | Keputusan | Sumber konflik |
|---|---|---|---|
| D1 | Infra dev | Lokal dulu: Docker Postgres 16 (port 5434) + Redis 7 (port 6381) sebagai pengganti Supabase/Upstash. Cukup ganti `DATABASE_URL`/`REDIS_URL` untuk cloud. | prd/06 vs ketersediaan kredensial |
| D2 | Path endpoint | Ikuti file fase: `/api/channels/[id]/metrics`, `/timeseries`, `/videos`, `/videos/ranking`, `/api/videos/[id]/stats`. | prd/09 vs phases/01 |
| D3 | Revenue | Tanpa scope `yt-analytics-monetary.readonly`. Kartu revenue tampil `-` + tooltip. | prd/06 vs prd/05 & prd/09 |
| D4 | Batas channel | 5 channel/user, via env `MAX_CHANNELS_PER_USER`. | prd/02 B3 vs prd/10 OQ-02 |
| D5 | Token OAuth | Satu baris `OAuthTokens` per grant Google: unik `(userId, provider, googleSubject)`, plus `Channels.oauthTokenId`. "Tambah channel" = OAuth terpisah via `/api/youtube/connect`. | prd/08 UNIQUE(userId,provider) vs multi-channel |
| D6 | Kurva retensi | `Videos.retentionCurve` JSONB `[{ratio, watchRatio}]`. | phases/01 vs prd/08 |
| D7 | Grafik traffic/demografi | Bar horizontal berperingkat + tabel, bukan donut (tint teal gagal uji palet kategorikal, ΔE 11 < 15). Task yang menyebut "donat" dianggap terpenuhi dengan bentuk ini. | phases/02 vs DESIGN.md |
| D8 | Rate limit baca | 120 req/menit/user (PRD 60), via `RATE_LIMIT_READ_PER_MIN`. Mutasi/sync tetap 10/menit. | prd/09 vs pemakaian nyata (1 halaman = 4 request) |
| D9 | Filter tanggal kustom | Rentang kustom dipertahankan (Scope S3). Yang ditunda ke Fase 2 lanjutan: filter per video/playlist/tipe. | phases/02 vs prd/02 S3 |
| D10 | Mulai Fase 2 | Dimulai walau 2 task Fase 1 menunggu kredensial Google asli. | PROMPT.md langkah 5 |

## Keputusan teknis agen (bisa ditinjau PO)

- **Traffic source = bar horizontal berperingkat, bukan donut.** Validator palet dataviz: tint teal (satu-satunya warna yang diizinkan DESIGN.md) gagal sebagai palet kategorikal (beda warna normal-vision ΔE 11,1 < 15). DESIGN.md juga menyarankan line/bar.
- **Akses silang user-channel = 403**, channel tidak ada = 404 (prd/05 Keamanan).
- **Pembanding "tidak lengkap"** bila periode pembanding mulai sebelum `historySince` atau tanpa data. Hari bolong dari YouTube tetap celah di grafik.
- **Statistik harian per video** hanya untuk 50 video terbaru (`SYNC_VIDEO_DAILY_LIMIT`, mengikuti rekomendasi default OQ-01).
- **CTR/impresi** diminta dari Analytics API (`videoThumbnailImpressions*`); bila API menolak (400) dimensi dilewati dan UI menampilkan N/A (prd/02 S4, prd/09 §5.3).
- **Sesi JWT** (prd/07 §5). Logout menghapus cookie sesi; tidak ada sesi server untuk dihapus.
- **Nama kerja "Analitik Kanal"** sebagai teks logo (placeholder, R-23). Belum ada logo resmi.
- **Mode data uji**: `AUTH_DEV_LOGIN=1` (hanya non-produksi) memberi login tanpa Google + gateway YouTube generator lokal, dengan banner "Mode data uji". `E2E_LOCAL_BUILD=1` mengizinkannya di `next start` lokal hanya bila `AUTH_URL` localhost.

## Fase 2 (keputusan teknis agen, perlu ditinjau PO)

- **Tabel baru `ChannelAudienceStats`** (additif): `(channelId, kind AGE_GENDER|COUNTRY|DEVICE, windowDays 28|90, data JSONB, syncedAt)`.
  Data Model awal tidak punya tempat menyimpan demografi padahal task meminta data dari PostgreSQL. Hanya agregat, tanpa data penonton perorangan,
  ikut terhapus saat channel diputus (cascade). Ditarik 6 query per channel, dan hanya bila lebih dari 20 jam sejak terakhir (hemat kuota).
- **Heatmap per hari dalam minggu, bukan 7x24.** Dokumentasi resmi YouTube Analytics (dimensions) hanya menyediakan dimensi `day` dan `month`;
  tidak ada dimensi jam. Sesuai fallback prd/03 (Fase 2 #3), endpoint mengembalikan rata-rata per hari dalam minggu dari 28 hari terakhir
  (3 hari terakhir dikecualikan karena belum final), `matrix: null`, `hourlyAvailable: false`, dan UI menyatakannya terang-terangan.
  Badge "Waktu terbaik: Jumat 19.00" tidak bisa dihitung; yang ada "Hari terbaik: Jumat". Nilai seri tidak menyorot hari apa pun.
- **Rentang pengguna dipetakan ke jendela audiens terdekat** (<= 45 hari: 28 hari; lebih: 90 hari) dan UI menyebutkannya. Demografi tidak bisa
  mengikuti rentang kustom persis karena YouTube mengembalikan persentase per jendela, bukan per hari.
- **Traffic sources dihitung dari `VideoDailyStats.trafficSource`** (video yang statistiknya disinkron, default 50 terbaru), sehingga mendukung
  semua rentang dan delta vs periode lalu. UI menampilkan jumlah video dan perkiraan cakupan dari total views channel. Persentase dinormalisasi
  (sisa terbesar) agar jumlahnya persis 100,0.
- **Tanpa ECharts**: heat strip 7 sel dibuat dengan CSS grid (nilai tertulis di bawah tiap sel). ECharts hanya akan dipakai bila ada data per jam.
- **Task "tahan fitur"** (ekspor PDF/Excel, laporan terjadwal, filter lanjutan) dibuktikan oleh `tests/integration/scope-guard.test.ts`
  (memindai route, dependensi, kode UI, dan antrean/scheduler BullMQ di Redis) serta e2e (UI dan endpoint `/api/reports/*` 404).
