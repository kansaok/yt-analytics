# Fase 2 - Saya mau buat aplikasi untuk Youtube Analitic

Tandai `[x]` hanya kalau kriteria task benar-benar terpenuhi.

## Analisis Audiens dan Traffic
Memahami siapa penonton dan dari mana mereka menemukan video Anda.

### Demografi Penonton
Menampilkan breakdown usia, gender, lokasi, dan perangkat penonton.

- [x] **Implementasi Route Handler dan cache demografi penonton**
  - Kriteria: Selesai kalau GET /api/channels/:id/audience-demographics mengembalikan persentase usia gender lokasi dan perangkat dari PostgreSQL via Prisma dengan cache Redis 24 jam
- [x] **Bangun UI kartu breakdown demografi responsif**
  - Kriteria: Selesai kalau halaman audiens menampilkan donat usia gender dan bar lokasi perangkat memakai shadcn dan Recharts dengan kartu radius 14px dan lolos cek visual terang-gelap Gaya Laut

### Waktu Tonton Optimal
Menampilkan hari saat audiens paling aktif menonton. Versi per jam tidak tersedia dari YouTube (keputusan PO opsi A, 7 Nov 2026).

- [x] **Implementasi agregasi heatmap waktu tonton optimal**
  - Kriteria (direvisi sesuai keputusan PO 7 Nov 2026): Selesai kalau GET /api/channels/:id/watch-heatmap mengembalikan rata-rata views dan watch time per hari dalam minggu (7 hari) dari data harian tersinkron via Prisma, menyatakan `hourlyAvailable: false` dan `matrix: null`, mengecualikan hari yang belum final, dan tidak menyorot hari terbaik bila nilai seri
  - Kriteria asli (matriks 7x24, cache Redis harian) tidak dapat dipenuhi: YouTube Analytics hanya punya dimensi `day` dan `month`. Lihat docs/DECISIONS.md.
  - Bukti: tests/integration/audience.test.ts (rata-rata per hari, 3 hari terakhir tidak ikut, hari terbaik, seri, channel kosong, 403 user lain) lulus.
- [x] **Bangun UI heatmap jam dan hari aktif**
  - Kriteria (direvisi sesuai keputusan PO 7 Nov 2026): Selesai kalau tab "Waktu optimal" menampilkan strip 7 hari dengan tooltip, nilai tertulis di tiap hari, penanda "Hari terbaik", dan pemberitahuan bahwa data per jam tidak tersedia, dalam gaya Gaya Laut terang-gelap tanpa error TypeScript; tanpa ECharts
  - Bukti: components/audience/heat-strip.tsx; tests/e2e/fase2.spec.ts memeriksa teks "Hari terbaik" dan 7 item strip; lint dan tsc bersih.

### Sumber Traffic
Menganalisis asal views dari search, suggested, browse, dan eksternal.

- [x] **Implementasi API sumber traffic views**
  - Kriteria: Selesai kalau GET /api/channels/:id/traffic-sources mengembalikan proporsi views search suggested browse dan eksternal yang totalnya 100 persen dari data sinkron terakhir
- [x] **Bangun UI donat dan tabel sumber traffic**
  - Kriteria: Selesai kalau halaman traffic menampilkan donat Recharts dan tabel persentase search suggested browse eksternal memakai ikon Phosphor dan gaya Gaya Laut terang-gelap

## Laporan dan Ekspor Data
Membuat dan membagikan laporan performa channel dalam format yang siap presentasi.

### Ekspor PDF dan Excel
Mengunduh data analitik dan grafik dalam format PDF atau spreadsheet.

- [x] **Tandai Ekspor PDF dan Excel sebagai backlog Fase 2 tanpa implementasi MVP**
  - Kriteria: Selesai kalau audit repo Nextjs Prisma membuktikan tidak ada Route Handler unduhan PDF atau Excel yang aktif untuk MVP

### Laporan Terjadwal
Mengirim ringkasan performa mingguan atau bulanan otomatis via email.

- [x] **Cegah Laporan Terjadwal di MVP dan dokumentasikan sebagai backlog Fase 2**
  - Kriteria: Selesai kalau inspeksi antrean BullMQ dan Redis Upstash membuktikan tidak ada job terjadwal pengirim ringkasan mingguan atau bulanan yang berjalan

### Filter Tanggal Kustom
Menyaring semua data berdasarkan rentang tanggal, video, atau playlist tertentu.

- [x] **Batasi Filter Tanggal Kustom Fase 2 dan pertahankan hanya perbandingan periode dasar MVP**
  - Kriteria: Selesai kalau pengujian dashboard Recharts membuktikan hanya pilihan periode dasar MVP yang tampil tanpa filter rentang kustom video atau playlist lanjutan

