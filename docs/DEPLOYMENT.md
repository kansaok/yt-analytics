# Setup & Deploy Produksi

Panduan ini memisahkan pekerjaan yang dapat dikerjakan coding agent dari pekerjaan yang membutuhkan akses akun, keputusan, atau secret milik pemilik proyek. Jangan pernah mengirim connection string, password database, OAuth client secret, token Vercel, atau `ENCRYPTION_KEY` melalui chat atau commit Git.

## 1. Pembagian tanggung jawab

| Tahap | Agent dapat mengerjakan | User wajib mengerjakan |
|---|---|---|
| Kode | Implementasi, test, migration SQL, CI, dokumentasi | Review dan push commit bila agent tidak punya izin tulis `.git` |
| GitHub | Menyiapkan workflow CI | Membuat repo, mengautentikasi Git/SSH, memberi akses push |
| Supabase | Menyiapkan Prisma schema/migration dan memeriksa format URL tanpa secret | Membuat project, mengambil URL koneksi, memasukkan secret, menjalankan SQL/migration bila diperlukan |
| Upstash | Menyiapkan kode Redis | Membuat database Redis dan memberikan `REDIS_URL` melalui environment platform |
| Vercel | Menyiapkan build script, health endpoint, dan memeriksa log yang diberikan | Menghubungkan repo, membuat/edit environment variable, redeploy, melihat dashboard/log |
| Google Cloud | Menyiapkan OAuth path/scope yang dipakai aplikasi | Membuat OAuth client, API, consent screen, redirect URI, dan menyimpan Client ID/Secret ke Vercel |
| Worker | Menyiapkan command `npm run worker` | Memilih dan mengonfigurasi layanan proses terpisah (bukan Vercel) |

## 2. Urutan deploy yang aman

1. Push kode ke branch `main` dan pastikan GitHub Actions CI hijau.
2. Buat Supabase, terapkan schema/migration, lalu verifikasi tabel `Users` ada.
3. Buat Upstash Redis.
4. Buat project Vercel dan masukkan environment variable produksi.
5. Deploy Vercel, lalu pastikan `GET /api/health` memberi `200`.
6. Konfigurasikan Google OAuth dengan domain deployment yang sudah pasti.
7. Jalankan worker pada layanan proses terpisah.
8. Uji login, koneksi channel, sinkronisasi, dan revoke.
9. Pasang uptime monitor ke `/api/health`.

## 3. Yang dikerjakan agent sebelum deploy

Agent menjalankan dan melaporkan hasil berikut:

```bash
npm run lint
npm run test:unit
npm run build
```

Integration test memerlukan PostgreSQL dan Redis. Dalam CI, workflow `.github/workflows/ci.yml` sudah menyiapkan keduanya. Untuk lokal lihat [RUNNING.md](RUNNING.md).

Agent juga dapat:

- Memastikan `package.json` memiliki build `prisma generate && next build` untuk Vercel.
- Menambah/memperbarui migration Prisma dan menyiapkan SQL fallback.
- Memeriksa log Vercel yang disalin user, tanpa meminta secret.
- Memperbaiki kode berdasarkan error build atau runtime.

## 4. Persiapan akun oleh user

### 4.1 GitHub

1. Buat repository GitHub kosong.
2. Hubungkan folder proyek dan push `main`.
3. Pastikan tab **Actions** menjalankan CI setelah push.

Contoh sekali jalan:

```bash
git init
git branch -M main
git remote add origin git@github.com:<akun>/<repo>.git
git add -A
git commit -m "Initial release"
git push -u origin main
```

### 4.2 Supabase

1. Buat project Supabase dan tunggu database berstatus aktif.
2. Di **Connect**, salin dua URL berbeda bila tersedia:
   - **Transaction pooler** (port `6543`) untuk runtime Vercel/serverless.
   - **Session pooler** (port `5432`) atau direct connection untuk Prisma migration dari terminal.
3. Untuk runtime Prisma melalui Transaction pooler, `DATABASE_URL` harus memiliki parameter:

```text
?pgbouncer=true&connection_limit=1
```

Jika URL sudah punya query parameter, tambahkan dengan awalan `&`, bukan `?` kedua. Parameter `pgbouncer=true` wajib agar Prisma tidak memakai prepared statement pada Transaction Pooler. Tanpa itu aplikasi bisa menampilkan `prepared statement "sN" does not exist`.

4. Jangan tempel URL ke chat atau command `echo`. Bila perlu menjalankan Prisma migration dari terminal, salin URL migration ke clipboard lalu jalankan:

```bash
export DATABASE_URL="$(pbpaste)"
npx prisma migrate deploy
unset DATABASE_URL
```

`pbpaste` harus tetap ditulis apa adanya; jangan diganti dengan URL. Jika URL langsung/session tidak dapat diakses dari jaringan lokal, pakai **SQL Editor** Supabase sebagai fallback dan jalankan file berikut berurutan:

```text
prisma/migrations/20261106134200_init/migration.sql
prisma/migrations/20261107063904_audience_stats/migration.sql
prisma/migrations/20261108090000_revoked_data_retention/migration.sql
prisma/migrations/20261108093000_oauth_key_version/migration.sql
```

> Jika menjalankan SQL migration secara manual, catat juga sebagai migration Prisma sebelum kembali menjalankan `prisma migrate deploy`. Gunakan prosedur baseline yang disiapkan agent; jangan menjalankan migration yang sama dua kali.

Setelah seluruh file SQL berhasil dijalankan, dengan `DATABASE_URL` migration yang valid pada shell yang sama, tandai setiap migration sebagai sudah diterapkan:

```bash
npx prisma migrate resolve --applied 20261106134200_init
npx prisma migrate resolve --applied 20261107063904_audience_stats
npx prisma migrate resolve --applied 20261108090000_revoked_data_retention
npx prisma migrate resolve --applied 20261108093000_oauth_key_version
```

Jalankan perintah tersebut **hanya** bila SQL untuk migration yang bersangkutan sudah sukses. Jika database benar-benar kosong, metode yang disarankan tetap `npx prisma migrate deploy`, karena Prisma akan menjalankan SQL sekaligus mencatat riwayat migration secara otomatis.

### 4.3 Upstash Redis

1. Buat database Redis di Upstash.
2. Salin URL TLS dengan awalan `rediss://`.
3. Simpan sebagai `REDIS_URL` untuk Vercel dan worker.

### 4.4 Vercel

1. Di Vercel, pilih **Add New → Project**, import repository GitHub, dan pilih branch produksi `main`.
2. Di **Settings → Environment Variables**, masukkan seluruh nilai pada bagian berikut. Pilih scope **Production** untuk tiap nilai.
3. Setelah mengubah environment variable, lakukan **Redeploy**. Perubahan tidak berlaku pada deployment lama.
4. Domain deployment default dapat dilihat di **Settings → Domains**; gunakan domain yang sama untuk `AUTH_URL` dan redirect URI Google.

## 5. Environment variable produksi

Masukkan nilai di dashboard Vercel, bukan source code atau Git.

| Nama | Nilai / sumber | Wajib |
|---|---|---|
| `DATABASE_URL` | Supabase Transaction pooler port 6543 + `pgbouncer=true&connection_limit=1` | Ya |
| `REDIS_URL` | URL TLS Upstash `rediss://...` | Ya |
| `AUTH_SECRET` | `openssl rand -base64 32`; jangan diganti setelah user aktif | Ya |
| `AUTH_URL` | URL production, mis. `https://nama-project.vercel.app`, tanpa trailing slash | Ya |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth Web client | Ya |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth Web client secret | Ya |
| `ENCRYPTION_KEY` | `openssl rand -base64 32`; berbeda dari `AUTH_SECRET` | Ya |
| `ENCRYPTION_KEY_VERSION` | `1` untuk instalasi baru | Ya |
| `RATE_LIMIT_IP_PER_MIN` | `300` (default bila tidak diisi) | Tidak |
| `RATE_LIMIT_READ_PER_MIN` | `120` (default bila tidak diisi) | Tidak |

Buat secret baru dengan:

```bash
openssl rand -base64 32 # AUTH_SECRET
openssl rand -base64 32 # ENCRYPTION_KEY
```

Jika secret pernah dikirim ke chat, shell history, screenshot, atau repo, anggap bocor: rotasi secret/password lalu perbarui Vercel.

## 6. Google OAuth dan YouTube API

Di Google Cloud Console:

1. Buat/select project.
2. Aktifkan **YouTube Data API v3** dan **YouTube Analytics API**.
3. Atur Google Auth Platform/consent screen; saat masih Testing, tambahkan akun penguji.
4. Buat OAuth client bertipe **Web application**.
5. Tambahkan domain production sebagai **Authorized JavaScript origins**:

```text
https://<domain-production>
```

6. Tambahkan kedua **Authorized redirect URIs** ini persis, tanpa trailing slash:

```text
https://<domain-production>/api/auth/callback/google
https://<domain-production>/api/youtube/callback
```

7. Salin Client ID dan Client Secret hanya ke Vercel environment variables.

## 7. Worker sinkronisasi

Vercel menjalankan request serverless dan **tidak** cocok untuk worker BullMQ yang harus hidup terus. Jalankan proses berikut pada layanan worker terpisah seperti Railway, Render, Fly.io, VM, atau container platform pilihan user:

```bash
npm ci
npx prisma generate
npm run worker
```

Berikan worker environment variable yang sama dengan aplikasi (`DATABASE_URL`, `REDIS_URL`, OAuth, dan enkripsi). Worker harus tetap berjalan untuk sinkronisasi awal, manual, dan jadwal 4-jam.

## 8. Verifikasi setelah deploy

Lakukan berurutan:

1. Buka `https://<domain-production>/api/health`; harapkan `200` dan `{"status":"ok"}`.
2. Buka `/login`; tombol Google aktif.
3. Login Google, pilih channel, dan tunggu sync awal selesai.
4. Pastikan dashboard, video, dan audience dapat dibuka.
5. Uji tambah channel kedua dan peralihan channel.
6. Uji manual sync; periksa worker menerima job.
7. Cabut akses Google pada akun penguji; channel harus meminta re-autentikasi.
8. Periksa Vercel Runtime Logs tidak memiliki 5xx berulang.

## 9. Diagnostik cepat

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Vercel build menyebut `pris.ly/d/vercel-build` | Prisma Client tidak tergenerate | Pastikan build script `prisma generate && next build`, push, lalu redeploy |
| `/login?error=Configuration` | Client secret atau `AUTH_SECRET` tidak tersedia pada deployment | Pastikan `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, dan `AUTH_URL` ada di scope Production; redeploy |
| `Users does not exist` | Migration belum diterapkan | Jalankan migration dengan URL Supabase/session atau SQL Editor |
| `prepared statement "sN" does not exist` | URL runtime menggunakan Transaction Pooler tanpa mode PgBouncer Prisma | Tambahkan `pgbouncer=true&connection_limit=1` ke `DATABASE_URL`, lalu redeploy |
| `Can't reach database server` | URL/region/password salah, project pause, atau jaringan | Salin ulang URL dari Supabase Connect, cek project aktif, dan pastikan port sesuai |
| API memberi `INTERNAL` | Error server disembunyikan untuk keamanan | Ambil `traceId` dari respons, lalu cari di Vercel Runtime Logs |
| Tidak ada data baru setelah connect | Worker tidak berjalan | Deploy/start `npm run worker` pada layanan proses terpisah |

Untuk runtime log Vercel pada Hobby plan, gunakan rentang 30 menit terakhir:

```bash
npx vercel logs --deployment <domain-vercel>
```

## 10. Monitoring minimum

Pasang monitor HTTP ke:

```text
https://<domain-production>/api/health
```

Pantau respons `200`. Sentry bersifat opsional; aplikasi dapat berjalan tanpa Sentry, tetapi error production akan lebih mudah ditangani jika diaktifkan.
