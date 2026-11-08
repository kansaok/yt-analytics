# Product Summary
## Latar Belakang Masalah
- Kreator dan agensi mengandalkan YouTube Studio yang terfragmentasi: metrik channel, video, audiens, dan traffic source tersebar di banyak tab dan sulit dibandingkan antar periode.
- Analisis manual memakan waktu: mengekspor CSV, menggabungkan views/subscriber/watch time/CTR/retensi, dan menyusun ranking video terbaik/terburuk dilakukan berulang setiap minggu.
- Keputusan konten menjadi reaktif: sulit menjawab cepat pertanyaan seperti video mana yang mendorong subscriber, kapan audiens aktif, dan topik apa yang layak diulang.
- Pengelola multi-channel (tim dan agensi) tidak punya satu tampilan terpusat untuk beralih antar channel dan memantau pertumbuhan harian secara konsisten.
## Tujuan Produk
- Menyediakan analitik YouTube terpusat, visual, dan actionable untuk performa channel, video, audiens, kompetitor, dan rekomendasi AI dalam satu web app.
- Target terukur MVP (Fase 1):
  - Time-to-insight: pengguna melihat kondisi channel dalam <2 menit setelah login (kartu metrik + grafik tren + tabel video).
  - Aktivasi: ≥70% pengguna yang menghubungkan channel melihat dashboard dan detail 1 video pada sesi pertama.
  - Kelengkapan data awal: sinkronisasi 90 hari terakhir views, subscriber, watch time, dan daftar video berhasil untuk ≥95% koneksi valid.
  - Retensi: ≥40% pengguna aktif mingguan kembali membuka dashboard atau analitik video pada 4 minggu pertama.
- Target fase lanjutan: perluasan ke analisis audiens/laporan (Fase 2) dan kompetitor/insight AI (Fase 3) tanpa mengubah alur inti MVP.
## Persona Target Pengguna
### 1. Kreator Individu - Rizky, YouTuber Edukasi (50rb subs)
- Kebutuhan: tahu video mana yang menghasilkan views dan subscriber, CTR thumbnail mana yang rendah, dan topik apa yang perlu diulang.
- Pain point: tidak sempat mengolah data manual; bingung membaca CTR vs retensi vs traffic source per video.
- Jobs-to-be-done: buka dashboard → cek tren 28 hari terakhir → sortir video terendah → perbaiki judul/thumbnail berikutnya.
- Kriteria sukses: bisa memutuskan 1 topik berikutnya hanya dari ranking video dan retensi tertinggi.
### 2. Manajer Agensi - Sinta, Mengelola 8 Channel Klien
- Kebutuhan: pantau multi-channel dalam satu akun, bandingkan periode berjalan vs sebelumnya, siapkan bahan laporan klien.
- Pain point: harus login berpindah-pindah akun/channel; data tidak seragam untuk presentasi.
- Jobs-to-be-done: tambah/beralih channel → bandingkan pertumbuhan harian → identifikasi video terbaik untuk direplikasi lintas klien.
- Kriteria sukses: cek 8 channel dalam <15 menit tanpa ekspor manual.
### 3. Brand / Tim Konten - Dimas, Brand FMCG dengan Channel Aktif
- Kebutuhan: ringkasan performa channel yang mudah dipahami non-analis, tren harian, dan bukti dampak konten terhadap subscriber/watch time.
- Pain point: dashboard terlalu teknis; sulit menjelaskan naik-turun performa ke manajemen.
- Jobs-to-be-done: lihat kartu metrik utama → lihat perbandingan periode → ambil kesimpulan untuk review bulanan.
- Kriteria sukses: satu tampilan visual cukup untuk menjawab apakah channel tumbuh atau stagnan.
## Proposisi Nilai
- Terpusat: satu dashboard web responsif untuk metrik channel, pertumbuhan harian, perbandingan periode, dan analitik per video.
- Otomatis: sinkronisasi via OAuth Google - pengguna hubungkan channel sekali, data views/subscriber/watch time ditarik berkala tanpa impor manual.
- Visual dan actionable: kartu metrik utama, grafik tren interaktif, tabel performa yang bisa disortir, dan detail CTR/retensi/traffic source per video untuk keputusan konten berikutnya.
- Multi-channel: tambah dan beralih antar channel dalam satu akun untuk kreator, tim, dan agensi.
- Bertahap ke cerdas: fondasi analitik MVP disiapkan untuk berkembang ke laporan terjadwal (Fase 2) dan insight bahasa natural/rekomendasi AI (Fase 3).
## Prinsip Desain Produk
- Data dulu, 1 klik ke jawaban: metrik utama selalu terlihat tanpa konfigurasi; detail tersedia maksimal 2 klik dari dashboard.
- Bandingkan, jangan sekadar tampilkan: setiap tren wajib bisa dibandingkan dengan periode sebelumnya dan dipecah per video.
- Jujur soal data: tampilkan rentang tanggal, status sinkronisasi terakhir, dan label estimasi bila data tertunda.
- Cepat dan terbaca: desktop-first, grafik interaktif responsif, tabel padat tapi bisa dipindai untuk 50+ video.
- Model awal: web app SaaS multi-channel dengan rilis bertahap - Fase 1 fondasi analitik, Fase 2 audiens dan laporan, Fase 3 kompetitor dan AI.