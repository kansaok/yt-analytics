# Key Features
### Fase 1 - Fondasi Analitik
#### 1. Integrasi Akun YouTube
- **Deskripsi:** Menghubungkan channel YouTube milik pengguna ke aplikasi untuk mengaktifkan sinkronisasi analitik otomatis.
- **Perilaku utama:**
  - Tombol `Hubungkan YouTube` memicu flow OAuth Google.
  - Setelah consent, sistem mengambil daftar channel yang dapat dikelola user.
  - User memilih 1 channel untuk dihubungkan awal; dapat tambah channel lain kemudian.
- **Aturan bisnis:**
  - Hanya scope least-privilege YouTube read-only (`youtube.readonly`, `yt-analytics.readonly`).
  - Satu koneksi OAuth dapat menaungi banyak channel milik user yang sama.
  - Status koneksi: `connected`, `expired`, `revoked`, `error`.
- **Kasus tepi / validasi:**
  - User menolak scope → tampilkan error dan instruksi ulang tanpa crash.
  - Token expired/revoked → tandai channel `Perlu Re-autentikasi`, hentikan sync.
  - Akun Google tanpa channel → tampilkan pesan kosong dengan CTA buat channel di YouTube.
- **Acceptance criteria:**
  - Selesai kalau user bisa hubungkan channel dalam <3 klik setelah login Google.
  - Selesai kalau channel yang gagal auth menampilkan status dan tombol hubung ulang.
  - Selesai kalau token tidak pernah tampil di client/log.

#### 2. Login OAuth Google
- **Deskripsi:** Autentikasi pengguna aplikasi menggunakan akun Google secara aman.
- **Perilaku utama:**
  - Login via tombol Google, callback memvalidasi ID token dan membuat sesi.
  - User baru otomatis dibuatkan akun aplikasi; user lama langsung masuk.
  - Sesi bertahan dengan refresh token yang aman.
- **Aturan bisnis:**
  - Login aplikasi terpisah dari otorisasi data YouTube, tetapi memakai provider Google yang sama.
  - Wajib HTTPS dan verifikasi `state/nonce` untuk cegah CSRF.
- **Kasus tepi / validasi:**
  - Email belum terverifikasi Google → tolak login dengan pesan jelas.
  - Gagal callback (batal user) → kembali ke halaman login dengan pesan.
- **Acceptance criteria:**
  - Selesai kalau login berhasil membuat sesi dan redirect ke dashboard/channel-picker.
  - Selesai kalau logout menghapus sesi server dan client sepenuhnya.
  - Selesai kalau percobaan callback palsu/kadaluarsa ditolak.

#### 3. Sinkronisasi Data Otomatis
- **Deskripsi:** Menarik views, subscriber, watch time, dan metadata video secara berkala dari YouTube API.
- **Perilaku utama:**
  - Sync awal saat channel pertama dihubungkan: tarik 90 hari terakhir + daftar video.
  - Sync berkala terjadwal (mis. tiap 6 jam) untuk delta harian.
  - Tombol `Sinkron Sekarang` dengan rate-limit per channel.
  - Menampilkan `Terakhir disinkron: HH:MM` di dashboard.
- **Aturan bisnis:**
  - Simpan hanya agregat harian, bukan event mentah, untuk hemat kuota.
  - Prioritaskan channel aktif; backoff eksponensial saat kuota 403/quotaExceeded.
  - Data revenue selalu berlabel `Estimasi`.
- **Kasus tepi / validasi:**
  - Kuota API habis → antrean dijeda, UI tampilkan banner `Sync tertunda`.
  - Channel dihapus/private di YouTube → tandai `Tidak dapat diakses`.
  - Data API null/tertunda (2-3 hari terakhir) → tampilkan sebagai `belum final`.
- **Acceptance criteria:**
  - Selesai kalau sync awal 90 hari selesai dengan indikator progres dan tidak memblokir UI.
  - Selesai kalau sync berkala memperbarui grafik tanpa duplikasi tanggal.
  - Selesai kalau sync manual dibatasi (mis. maks 1x/15 menit/channel) dengan pesan jelas.

#### 4. Manajemen Multi-Channel
- **Deskripsi:** Mengelola dan berpindah antar beberapa channel YouTube dalam satu akun aplikasi.
- **Perilaku utama:**
  - Daftar channel di switcher header/sidebar dengan avatar, nama, status sync.
  - Tambah channel baru, putuskan (`Disconnect`), dan pilih channel aktif.
  - Seluruh dashboard/video memfilter berdasar `channelId` aktif.
- **Aturan bisnis:**
  - Data antar channel terisolasi penuh; tidak ada agregasi lintas channel di MVP kecuali switch manual.
  - Batas MVP mengikuti keputusan produk (default usulan: maks 5 channel/user).
- **Kasus tepi / validasi:**
  - Menghapus channel aktif → otomatis pindah ke channel lain yang tersedia atau state kosong.
  - Channel dengan sync gagal tetap bisa dipilih tetapi tampilkan warning.
- **Acceptance criteria:**
  - Selesai kalau ganti channel <1 detik (dari cache) dan seluruh metrik ikut berubah.
  - Selesai kalau user tidak bisa mengakses channel milik user lain via manipulasi ID.
  - Selesai kalau tambah/hapus channel langsung tercermin di switcher tanpa reload penuh.

#### 5. Dashboard Performa Channel
- **Deskripsi:** Satu tampilan ringkasan kesehatan channel yang visual dan cepat dibaca.
- **Perilaku utama:**
  - Menampilkan kartu metrik, grafik pertumbuhan, dan perbandingan periode untuk `channelId` + rentang tanggal aktif.
  - Mendukung preset: 7H, 28H, 90H, dan kustom.
  - Skeleton loading + empty state saat sync pertama berjalan.
- **Aturan bisnis:**
  - Default rentang: 28 hari terakhir.
  - Semua angka disertai delta vs periode sebelumnya dan timestamp sync.
- **Kasus tepi / validasi:**
  - Channel baru tanpa data → empty state dengan progres sync, bukan angka 0 menyesatkan.
  - Rentang tanggal tanpa data → tampilkan grafik kosong dengan pesan.
- **Acceptance criteria:**
  - Selesai kalau dashboard menampilkan metrik + grafik konsisten dengan filter tanggal/channel yang sama.
  - Selesai kalau perubahan rentang tanggal me-refresh semua komponen dashboard.
  - Selesai kalau tidak ada grafik kosong/error saat data belum siap.

#### 6. Kartu Metrik Utama
- **Deskripsi:** Kartu angka kunci: total views, subscriber baru (net), watch time (jam), estimasi revenue.
- **Perilaku utama:**
  - Tiap kartu: nilai total periode, delta % vs periode lalu, sparkline mini.
  - Tooltip definisi metrik (mis. net subs = gained - lost).
  - Klik kartu memfokuskan grafik utama ke metrik tersebut.
- **Aturan bisnis:**
  - Watch time ditampilkan dalam jam dengan 1 desimal.
  - Revenue selalu dengan label `Estimasi*` dan footnote sumber.
  - Pembulatan konsisten: `1,2rb / 3,4jt`.
- **Kasus tepi / validasi:**
  - Nilai negatif (subs loss) → tampilkan merah dengan tanda minus, bukan 0.
  - Data revenue null → tampilkan `-` + tooltip, bukan 0.
- **Acceptance criteria:**
  - Selesai kalau 4 kartu tampil dengan delta yang benar vs periode pembanding.
  - Selesai kalau klik kartu mengubah metrik grafik utama.
  - Selesai kalau format angka konsisten di semua kartu.

#### 7. Grafik Pertumbuhan
- **Deskripsi:** Grafik garis tren harian interaktif untuk metrik yang dipilih.
- **Perilaku utama:**
  - Sumbu-X tanggal harian, sumbu-Y nilai metrik; hover menampilkan tooltip nilai per hari.
  - Toggle metrik: views/subs/watch time; toggle tampilkan periode pembanding (garis putus-putus).
  - Zoom/pan untuk rentang 90 hari.
- **Aturan bisnis:**
  - Agregasi harian dari `ChannelDailyStats`; tidak menampilkan data per jam di MVP.
  - Titik data yang belum final diberi marker/garis berbeda.
- **Kasus tepi / validasi:**
  - Satu hari bolong → garis terputus (gap), bukan diisi 0 otomatis.
  - >90 titik → tetap responsif via downsampling di client.
- **Acceptance criteria:**
  - Selesai kalau hover menampilkan nilai tanggal yang tepat.
  - Selesai kalau ganti metrik me-render ulang <1 detik dari cache.
  - Selesai kalau periode pembanding tampil sejajar tanggalnya dengan benar.

#### 8. Perbandingan Periode
- **Deskripsi:** Membandingkan performa periode aktif vs periode sebelumnya yang setara.
- **Perilaku utama:**
  - Otomatis: jika periode aktif 28 hari, pembanding 28 hari sebelumnya.
  - Menampilkan delta absolut dan % di kartu dan grafik.
  - Badge naik/turun/stabil dengan warna semantik.
- **Aturan bisnis:**
  - Rumus delta % = `(current - previous)/|previous| * 100%`; jika previous=0 tampilkan `N/A`.
  - Periode kustom membandingkan dengan durasi sama persis mundur ke belakang.
- **Kasus tepi / validasi:**
  - Data pembanding tidak lengkap → tampilkan `Data pembanding tidak lengkap`.
  - Rentang melewati hari ini/masa depan → clamp ke hari ini.
- **Acceptance criteria:**
  - Selesai kalau setiap metrik menampilkan delta % yang terhitung benar.
  - Selesai kalau grafik pembanding selaras jumlah harinya.
  - Selesai kalau kasus previous=0 tidak menghasilkan `Infinity%`.

#### 9. Analitik Video Per Konten
- **Deskripsi:** Lapisan analisis per video berdasar views, CTR, retensi, dan engagement sebagai jembatan ke tabel dan detail.
- **Perilaku utama:**
  - Menyediakan konteks agregat per video dalam periode terpilih.
  - Menjadi sumber untuk tabel, detail, dan ranking (satu definisi metrik).
  - Mendukung sort/filter yang konsisten di semua tampilan video.
- **Aturan bisnis:**
  - Engagement rate = `(like+komentar)/views`; CTR = `klik/impresi`.
  - Shorts dan long-form dibedakan labelnya tetapi tetap dalam satu model.
- **Kasus tepi / validasi:**
  - Video private/deleted setelah sync → beri badge dan kecualikan dari ranking default.
  - Metrik CTR/retensi null untuk video sangat baru → tampilkan `-`.
- **Acceptance criteria:**
  - Selesai kalau definisi views/CTR/retensi/engagement konsisten di tabel, detail, dan ranking.
  - Selesai kalau filter periode channel berlaku sama untuk agregat per video.
  - Selesai kalau video tanpa data tidak merusak perhitungan agregat.

#### 10. Tabel Performa Video
- **Deskripsi:** Daftar semua video dengan kolom performa yang bisa disortir, dicari, dan dipaginasi.
- **Perilaku utama:**
  - Kolom: thumbnail, judul, tanggal publish, views, watch time, like, komentar, CTR, retensi rata-rata, durasi.
  - Search judul, sort semua kolom numerik, paginasi 50 baris/halaman.
  - Klik baris membuka detail statistik video.
- **Aturan bisnis:**
  - Default sort: views tertinggi dalam periode terpilih.
  - Paginasi server-side untuk channel dengan ratusan video.
- **Kasus tepi / validasi:**
  - Judul dengan emoji/karakter khusus → search tetap berfungsi.
  - Channel >500 video → paginasi + search tetap <2 detik.
- **Acceptance criteria:**
  - Selesai kalau sort/search/paginasi bekerja dan total baris sesuai filter.
  - Selesai kalau klik baris selalu membuka detail video yang benar.
  - Selesai kalau tabel responsif di layar kecil tanpa kolom kritis hilang.

#### 11. Detail Statistik Video
- **Deskripsi:** Halaman detail per video untuk CTR thumbnail, retensi audiens, dan traffic source.
- **Perilaku utama:**
  - Header: thumbnail, judul, tanggal publish, durasi, link YouTube.
  - Panel: tren views harian video, kurva retensi (%), breakdown traffic source (donut + tabel), CTR vs impresi.
  - Metrik: views, CTR, avg view duration, retensi rata-rata, like/komentar.
- **Aturan bisnis:**
  - Kurva retensi menampilkan % penonton bertahan per segmen durasi (mis. per 10 detik atau per 1%).
  - Traffic source dikelompokkan: search, suggested, browse, eksternal, lainnya.
- **Kasus tepi / validasi:**
  - Video umur <48 jam → beri label `Data belum stabil`.
  - Retensi/traffic null dari API → tampilkan empty state per panel, bukan halaman error.
- **Acceptance criteria:**
  - Selesai kalau semua panel menampilkan data video yang dipilih (tidak tertukar).
  - Selesai kalau kurva retensi dan donut traffic bisa di-hover untuk nilai pasti.
  - Selesai kalau tombol kembali mempertahankan filter/sort tabel sebelumnya.

#### 12. Ranking Video Terbaik
- **Deskripsi:** Pengurutan video tertinggi/terendah untuk evaluasi cepat konten pemenang dan pecundang.
- **Perilaku utama:**
  - Preset ranking: views tertinggi/terendah, CTR tertinggi, retensi tertinggi, engagement tertinggi.
  - Toggle jumlah: Top 5 / Top 10 / Bottom 5.
  - Aksi `Lihat detail` dari tiap item ranking.
- **Aturan bisnis:**
  - Ranking dihitung dalam periode aktif yang sama dengan dashboard.
  - Video dengan views <100 dapat dikecualikan via toggle `Sembunyikan views kecil` (default on untuk CTR/retensi).
- **Kasus tepi / validasi:**
  - Tie nilai → urutan kedua berdasar views tertinggi.
  - <5 video memenuhi syarat → tampilkan yang ada + pesan.
- **Acceptance criteria:**
  - Selesai kalau setiap preset menghasilkan urutan yang benar dan dapat diverifikasi.
  - Selesai kalau toggle Top/Bottom dan filter views kecil bekerja instan.
  - Selesai kalau klik item ranking membuka detail yang tepat.

### Fase 2 - Audiens dan Laporan
#### 1. Analisis Audiens dan Traffic
- **Deskripsi:** Modul gabungan untuk memahami siapa penonton dan dari mana mereka menemukan video.
- **Perilaku utama:**
  - Tab: Demografi, Waktu Optimal, Sumber Traffic dalam satu filter tanggal/channel.
  - Ringkasan insight tekstual sederhana (non-AI): mis. `62% penonton 18-24 tahun`.
  - Semua chart dapat di-drill ke level video.
- **Aturan bisnis:**
  - Data audiens mengikuti ketersediaan YouTube Analytics API; jika tidak tersedia tampilkan pesan izin/data.
  - Tidak menampilkan data individual penonton, hanya agregat.
- **Kasus tepi / validasi:**
  - Channel kecil dengan data demografi disembunyikan YouTube (privacy threshold) → tampilkan empty state privasi.
  - Periode terlalu pendek (<7 hari) untuk heatmap → beri peringatan akurasi.
- **Acceptance criteria:**
  - Selesai kalau ketiga tab memakai filter tanggal/channel yang sama dan konsisten.
  - Selesai kalau data kosong/terbatas menampilkan pesan privasi, bukan error.
  - Selesai kalau tidak ada PII penonton yang ditampilkan/disimpan.

#### 2. Demografi Penonton
- **Deskripsi:** Breakdown penonton berdasar usia, gender, lokasi (negara), dan perangkat.
- **Perilaku utama:**
  - Chart batang usia x gender, peta/tabel Top Negara, donut perangkat (mobile/desktop/TV/tablet).
  - Tabel Top 10 negara dengan % views dan watch time.
- **Aturan bisnis:**
  - Kelompok usia mengikuti bucket YouTube (`13-17`, `18-24`, dst).
  - Persentase dihitung dari total views periode yang memiliki data demografi.
- **Kasus tepi / validasi:**
  - Total demografi <100% karena sampling/threshold → tampilkan footnote.
  - Gender `unknown` → tampilkan sebagai kategori terpisah, bukan dihapus.
- **Acceptance criteria:**
  - Selesai kalau usia, gender, negara, perangkat tampil dengan % yang menjumlah ~100%.
  - Selesai kalau ganti periode memperbarui semua breakdown.
  - Selesai kalau Top Negara dapat diurutkan berdasar views/watch time.

#### 3. Waktu Tonton Optimal
- **Deskripsi:** Heatmap jam x hari untuk menemukan kapan audiens paling aktif menonton.
- **Perilaku utama:**
  - Matriks 7 hari x 24 jam dengan intensitas warna berdasar views/watch time.
  - Badge `Waktu terbaik: Jumat 19.00` yang dihitung otomatis.
  - Toggle metrik: views vs watch time.
- **Aturan bisnis:**
  - Zona waktu mengikuti zona channel (default WIB jika tak diketahui, tampilkan label zona).
  - Rekomendasi jam dihitung dari rata-rata 4 minggu terakhir, bukan 1 hari anomali.
- **Kasus tepi / validasi:**
  - Data per jam tidak tersedia → fallback ke agregat harian + pesan.
  - Daylight saving/perbedaan zona → selalu tampilkan label zona yang dipakai.
- **Acceptance criteria:**
  - Selesai kalau heatmap menampilkan 7x24 sel dengan tooltip nilai.
  - Selesai kalau badge waktu terbaik sesuai dengan sel nilai tertinggi.
  - Selesai kalau zona waktu ditampilkan eksplisit.

#### 4. Sumber Traffic
- **Deskripsi:** Analisis asal penemuan video: search, suggested, browse, eksternal, dan lainnya.
- **Perilaku utama:**
  - Donut + tabel % views per sumber dengan tren per sumber.
  - Untuk search: daftar kata kunci teratas (jika tersedia dari API).
  - Klik sumber memfilter daftar video penyumbang terbesar untuk sumber itu.
- **Aturan bisnis:**
  - Kategori mengikuti taksonomi YouTube Analytics; `unknown` masuk `Lainnya`.
  - Menampilkan delta % per sumber vs periode lalu.
- **Kasus tepi / validasi:**
  - Keyword search dibatasi API → tampilkan yang tersedia + label `terbatas`.
  - Satu video dominan >80% satu sumber → beri penanda konsentrasi.
- **Acceptance criteria:**
  - Selesai kalau % semua sumber menjumlah 100% dan konsisten dengan total views.
  - Selesai kalau daftar keyword (jika ada) dapat diklik untuk filter.
  - Selesai kalau tren per sumber tampil benar per periode.

#### 5. Laporan dan Ekspor Data
- **Deskripsi:** Kerangka pembuatan laporan siap presentasi dari data dashboard/audiens/video.
- **Perilaku utama:**
  - Pilih template: Ringkasan Channel, Performa Video, Audiens.
  - Preview laporan sebelum unduh/jadwalkan.
  - Riwayat laporan yang pernah dibuat/diunduh.
- **Aturan bisnis:**
  - Laporan selalu mencantumkan periode, channel, dan waktu generate + timestamp sync.
  - Laporan hanya berisi data yang sudah dimiliki user (isolasi channel).
- **Kasus tepi / validasi:**
  - Data periode kosong → laporan tetap dibuat dengan pesan kosong, bukan gagal.
  - Template tidak valid → tolak dengan error validasi.
- **Acceptance criteria:**
  - Selesai kalau preview sama persis dengan hasil unduhan.
  - Selesai kalau setiap laporan mencantumkan metadata periode/channel/waktu.
  - Selesai kalau riwayat laporan tercatat dan dapat diunduh ulang.

#### 6. Ekspor PDF dan Excel
- **Deskripsi:** Mengunduh data dan grafik sebagai PDF dan spreadsheet.
- **Perilaku utama:**
  - Ekspor PDF: ringkasan + grafik + tabel Top Video.
  - Ekspor Excel/CSV: sheet `Ringkasan`, `Harian`, `Video`, `Traffic`.
  - Progress async untuk ekspor besar dengan link unduh kadaluarsa.
- **Aturan bisnis:**
  - Batas MVP: maks 1 tahun data atau 1.000 video per ekspor.
  - Nama file standar: `channel-periode-tipe.ekstensi`.
  - Link unduh private dan kadaluarsa (mis. 7 hari).
- **Kasus tepi / validasi:**
  - Ekspor >30 detik → jadikan job background + notifikasi email/in-app.
  - Grafik gagal render di PDF → tetap ekspor tabel + pesan, tidak gagal total.
- **Acceptance criteria:**
  - Selesai kalau PDF berisi grafik terbaca dan tabel tidak terpotong.
  - Selesai kalau Excel berisi 4 sheet dengan header dan angka yang benar.
  - Selesai kalau file besar diproses async tanpa timeout UI.

#### 7. Laporan Terjadwal
- **Deskripsi:** Pengiriman ringkasan mingguan/bulanan otomatis via email.
- **Perilaku utama:**
  - Form jadwal: frekuensi (mingguan/bulanan), hari kirim, jam, penerima, template, channel.
  - Toggle aktif/nonaktif dan tombol `Kirim test`.
  - Log pengiriman: terkirim/gagal dibuka.
- **Aturan bisnis:**
  - Default mingguan: Senin 08:00 zona channel; bulanan: tgl 1 08:00.
  - Maks penerima mengikuti batas paket (usulan MVP: 5 email/jadwal).
  - Unsubscribe 1-klik wajib di setiap email.
- **Kasus tepi / validasi:**
  - Email bounce/invalid → tandai gagal, jangan retry tanpa batas (maks 3x).
  - Channel disconnect saat jadwal jalan → kirim email pemberitahuan, bukan laporan kosong.
- **Acceptance criteria:**
  - Selesai kalau jadwal mingguan/bulanan terkirim sesuai hari/jam yang diset.
  - Selesai kalau user bisa nonaktif dan unsubscribe bekerja.
  - Selesai kalau log menampilkan status tiap pengiriman.

#### 8. Filter Tanggal Kustom
- **Deskripsi:** Penyaring global data berdasar tanggal, video, dan playlist.
- **Perilaku utama:**
  - Date picker: preset + kustom (from-to) dengan validasi.
  - Filter tambahan: 1 video spesifik, 1 playlist, tipe (long/shorts).
  - Filter tampil persisten di semua halaman hingga diubah/direset.
- **Aturan bisnis:**
  - Rentang maks MVP 365 hari; from tidak boleh > to dan tidak boleh masa depan.
  - Perbandingan otomatis memakai durasi sama seperti aturan Perbandingan Periode.
- **Kasus tepi / validasi:**
  - Playlist kosong/dihapus → tampilkan warning dan reset filter playlist.
  - Video ID tidak milik channel aktif → tolak dengan error akses.
- **Acceptance criteria:**
  - Selesai kalau filter tanggal/video/playlist memengaruhi dashboard, tabel, audiens, dan ekspor secara konsisten.
  - Selesai kalau input tanggal invalid ditolak dengan pesan jelas.
  - Selesai kalau tombol reset mengembalikan ke default 28 hari tanpa filter tambahan.

### Fase 3 - Kompetitor dan AI
#### 1. Analisis Kompetitor
- **Deskripsi:** Modul untuk memantau dan membandingkan performa dengan channel sejenis memakai data publik.
- **Perilaku utama:**
  - Tambah kompetitor via URL/handle/ID channel.
  - Daftar pantauan dengan ringkasan subs, views, jumlah video, tren 30 hari.
  - Navigasi ke tracking, head-to-head, dan deteksi viral.
- **Aturan bisnis:**
  - Hanya data publik YouTube Data API; tidak ada data privat/retensi kompetitor.
  - Batas MVP mengikuti keputusan produk (usulan: maks 5 kompetitor/channel).
  - Snapshot harian, bukan real-time.
- **Kasus tepi / validasi:**
  - Handle tidak ditemukan/private → error jelas, tidak ditambahkan.
  - Kompetitor menghapus video → snapshot menyesuaikan dengan penanda.
- **Acceptance criteria:**
  - Selesai kalau tambah/hapus kompetitor via URL/handle/ID bekerja.
  - Selesai kalau daftar menampilkan metrik publik yang akurat per snapshot terakhir.
  - Selesai kalau tidak ada klaim metrik privat kompetitor di UI.

#### 2. Tracking Channel Kompetitor
- **Deskripsi:** Pemantauan pertumbuhan subscriber dan views kompetitor dari waktu ke waktu.
- **Perilaku utama:**
  - Grafik tren subs dan views per kompetitor (30/90 hari snapshot).
  - Tabel pertumbuhan: +subs, +views, rata-rata views/video.
  - Alert sederhana: lonjakan di atas threshold.
- **Aturan bisnis:**
  - Snapshot 1x/hari per kompetitor untuk hemat kuota.
  - Angka subs mengikuti pembulatan publik YouTube dan diberi label `publik`.
- **Kasus tepi / validasi:**
  - Snapshot bolong 1 hari → tampilkan gap, bukan 0.
  - Kompetitor dengan subs disembunyikan → tampilkan `-` + tooltip.
- **Acceptance criteria:**
  - Selesai kalau tren 30/90 hari tampil dari snapshot harian tanpa data palsu.
  - Selesai kalau tabel pertumbuhan terhitung benar dari selisih snapshot.
  - Selesai kalau penambahan kompetitor baru mulai menampilkan tren setelah snapshot pertama + label menunggu.

#### 3. Perbandingan Head-to-Head
- **Deskripsi:** Perbandingan side-by-side metrik utama channel sendiri vs 1 kompetitor.
- **Perilaku utama:**
  - Pilih 1 kompetitor pembanding; tampilkan kolom Saya vs Kompetitor + delta.
  - Metrik: subs total, views 30 hari, jumlah video, rata-rata views/video, frekuensi upload.
  - Grafik overlay pertumbuhan views/subs.
- **Aturan bisnis:**
  - Hanya metrik publik yang dapat dibandingkan; metrik privat (watch time, CTR, revenue) dikecualikan dengan penjelasan.
  - Periode perbandingan fixed 30 hari terakhir snapshot.
- **Kasus tepi / validasi:**
  - Kompetitor tanpa cukup snapshot → tampilkan perbandingan parsial + warning.
  - Channel sendiri belum sync → blokir perbandingan dengan CTA sync.
- **Acceptance criteria:**
  - Selesai kalau tabel side-by-side menampilkan metrik yang sebanding secara apple-to-apple.
  - Selesai kalau metrik privat tidak pernah muncul untuk kompetitor.
  - Selesai kalau overlay grafik memakai skala dan tanggal yang selaras.

#### 4. Deteksi Video Viral
- **Deskripsi:** Penemuan video kompetitor bertumbuh tercepat sebagai inspirasi konten.
- **Perilaku utama:**
  - Daftar video kompetitor diurutkan berdasar views, velocity (views/hari), dan rasio views/subs.
  - Filter: periode publish (7/30/90 hari), min views.
  - Klik membuka metadata publik + link YouTube (tanpa data privat).
- **Aturan bisnis:**
  - Velocity = `(views saat ini - views snapshot pertama)/umur snapshot`; bukan prediksi, hanya observasi.
  - Beri label `Pantau` dan tombol simpan sebagai ide (tanpa scraping komentar).
- **Kasus tepi / validasi:**
  - Video Shorts vs long-form → beri label agar velocity tidak dibandingkan mentah.
  - Views stagnan (velocity 0) → tetap tampil di bawah dengan penjelasan.
- **Acceptance criteria:**
  - Selesai kalau sort berdasar velocity menghasilkan urutan terverifikasi benar.
  - Selesai kalau filter periode publish/min views bekerja.
  - Selesai kalau detail hanya menampilkan data publik + link keluar.

#### 5. Insight AI dan Rekomendasi
- **Deskripsi:** Lapisan rekomendasi konten berbasis pola data historis channel.
- **Perilaku utama:**
  - Pintu masuk tunggal: panel `Insight AI` di dashboard dengan kartu rekomendasi.
  - Tiap rekomendasi mencantumkan dasar data (video/metrik pendukung) dan tingkat keyakinan.
  - Feedback thumbs up/down per rekomendasi untuk tuning.
- **Aturan bisnis:**
  - Tidak menjanjikan hasil pasti; semua bahasa memakai `berpotensi`, bukan `dijamin`.
  - Rekomendasi hanya dari data milik user + data publik; tidak ada klaim data privat kompetitor.
  - Butuh minimal data (usulan: 10 video + 28 hari) atau tampilkan state data belum cukup.
- **Kasus tepi / validasi:**
  - Data belum cukup → tampilkan checklist syarat, bukan insight kosong.
  - Output LLM tidak valid/aman → fallback ke template rule-based + log.
- **Acceptance criteria:**
  - Selesai kalau setiap rekomendasi menampilkan dasar data dan disclaimer ketidakpastian.
  - Selesai kalau state data belum cukup muncul saat syarat tidak terpenuhi.
  - Selesai kalau feedback tersimpan dan memengaruhi urutan berikutnya (atau dicatat).

#### 6. Ringkasan Insight Otomatis
- **Deskripsi:** Penjelasan naik-turun performa dalam bahasa natural Indonesia yang mudah dibagikan.
- **Perilaku utama:**
  - Paragraf otomatis: `Views naik 18% karena 2 video X,Y...` dengan highlight angka.
  - Tombol regenerate, salin, dan sisipkan ke laporan.
  - Riwayat insight per periode.
- **Aturan bisnis:**
  - Wajib menyebut periode, delta %, dan 2-3 pendorong utama yang terverifikasi dari data.
  - Jika anomali tidak dapat dijelaskan, tulis `penyebab belum konklusif`.
- **Kasus tepi / validasi:**
  - Data flat/tidak berubah → hasilkan ringkasan stabil, bukan halusinasi penyebab.
  - Regenerate berulang → batasi (mis. 5x/hari/channel) untuk kendali biaya LLM.
- **Acceptance criteria:**
  - Selesai kalau ringkasan menyebut angka yang sama dengan dashboard untuk periode yang sama.
  - Selesai kalau tombol salin/sisip ke laporan bekerja.
  - Selesai kalau tidak ada klaim penyebab yang tidak didukung data.

#### 7. Saran Judul dan Topik
- **Deskripsi:** Rekomendasi topik, judul alternatif, dan tag dari keyword berperforman tinggi.
- **Perilaku utama:**
  - Input: pilih 1 video/channel; output: 5-10 ide judul + skor, keyword pendukung, saran tag.
  - Tampilkan alasan: keyword dengan CTR/retensi/views tinggi.
  - Tombol salin dan simpan ke daftar ide.
- **Aturan bisnis:**
  - Skor bersifat relatif internal (mis. 0-100) dengan tooltip cara baca, bukan janji views.
  - Hindari judul clickbait menyesatkan; beri peringatan jika pola berisiko.
  - Tag mengikuti batas YouTube (maks 500 karakter).
- **Kasus tepi / validasi:**
  - Keyword bervolume kecil → beri label `data terbatas`.
  - Output duplikat judul yang sudah ada → tandai `sudah pernah dipakai`.
- **Acceptance criteria:**
  - Selesai kalau tiap saran menampilkan skor + keyword dasarnya.
  - Selesai kalau daftar tag tidak melebihi batas karakter YouTube.
  - Selesai kalau judul yang sudah dipakai channel ditandai.

#### 8. Prediksi Performa Video
- **Deskripsi:** Estimasi potensi views video baru berdasar data historis channel.
- **Perilaku utama:**
  - Form input: judul/topik rencana, durasi rencana, tipe (long/shorts), jadwal publish.
  - Output: rentang prediksi (low-mid-high), faktor pendorong/penahan, video pembanding.
  - Penanda eksperimental di seluruh UI prediksi.
- **Aturan bisnis:**
  - Selalu rentang + interval keyakinan, tidak pernah angka tunggal pasti.
  - Model hanya memakai histori channel sendiri; lintas-channel tidak dicampur.
  - Butuh minimal histori (usulan: 20 video) atau tolak dengan pesan.
- **Kasus tepi / validasi:**
  - Input di luar distribusi histori (mis. durasi 3x lipat) → tampilkan warning ekstrapolasi.
  - Histori didominasi 1 video viral outlier → normalisasi dan beri footnote.
- **Acceptance criteria:**
  - Selesai kalau prediksi menampilkan rentang low-mid-high + faktor + pembanding.
  - Selesai kalau label eksperimental dan disclaimer selalu tampil.
  - Selesai kalau histori kurang memicu penolakan halus dengan syarat yang jelas.