# Scope
## Termasuk MVP
### S1. Login OAuth Google + Pilih Channel + Multi-Channel
- **Cakupan:** Login via akun Google, persetujuan scope YouTube read-only, list channel yang dimiliki user, pilih 1 channel aktif, tambah/hapus channel, beralih channel tanpa login ulang.
- **Alasan:** Fondasi akses data; tanpa ini tidak ada data yang bisa dianalisis. Multi-channel wajib karena target agensi dan kreator dengan >1 channel.
- **Batas selesai:** User bisa hubungkan ≥2 channel, token tersimpan terenkripsi, revoke menghapus akses dan menghentikan sync.

### S2. Sinkronisasi Views / Subscriber / Watch Time
- **Cakupan:** Sync awal 90 hari terakhir untuk channel terpilih + sync berkala harian untuk metrik agregat channel dan daftar video. Tampilkan status dan waktu sync terakhir.
- **Alasan:** Tiga metrik inti untuk keputusan konten harian tanpa analisis manual di YouTube Studio.
- **Batas selesai:** Data tampil di dashboard maksimal setelah 1x sync berhasil; kegagalan API menampilkan error dan retry, bukan data kosong tanpa penjelasan.

### S3. Dashboard Performa Channel
- **Cakupan:** Kartu metrik utama (total views, subscriber baru, watch time, estimasi revenue berlabel Estimasi), grafik pertumbuhan harian interaktif (line chart), perbandingan periode (periode saat ini vs periode sebelumnya yang sama panjang).
- **Alasan:** Memberi gambaran satu layar yang tidak tersedia secara ringkas di YouTube Studio.
- **Batas selesai:** Mendukung filter rentang 7/28/90 hari dan custom range, perbandingan menampilkan delta % naik/turun.

### S4. Analitik Per Video
- **Cakupan:** Tabel performa video (judul, tanggal publish, views, like, komentar, watch time) dengan sort, search, dan paginasi 50 baris; halaman detail per video berisi CTR thumbnail, retensi audiens rata-rata, dan traffic source utama; ranking terbaik/terburuk berdasar views, CTR, dan retensi.
- **Alasan:** Keputusan topik berikutnya bergantung pada evaluasi per konten, bukan hanya agregat channel.
- **Batas selesai:** Klik baris tabel membuka detail; data CTR/retensi sesuai yang tersedia dari YouTube Analytics API, jika kosong tampilkan N/A + tooltip.

## Di Luar Scope
### O1. Aplikasi Mobile Native, Upload/Edit Video, Manajemen Komentar
- **Alasan dikecualikan:** Fokus MVP adalah analitik web baca-saja. Upload/edit dan moderasi komentar adalah domain YouTube Studio, menambah kompleksitas upload, editor, dan notifikasi tanpa nilai analitik.

### O2. Analisis Kompetitor
- **Alasan dikecualikan:** Butuh pipeline data publik terpisah dan kuota API tambahan. Ditunda ke Fase 3 agar MVP tidak terhambat.

### O3. Laporan Terjadwal dan Ekspor PDF/Excel Lanjutan
- **Alasan dikecualikan:** Butuh layanan file, template laporan, dan email scheduler. MVP cukup lihat data di layar dengan filter tanggal kustom. Ditunda ke Fase 2.

### O4. Fitur AI (Insight Otomatis, Saran Judul/Topik, Prediksi Performa)
- **Alasan dikecualikan:** Butuh integrasi LLM, evaluasi akurasi, dan biaya inferensi. Ditunda ke Fase 3 setelah data fondasi stabil.

### O5. Monetisasi Ads, Integrasi TikTok/Instagram, Billing Langganan Penuh
- **Alasan dikecualikan:** Monetisasi ads detail dan multi-platform memperluas scope API dan model data. Billing penuh tidak diperlukan sebelum validasi nilai MVP; cukup batasan sederhana per akun.

## Asumsi dan Batasan
### Asumsi
- A1. Data hanya berasal dari YouTube Data API v3 + YouTube Analytics API resmi dengan scope least-privilege read-only.
- A2. User memiliki channel YouTube aktif dan hak owner/manager atas channel yang dihubungkan.
- A3. Retensi historis MVP adalah 90 hari terakhir saat koneksi awal; data sebelumnya tidak di-backfill kecuali diminta manual.
- A4. Estimasi revenue hanya tampil jika channel monetisasi dan API mengembalikan data; selalu berlabel Estimasi + timestamp sync.

### Batasan
- B1. Platform hanya web responsif desktop-first; tidak ada jaminan UX setara aplikasi native di mobile.
- B2. Sinkronisasi tunduk pada kuota YouTube API; sync berkala dijadwalkan dan di-cache, bukan real-time per request.
- B3. Jumlah channel per user dibatasi untuk MVP (default maks 5) untuk menjaga kuota dan performa.
- B4. Tidak ada tulis ke YouTube (upload, edit metadata, balas komentar, hapus video) dari aplikasi MVP.

## Larangan Penambahan Tanpa Persetujuan
AI coding agent **DILARANG** menambahkan hal berikut tanpa persetujuan tertulis Product Owner:
- Endpoint atau UI untuk upload video, edit judul/deskripsi/thumbnail ke YouTube, dan CRUD komentar.
- Build mobile native (React Native/Flutter) atau wrapper WebView yang dipublikasi ke store.
- Modul kompetitor, tracking channel lain, deteksi viral, dan perbandingan head-to-head.
- Tombol ekspor PDF/Excel, penjadwalan email laporan, dan worker laporan.
- Integrasi LLM, ringkasan insight otomatis, saran topik/judul, dan prediksi views.
- Integrasi TikTok/Instagram, dashboard ads, dan sistem billing/subscription (Stripe/Xendit/Midtrans).
- Scope OAuth baru di luar read-only analitik (misal `youtube.upload`, `youtube.force-ssl` untuk komentar) atau penyimpanan token tanpa enkripsi.