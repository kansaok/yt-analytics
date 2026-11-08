# User Journey
## Skenario 1 - Daftar, Hubungkan YouTube, dan Sinkronisasi Awal
**Aktor:** Kreator baru (belum punya channel terhubung). **Tujuan:** login dan mendapatkan dashboard terisi dari 90 hari terakhir.
1. **Aktor:** Membuka web app dan klik `Daftar / Masuk dengan Google`.
   **Sistem:** Redirect ke consent screen Google OAuth dengan scope YouTube read-only yang diminta.
2. **Aktor:** Menyetujui scope dan memilih Akun Google.
   **Sistem:** Membuat sesi user, menyimpan token terenkripsi, lalu menampilkan halaman `Pilih Channel` berisi daftar channel yang dimiliki akun tersebut.
3. **Aktor:** Memilih satu channel dan klik `Hubungkan`.
   **Sistem:** Menyimpan relasi user-channel, menampilkan status `Sinkronisasi awal berjalan...` dan menjalankan job sinkronisasi: daftar video + agregat harian views, subscriber, watch time 90 hari terakhir.
4. **Aktor:** Menunggu / menjelajah halaman status sinkronisasi.
   **Sistem:** Menampilkan progres (misal: `Mengambil video 120/350...`, `Menghitung statistik harian...`), lalu redirect otomatis ke Dashboard saat batch pertama selesai. Menampilkan timestamp `Terakhir disinkron: <waktu>` dan label `Data 90 hari terakhir`.
5. **Aktor:** Jika punya >1 channel, klik `Tambah Channel` dari switcher channel di header.
   **Sistem:** Mengulang langkah 2-4 untuk channel tambahan tanpa logout, dan menyimpan channel aktif terakhir per user.
### Jalur Gagal / Error Skenario 1
- **Menolak scope / menutup consent:** Sistem kembali ke halaman login dengan pesan `Akses YouTube diperlukan untuk menampilkan analitik. Coba lagi.` dan tombol `Hubungkan YouTube` tetap terlihat.
- **Tidak ada channel / scope kurang:** Sistem menampilkan empty state `Tidak ada channel ditemukan pada akun ini. Pastikan login dengan akun pemilik channel.` + tombol `Ganti Akun Google`.
- **Token revoke / expired saat sync:** Sistem menandai channel `Butuh Re-autentikasi`, menampilkan banner `Koneksi terputus. Hubungkan ulang.` dan menonaktifkan refresh otomatis sampai user re-OAuth.
- **Kuota YouTube API habis / sync gagal sebagian:** Sistem menampilkan `Sinkronisasi sebagian berhasil. Coba lagi dalam X menit.` dengan tombol `Coba Lagi`, tidak mengosongkan data yang sudah masuk.
### State Kosong Skenario 1
- **Belum hubungkan channel:** Dashboard tidak menampilkan grafik, hanya kartu onboarding `Hubungkan YouTube untuk mulai` + ilustrasi dan CTA.
- **Sinkronisasi berjalan:** Kartu metrik menampilkan skeleton loading, grafik menampilkan pesan `Menyiapkan data...`, tabel video menampilkan `Sedang memuat daftar video`.

## Skenario 2 - Pantau Performa Channel Harian dan Perbandingan Periode
**Aktor:** YouTuber / tim kreator yang sudah punya 1+ channel terhubung. **Tujuan:** jawab `Naik atau turun minggu ini?`
1. **Aktor:** Membuka `Dashboard` dengan channel aktif terpilih.
   **Sistem:** Menampilkan kartu metrik utama: total views, subscriber baru, watch time, estimasi revenue untuk rentang default 28 hari + grafik pertumbuhan harian interaktif.
2. **Aktor:** Mengganti rentang tanggal via date picker (7/28/90 hari atau kustom) dan switcher channel jika perlu.
   **Sistem:** Memuat ulang agregat dari cache harian untuk `channelId+from+to` dalam <3 detik, update semua kartu dan grafik, menyimpan preferensi rentang terakhir.
3. **Aktor:** Mengaktifkan toggle `Bandingkan dengan periode sebelumnya`.
   **Sistem:** Menampilkan garis pembanding + delta % per kartu (misal: `Views +12,4% vs 28 hari sebelumnya`) dan tooltip per titik tanggal dengan nilai saat ini vs sebelumnya.
4. **Aktor:** Hover / klik titik grafik untuk detail harian.
   **Sistem:** Menampilkan tooltip nilai harian dan tombol `Lihat video terbit hari itu` yang memfilter tabel video berdasar tanggal publish.
### Jalur Gagal / Error Skenario 2
- **Rentang tanpa data (channel baru / tanggal sebelum channel dibuat):** Sistem menampilkan grafik kosong dengan pesan `Belum ada data pada rentang ini.` dan saran `Coba 7 hari terakhir.` Kartu menampilkan `0` dengan label `-`.
- **Data tertunda dari YouTube Analytics:** Sistem tetap menampilkan data cache dengan badge `Estimasi / Tertunda` dan tooltip `Data revenue/retensi dapat terlambat 24-48 jam. Terakhir disinkron: <waktu>`.
- **Ganti channel saat sync channel lain berjalan:** Sistem langsung menampilkan data cache channel yang dipilih, tidak memblokir UI, dengan indikator sync terpisah per channel.
### State Kosong Skenario 2
- **Channel baru 0 subscriber / 0 views:** Kartu menampilkan `0`, grafik garis datar dengan pesan panduan `Upload video pertama, data akan muncul setelah sinkronisasi berikutnya.`

## Skenario 3 - Evaluasi Video Per Konten untuk Keputusan Topik Berikutnya
**Aktor:** Kreator / agensi. **Tujuan:** temukan format terbaik/terburuk untuk menentukan topik berikutnya.
1. **Aktor:** Membuka menu `Video` / `Analitik Video`.
   **Sistem:** Menampilkan tabel performa video untuk channel + rentang aktif: thumbnail, judul, tanggal publish, views, like, komentar, durasi tonton rata-rata, dengan paginasi 50 baris dan sortir default views tertinggi.
2. **Aktor:** Mensortir views terendah, atau mencari judul via search, atau mengurutkan berdasar retensi/CTR.
   **Sistem:** Menerapkan sort/search di server, update URL query agar bisa dibagikan, menampilkan badge `Terbaik #1-3` dan `Terendah` saat mode ranking aktif.
3. **Aktor:** Mengklik satu baris video untuk membuka halaman `Detail Statistik Video`.
   **Sistem:** Menampilkan header video + 3 blok: CTR thumbnail (impresi vs klik), retensi audiens (kurva %), dan traffic source (search, suggested, browse, eksternal) sesuai periode yang sama dengan dashboard.
4. **Aktor:** Membandingkan 2-3 video terbaik vs terburuk dengan tombol `Bandingkan` atau kembali ke tabel ranking.
   **Sistem:** Menampilkan tabel perbandingan side-by-side dan highlight pola (misal: `Retensi >50%`, `CTR >6%`) untuk membantu keputusan. Aktor mencatat topik dengan retensi tertinggi sebagai backlog konten berikutnya.
### Jalur Gagal / Error Skenario 3
- **Video private/deleted/unlisted setelah sync:** Sistem menampilkan label status video `Tidak tersedia` di tabel, detail menampilkan pesan `Statistik terakhir tersedia hingga <tanggal>. Video tidak dapat diputar.` tanpa menghapus historis.
- **Detail CTR/retensi belum tersedia (video baru <48 jam):** Blok terkait menampilkan `Data belum cukup. Kembali lagi setelah 1-2 hari.` sedangkan views/like dasar tetap tampil.
- **Filter/search tanpa hasil:** Sistem menampilkan empty state `Tidak ada video cocok dengan "kata kunci" pada rentang ini.` + tombol `Reset Filter`.
### State Kosong Skenario 3
- **Channel belum punya video publik:** Tabel menampilkan `Belum ada video disinkronkan.` + CTA `Sinkron Ulang` dan panduan cek visibilitas video di YouTube Studio.