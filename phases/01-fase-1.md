# Fase 1 - Saya mau buat aplikasi untuk Youtube Analitic

Tandai `[x]` hanya kalau kriteria task benar-benar terpenuhi.

## Integrasi Akun YouTube
Menghubungkan channel YouTube via OAuth untuk sinkronisasi data analitik otomatis.

### Login OAuth Google
Autentikasi aman dan pemilihan channel YouTube yang akan dianalisis.

- [x] **Konfigurasi NextAuth.js Google Provider dengan scope YouTube**
  - Kriteria: Selesai kalau login Google berhasil menyimpan access_token dan refresh_token terenkripsi via Prisma di PostgreSQL Supabase dan sesi tetap valid setelah token di-refresh.
- [x] **Bangun UI login dan pemilihan channel gaya Laut**
  - Kriteria: Selesai kalau halaman login menampilkan daftar channel YouTube pengguna dengan font Plus Jakarta Sans, radius 10px, Phosphor Icons regular, dan channel yang dipilih tersimpan sebagai channel aktif dalam mode terang dan gelap.

### Sinkronisasi Data Otomatis
Menarik data views, subscriber, dan watch time via YouTube API secara berkala.

- [x] **Implementasi Route Handler sinkronisasi dan job BullMQ berkala**
  - Kriteria: Selesai kalau job BullMQ berhasil menarik views, subscriber, dan watch time via YouTube API dan menyimpannya sebagai time-series harian di PostgreSQL tanpa error.
- [x] **Implementasi cache Redis Upstash dan penanganan kuota API**
  - Kriteria: Selesai kalau metrik harian tersaji dari cache Redis dalam waktu di bawah 500ms dan job otomatis retry dengan backoff saat kuota YouTube API tercapai.

### Manajemen Multi-Channel
Menambah dan beralih antar beberapa channel dalam satu akun.

- [x] **Perluas skema Prisma untuk relasi user ke multi-channel**
  - Kriteria: Selesai kalau satu user dapat menyimpan minimal 3 channel terhubung dengan satu channel aktif yang relasinya terverifikasi di Supabase Studio.
- [x] **Bangun UI tambah dan switcher multi-channel**
  - Kriteria: Selesai kalau pengguna dapat menambah channel baru via OAuth dan beralih antar channel dalam waktu di bawah 2 detik dengan data dashboard ikut berganti dalam mode terang dan gelap.
  - Bukti (8 Nov 2026, Google asli): akun Google kedua dihubungkan lewat "Hubungkan akun Google lain"; channel "KJ" tersimpan dan selesai sinkron (88 hari statistik, 12 video, ACTIVE) di samping channel pertama. Pergantian channel < 2 detik dikonfirmasi PO lewat uji manual di UI (angka milidetik tidak dicatat). Uji otomatis dengan mock: 109-150 ms.

## Dashboard Performa Channel
Menampilkan ringkasan metrik utama channel dalam satu tampilan visual yang mudah dipahami.

### Kartu Metrik Utama
Menampilkan total views, subscriber baru, watch time, dan estimasi revenue.

- [x] **Implementasi Route Handler agregat metrik channel dengan Prisma dan cache Upstash**
  - Kriteria: Selesai kalau GET /api/channels/[id]/metrics dengan query from dan to mengembalikan total views, subscriber baru, watch time, dan estimasi revenue dari PostgreSQL Supabase dan hit kedua tercatat sebagai cache hit di Redis Upstash.
- [x] **Bangun komponen Kartu Metrik Utama dengan shadcn/ui Gaya Laut**
  - Kriteria: Selesai kalau dashboard menampilkan empat kartu tanpa shadow dengan radius 14px, font Plus Jakarta Sans, ikon Phosphor regular, palet terang #EDF4F5 dan #0E4D5C serta tampilan dark mode tetap terbaca saat diverifikasi manual.

### Grafik Pertumbuhan
Visualisasi tren harian performa channel dalam grafik garis interaktif.

- [x] **Implementasi API time-series harian untuk grafik pertumbuhan**
  - Kriteria: Selesai kalau GET /api/channels/[id]/timeseries mengembalikan larik harian tanggal, views, watch time, dan subscriber baru yang terurut kronologis dan konsisten dengan total agregat untuk rentang yang sama.
- [x] **Bangun grafik garis interaktif dengan Recharts dan Tailwind**
  - Kriteria: Selesai kalau komponen GrowthChart merender grafik garis interaktif dengan tooltip, legend, dan state loading kosong yang mengikuti radius 14px, warna garis #0E4D5C dan aksen #A84A14, serta lolos uji dark mode dan resize mobile.

### Perbandingan Periode
Membandingkan performa periode saat ini dengan periode sebelumnya.

- [x] **Tambahkan logika perbandingan periode current vs previous di API metrik**
  - Kriteria: Selesai kalau respons API metrik menyertakan nilai periode sebelumnya beserta delta absolut dan persen untuk rentang 7, 28, dan 90 hari yang terbukti benar lewat unit test Vitest.
- [x] **Bangun UI pemilih rentang dan badge delta perbandingan periode**
  - Kriteria: Selesai kalau pengguna dapat memilih rentang 7 atau 28 atau 90 hari dan melihat badge naik turun dengan ikon Phosphor regular dan angka persen yang sesuai dengan data API pada kartu metrik dan grafik tanpa reload penuh.

## Analitik Video Per Konten
Menganalisis performa tiap video berdasarkan views, CTR, retensi, dan engagement.

### Tabel Performa Video
Daftar semua video dengan metrik views, like, komentar, dan durasi tonton.

- [x] **Buat API daftar performa video dengan Prisma dan Redis cache**
  - Kriteria: Selesai kalau GET /api/channels/[id]/videos mengembalikan views, like, komentar, dan watch time dengan pagination dan terbukti ada cache hit di Redis Upstash.
- [x] **Bangun UI Tabel Performa Video dengan shadcn/ui**
  - Kriteria: Selesai kalau halaman Next.js menampilkan tabel sortable views/like/komentar dengan gaya Gaya Laut radius 14px tanpa shadow dan lolos cek mode terang dan gelap.

### Detail Statistik Video
Halaman detail berisi CTR thumbnail, retensi audiens, dan traffic source per video.

- [x] **Buat API detail statistik video CTR retensi traffic source**
  - Kriteria: Selesai kalau GET /api/videos/[id]/stats mengembalikan CTR thumbnail, deret retensi audiens, dan traffic source dari PostgreSQL Supabase dengan respons kurang dari 500ms saat cache hit.
- [x] **Bangun halaman detail video dengan grafik Recharts**
  - Kriteria: Selesai kalau halaman detail Next.js menampilkan angka CTR, kurva retensi, dan chart traffic source dengan font Plus Jakarta Sans dan ikon Phosphor yang tampil benar di mode terang dan gelap.

### Ranking Video Terbaik
Mengurutkan video dengan performa tertinggi dan terendah untuk evaluasi konten.

- [x] **Buat API ranking video terbaik dan terburuk**
  - Kriteria: Selesai kalau GET /api/channels/[id]/videos/ranking?sort=views&order=desc mengembalikan daftar terurut benar dari tertinggi ke terendah dan sebaliknya sesuai parameter.
- [x] **Bangun UI ranking video terbaik-terburuk**
  - Kriteria: Selesai kalau komponen Next.js menampilkan daftar 5 teratas dan 5 terbawah dengan badge peringkat dan kartu putih radius 14px yang lolos cek visual Gaya Laut terang dan gelap.

