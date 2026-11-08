# Handoff: pekerjaan yang belum selesai

Dibuat 7 Nov 2026 di akhir Fase 2. Untuk agent berikutnya: baca file ini, lalu `PROMPT.md`, `docs/DECISIONS.md`, dan `docs/RUNNING.md`.
Aturan proyek dari `PROMPT.md` tetap berlaku: keputusan di Scope, Technology Choices, System Design, dan Data Model mengikat;
jangan menambah fitur di luar Scope atau mengganti teknologi tanpa persetujuan Product Owner (PO); centang `[x]` hanya bila
kriteria terbukti; tanyakan ke PO bila dokumen bertentangan; UI wajib melewati filter antislop (mode "during") dan menyertakan
laporan Delivery Gate.

## 1. Status ringkas

| Fase | Task tercentang | Sisa |
|---|---|---|
| Fase 1 (`phases/01-fase-1.md`) | 18 dari 18 | selesai; OAuth Google asli telah diverifikasi |
| Fase 2 (`phases/02-fase-2.md`) | 9 dari 9 | selesai; heatmap ditutup 8 Nov 2026 dengan versi per hari (keputusan PO opsi A) |
| Fase 3 | belum ada | tidak ada file `phases/03-*.md`; fitur kompetitor dan AI dilarang di Scope MVP tanpa persetujuan PO |

Kualitas saat serah terima: lint dan `tsc` bersih, 61 tes Vitest lulus, 4 e2e Playwright (Chromium) lulus, build produksi OK.
Ukuran JS awal per route 96 sampai 151 kB (budget PRD 250 kB).

## 2. Task yang belum selesai

### 2.1 Fase 1: OAuth Google asli (SELESAI)
OAuth Google asli telah diverifikasi dan task konfigurasi NextAuth Google Provider ditandai selesai di `phases/01-fase-1.md`.
UI tambah serta switcher multi-channel sudah lebih dahulu selesai dan tercatat dengan bukti uji di file fase.

### 2.2 Fase 2: dua task heatmap (SELESAI 8 Nov 2026)
Kriteria direvisi dan kedua task dicentang. Teks di bawah dipertahankan sebagai riwayat.

Belum dicentang di `phases/02-fase-2.md`:
- **Implementasi agregasi heatmap waktu tonton optimal** (kriteria: matriks 7x24 hari-jam)
- **Bangun UI heatmap jam dan hari aktif** (kriteria: komponen ECharts, jam dan hari paling aktif)

Penyebab: YouTube Analytics hanya punya dimensi `day` dan `month` (sudah diverifikasi dari dokumentasi resmi `dimensions`), jadi
data per jam tidak ada. Yang dibangun: rata-rata per hari dalam minggu dari 28 hari terakhir (fallback yang disebut prd/03 Fase 2 #3),
`matrix: null`, `hourlyAvailable: false`, komponen `components/audience/heat-strip.tsx` (CSS grid 7 sel, tanpa ECharts).

Butuh keputusan PO, pilih salah satu:
- **A (disarankan):** terima versi per hari dalam minggu, ubah kriteria kedua task, lalu centang.
- **B:** tunda sampai ada sumber data per jam. Sumber yang mungkin ada belum diselidiki (YouTube Reporting API bulk
  report dan sumber non-YouTube). Bila ketemu, `getWatchHeatmap` di `lib/analytics/audience.ts` sudah menyiapkan field `matrix`,
  dan `HeatStrip` tinggal diperluas ke 7x24.

**Keputusan PO — 7 Nov 2026:** pilih **A**. Versi MVP yang diterima adalah fallback “hari terbaik” (rata-rata per hari dalam minggu),
bukan heatmap 7×24. Agent berikutnya perlu memperbarui kriteria kedua task di `phases/02-fase-2.md`, menjalankan verifikasi yang
relevan, lalu baru menandai keduanya `[x]`. Jangan mengklaim data jam tersedia atau menambahkan ECharts hanya demi memenuhi
kriteria lama.

## 3. Keputusan yang menunggu PO

Semua ini sudah dikerjakan dengan asumsi default. Bila PO menolak, ubah sesuai catatan.

| # | Pertanyaan | Default saat ini | Kalau ditolak |
|---|---|---|---|
| 1 | Tabel baru `ChannelAudienceStats` (Data Model aslinya tidak punya tempat demografi) | ditambahkan, aditif, hanya agregat, cascade saat channel dihapus | buat migrasi baru yang menghapus tabel, lalu pindahkan penyimpanan |
| 2 | Demografi mengikuti jendela 28 atau 90 hari, bukan rentang kustom persis | rentang <= 45 hari memakai 28, lebih memakai 90, UI menjelaskannya | tarik data per rentang (lebih boros kuota) |
| 3 | Statistik harian per video hanya untuk 50 video terbaru (`SYNC_VIDEO_DAILY_LIMIT`) | 50, traffic dan ranking hanya mencakup video itu (UI menampilkan cakupan, sekitar 38% pada data uji) | naikkan env, pantau kuota |
| 4 | Traffic source dihitung dari `VideoDailyStats.trafficSource` | ya | tarik per channel dari Analytics API dan simpan di `ChannelAudienceStats` |
| 5 | Nama dan logo produk | teks "Analitik Kanal" sebagai nama sementara, tanpa logo | ganti teks di `components/shell/app-shell.tsx`, `app/layout.tsx`, halaman login |
| 6 | Teks Kebijakan Privasi | draf teknis di `app/privacy/page.tsx` yang menjelaskan perilaku nyata | perlu tinjauan hukum sebelum rilis publik dan verifikasi OAuth Google |

Keputusan yang sudah final tercatat di `docs/DECISIONS.md` (D1 sampai D10).

## 4. Celah yang diketahui (belum dikerjakan)

Ini ada di PRD tetapi belum dibangun, atau dibangun sebagian. Urutan kira-kira berdasar dampak.

**Kepatuhan dan keamanan (prd/05)**
- **Penghapusan data setelah revoke:** selesai di kode. Scheduler sinkronisasi sekarang menghapus channel berstatus `REVOKED` beserta agregatnya
  setelah 7 hari; `DELETE /api/account` menghapus seluruh akun, token, channel, dan agregatnya. Migrasi
  `20261108090000_revoked_data_retention` wajib diterapkan sebelum rilis.
- **Rate limit per-IP:** selesai di Route Handler ber-sesi, default 300 req/menit/IP (`RATE_LIMIT_IP_PER_MIN`). Endpoint OAuth publik
  masih mengikuti perlindungan Auth.js/provider dan belum memiliki limiter khusus 10 req/menit.
- **CSRF:** selesai untuk Route Handler mutasi aplikasi melalui token double-submit (`yta-csrf` + header `X-CSRF-Token`). Klien API
  meminta token otomatis dari `GET /api/csrf`; Auth.js mempertahankan proteksi state/CSRF-nya sendiri untuk OAuth.
- **Rotasi `ENCRYPTION_KEY`:** selesai di kode melalui kolom `OAuthTokens.keyVersion`, satu kunci transisi sebelumnya, rotasi bertahap saat
  grant dipakai, dan perintah `npm run crypto:rotate` untuk memutar seluruh grant. Migrasi
  `20261108093000_oauth_key_version` wajib diterapkan sebelum dipakai.
- Cek hasil `npm audit` (ada peringatan dari dependensi, belum ditinjau) dan pemindaian secret.

**Fitur di luar task tetapi ada di PRD Fase 1 dan 2**
- Perbandingan 2 sampai 3 video berdampingan: selesai di `components/videos/videos-view.tsx`; pemilihan dibatasi tiga video dan
  menampilkan views, watch time, like, komentar, CTR, retensi, serta engagement pada periode aktif.
- Daftar kata kunci pencarian di sumber traffic (Fase 2 #4); UI sudah menulis "belum tersedia".
- Penanda satu video mendominasi lebih dari 80% satu sumber: selesai; API menghitung porsi per video pada tiap sumber dan UI memberi pemberitahuan.
- Pagination `meta` memakai `page`, `limit`, `total`, `totalPages` (sudah), tetapi paginasi cursor tidak ada (cukup untuk MVP).
- Estimasi revenue selalu kosong karena scope `yt-analytics-monetary.readonly` sengaja tidak diminta (D3). Kartu menampilkan "Belum tersedia".
- YouTube Reporting API (backfill bulk) tidak dipakai; sinkronisasi awal 90 hari memakai Analytics API harian.
- Mode sinkronisasi hanya mengenal `initial` dan `incremental`; prioritas antrean "channel aktif" belum dibedakan dari channel idle.

**Operasional (prd/05, prd/06, prd/07)**
- GitHub Actions CI tersedia di `.github/workflows/ci.yml`: lint/typecheck, unit test, dan integration test dengan PostgreSQL/Redis terisolasi.
  Lighthouse CI, k6, Sentry, monitor uptime, dan alert masih belum ada; skor Lighthouse serta Web Vitals **belum diukur**
  (jangan melaporkan angka yang tidak diukur, antislop R-40).
- E2E default tetap Chromium. Konfigurasi Firefox, WebKit, dan Edge tersedia lewat `npm run test:e2e:cross`; browser serta server
  aplikasi harus tersedia sebelum dijalankan dan hasilnya belum dicatat.
- Endpoint publik `GET /api/health` tersedia untuk monitor uptime; provider monitor dan alert masih perlu dikonfigurasi di layanan eksternal.
- Deploy ke Vercel, Supabase, dan Upstash belum dicoba. Koneksi Supabase lewat pooler mungkin butuh `directUrl` di `schema.prisma`.
  Worker BullMQ harus berjalan sebagai proses terpisah (`npm run worker`), bukan di Vercel.
- Direktori ini **bukan repo git** (`git init` belum dijalankan; `.gitignore` sudah ada dan mengecualikan `.env`).

## 5. Fase 3

Tidak ada file fase. Scope MVP melarang modul kompetitor, deteksi viral, LLM, ringkasan AI, saran judul, dan prediksi tanpa persetujuan tertulis
PO (`prd/02-scope.md` bagian "Larangan Penambahan"). Tabel `Competitors`, `CompetitorSnapshots`, `Reports`, dan `AIInsights` sudah ada di
skema sebagai persiapan tetapi tidak dipakai kode mana pun. Jangan mulai Fase 3 sebelum PO membuat file `phases/03-*.md` dan menjawab
open question OQ-04 (provider LLM) di `prd/10-risks-open-questions.md`.

## 6. Cara melanjutkan dengan cepat

```bash
cd /Users/macbookpro/www/yta2
npm run db:up && npx prisma migrate deploy      # Postgres :5434, Redis :6381 (Docker)
npm run dev                                     # http://localhost:3100
npm run worker                                  # proses sinkronisasi (restart setelah mengubah kode lib/)
npm test                                        # 61 tes, butuh DB analitik_test (lihat docs/RUNNING.md)
npm run lint
```

E2E harus memakai build produksi, karena `next dev` di mesin 8 GB ini bisa butuh lebih dari 15 menit untuk mengompilasi satu route:
```bash
E2E_LOCAL_BUILD=1 npx next build
E2E_LOCAL_BUILD=1 npx next start -p 3100 &      # .env: AUTH_DEV_LOGIN=1
npm run worker &
npx playwright test                             # 4 tes, sekitar 35 detik
```
Tanpa kredensial Google, login uji tersedia dengan `AUTH_DEV_LOGIN=1` (data dari generator `lib/youtube/fixtures.ts`, selalu berbanner
"Mode data uji"). Flag `E2E_LOCAL_BUILD=1` hanya sah bila `AUTH_URL` adalah localhost (lihat `lib/env.ts`).

### Titik lanjut setelah handoff ini

1. Tutup heatmap MVP sesuai keputusan PO di atas (revisi kriteria fase, verifikasi, lalu centang dua task Fase 2).
2. Untuk menutup Fase 1, PO perlu membuat OAuth client Google tipe **Web application**, mengaktifkan **YouTube Data API v3** dan
   **YouTube Analytics API**, lalu menyimpan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` hanya di `.env` lokal (jangan dikirim lewat
   chat atau dikomit). Redirect URI lokal yang diperlukan: `http://localhost:3100/api/auth/callback/google` dan
   `http://localhost:3100/api/youtube/callback`; detail ada di `docs/RUNNING.md`.
3. Setelah `.env` siap: set `AUTH_DEV_LOGIN=0`, restart `npm run dev` dan `npm run worker`, lalu uji login, pilih channel, tambah
   akun/channel kedua, switcher, sinkronisasi, dan revoke akses Google seperti langkah 2.1.

Kondisi mesin saat serah terima: server produksi lokal (PID 40829, port 3100) dan worker (PID 37137) masih berjalan; container
`yta2-postgres-1` dan `yta2-redis-1` aktif. Container `yta-postgres-1` dan `yta-redis-1` (port 5433 dan 6380) adalah milik sesi lain,
jangan dihentikan.

## 7. Peta kode

- `lib/analytics/` period.ts (periode dan delta), service.ts (metrik, time-series, video, ranking, detail), audience.ts (demografi, heatmap, traffic).
- `lib/youtube/` gateway: `client.ts` (googleapis nyata), `fixtures.ts` (data uji), `quota.ts` (klasifikasi error dan backoff 5m, 30m, 2j).
- `lib/sync/sync-channel.ts` inti sinkronisasi (idempoten lewat upsert); `lib/queue/` antrean BullMQ, worker, scheduler cron `0 */4 * * *`.
- `lib/auth/` NextAuth v5, penyimpanan grant terenkripsi (`google-tokens.ts`), cek kepemilikan (`ownership.ts`: milik user lain 403, tidak ada 404).
- `lib/cache/` cache baca-tembus Redis; kunci `dash:{channelId}:...` dibuang saat sinkronisasi selesai.
- `app/api/**` Route Handler dibungkus `withApi` (auth, rate limit, traceId, log JSON tanpa token); path mengikuti file fase (`/api/channels/[id]/...`).
- `components/` UI Gaya Laut; token warna di `app/globals.css` dan `tailwind.config.ts`.
- `tests/` unit, integrasi (DB dan Redis nyata, Google API di-mock), `scope-guard.test.ts` (bukti fitur yang ditahan), e2e.

## 8. Jebakan yang pernah terjadi

- Jangan pakai `parseISO('YYYY-MM-DD')` lalu `getUTCDay()`: `parseISO` memakai zona waktu lokal. Pakai `new Date(\`${d}T00:00:00Z\`)`.
- Elemen `sr-only` (position absolute) di dalam pembungkus yang bisa di-scroll membuat halaman melebar bila pembungkus tidak `relative`.
- Cache browser: `lib/client/api.ts` memakai `cache: "no-store"` karena server mengirim `Cache-Control: max-age=300`; tanpa itu data baru
  tidak tampak setelah sinkronisasi.
- `next/font/google` gagal saat build di mesin ini; font di-self-host di `app/fonts/`.
- Saat satu tes Playwright gagal, worker dimulai ulang dan `beforeAll` dijalankan lagi (menghapus user uji). Buat tes yang mandiri.
- Tes integrasi berbagi Redis db 1 dan `analitik_test`; `scope-guard.test.ts` membaca Redis db 0 (data pengembangan) hanya untuk inspeksi.
- Jangan mengedit file `.tsx` besar dengan regex Perl multi-baris; itu pernah menghapus isi empat route. Tulis ulang file utuh atau pakai Edit.
- Pada awal pekerjaan sesi lain (`yta-2e`) sempat menulis file ke folder yang sama; file miliknya dipindahkan ke cadangan di
  direktori scratchpad sesi lama (sudah tidak dipakai). Pastikan hanya satu agent yang menulis ke folder ini.
