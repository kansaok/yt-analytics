# Data Model
## Konvensi Umum
- Database relasional: **PostgreSQL (Supabase)** diakses via **Prisma ORM**. Semua tabel di bawah adalah tabel PostgreSQL.
- PK: `UUID DEFAULT gen_random_uuid()` (`String @id @default(uuid())` di Prisma).
- Waktu: `TIMESTAMPTZ` UTC, `createdAt DEFAULT now()`, `updatedAt` via `@updatedAt`.
- Token OAuth disimpan terenkripsi (kolom `TEXT`, enkripsi AES-256-GCM di level aplikasi, bukan plaintext).
- Isolasi data: semua query wajib filter `userId` + `channelId`. Tidak ada akses lintas user.
- Cache Redis dan object storage file ekspor **tidak** dimodelkan sebagai tabel relasional.
## Users
Akun aplikasi, pemilik koneksi OAuth dan channel.
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK, NOT NULL | ID internal aplikasi |
| `email` | TEXT / String | UNIQUE, NOT NULL | Email Google, lowercase |
| `name` | TEXT / String | NOT NULL | Nama tampilan |
| `avatarUrl` | TEXT / String? | NULLABLE | Foto profil Google |
| `locale` | VARCHAR(10) / String | NOT NULL DEFAULT 'id' | Preferensi bahasa |
| `timezone` | VARCHAR(50) / String | NOT NULL DEFAULT 'Asia/Jakarta' | Untuk laporan terjadwal |
| `defaultChannelId` | UUID / String? | NULLABLE, FK -> Channels.id | Channel aktif terakhir |
| `lastLoginAt` | TIMESTAMPTZ / DateTime? | NULLABLE | Audit login |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
| `updatedAt` | TIMESTAMPTZ / DateTime | NOT NULL | - |
- **Index:** `UNIQUE(email)`, `INDEX(defaultChannelId)`.
- **Relasi:** 1 Users : N OAuthTokens, 1 Users : N Channels, 1 Users : N Reports, 1 Users : N AIInsights.
## OAuthTokens
Menyimpan token Google per user untuk YouTube Data/Analytics API.
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `userId` | UUID / String | FK -> Users.id ON DELETE CASCADE, NOT NULL | Pemilik token |
| `provider` | VARCHAR(20) / String | NOT NULL DEFAULT 'google', CHECK(provider='google') | Ekstensibel |
| `accessTokenEnc` | TEXT / String | NOT NULL | Ciphertext AES-256-GCM |
| `refreshTokenEnc` | TEXT / String | NOT NULL | Ciphertext, wajib ada untuk sync background |
| `scopes` | TEXT[] / String[] | NOT NULL | Scope OAuth yang disetujui, least-privilege |
| `expiresAt` | TIMESTAMPTZ / DateTime | NOT NULL | Kedaluwarsa access token |
| `iv` | TEXT / String | NOT NULL | IV/nonce enkripsi |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
| `updatedAt` | TIMESTAMPTZ / DateTime | NOT NULL | - |
- **Constraint:** `UNIQUE(userId, provider)` - satu baris token Google per user.
- **Index:** `INDEX(userId)`, `INDEX(expiresAt)`.
- **Relasi:** N OAuthTokens : 1 Users.
## Channels
Channel YouTube yang dihubungkan user, unit sinkronisasi dan analisis.
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | ID internal |
| `userId` | UUID / String | FK -> Users.id ON DELETE CASCADE, NOT NULL | Pemilik koneksi |
| `youtubeChannelId` | VARCHAR(30) / String | NOT NULL | ID channel YouTube (UC...) |
| `title` | TEXT / String | NOT NULL | Nama channel |
| `handle` | VARCHAR(100) / String? | NULLABLE | @handle |
| `thumbnailUrl` | TEXT / String? | NULLABLE | Avatar channel |
| `status` | ENUM / String | NOT NULL DEFAULT 'ACTIVE', CHECK IN ('ACTIVE','SYNCING','ERROR','REVOKED') | Status sinkronisasi |
| `syncError` | TEXT / String? | NULLABLE | Pesan error terakhir worker |
| `lastSyncAt` | TIMESTAMPTZ / DateTime? | NULLABLE | Timestamp sync sukses terakhir |
| `historySince` | DATE / DateTime? | NULLABLE | Awal histori (MVP: 90 hari terakhir) |
| `subscriberCache` | INTEGER / Int | NOT NULL DEFAULT 0, CHECK >=0 | Cache count terakhir |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
| `updatedAt` | TIMESTAMPTZ / DateTime | NOT NULL | - |
- **Constraint:** `UNIQUE(userId, youtubeChannelId)` - channel yang sama tidak duplikat per user.
- **Index:** `INDEX(userId)`, `INDEX(userId, status)`, `INDEX(youtubeChannelId)`.
- **Relasi:** N Channels : 1 Users, 1 Channels : N ChannelDailyStats, 1 Channels : N Videos, 1 Channels : N Reports, 1 Channels : N Competitors.
## ChannelDailyStats
Agregat harian per channel untuk grafik pertumbuhan dan perbandingan periode.
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `channelId` | UUID / String | FK -> Channels.id ON DELETE CASCADE, NOT NULL | - |
| `date` | DATE / DateTime @db.Date | NOT NULL | Tanggal agregat (UTC channel) |
| `views` | BIGINT / BigInt | NOT NULL DEFAULT 0, CHECK >=0 | Total views harian |
| `subsGained` | INTEGER / Int | NOT NULL DEFAULT 0, CHECK >=0 | Subscriber baru |
| `subsLost` | INTEGER / Int | NOT NULL DEFAULT 0, CHECK >=0 | Unsubscribe |
| `subsNet` | INTEGER / Int | NOT NULL DEFAULT 0 | `subsGained - subsLost` |
| `watchTimeMinutes` | BIGINT / BigInt | NOT NULL DEFAULT 0, CHECK >=0 | Watch time menit |
| `estimatedRevenue` | NUMERIC(12,2) / Decimal? | NULLABLE, CHECK >=0 | Estimasi revenue, boleh null jika tidak ada monetisasi |
| `syncedAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | Kapan baris ditulis worker |
- **Constraint:** `UNIQUE(channelId, date)` - idempotent upsert dari worker.
- **Index:** `INDEX(channelId, date DESC)` untuk query `overview/growth/compare` + filter tanggal.
- **Relasi:** N ChannelDailyStats : 1 Channels.
## Videos
Metadata video per channel yang disinkronkan.
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `channelId` | UUID / String | FK -> Channels.id ON DELETE CASCADE, NOT NULL | - |
| `youtubeVideoId` | VARCHAR(20) / String | NOT NULL | ID video YouTube (11 char) |
| `title` | TEXT / String | NOT NULL | Judul saat sync |
| `publishedAt` | TIMESTAMPTZ / DateTime | NOT NULL | Waktu publish |
| `durationSeconds` | INTEGER / Int | NOT NULL DEFAULT 0, CHECK >=0 | Durasi |
| `thumbnailUrl` | TEXT / String? | NULLABLE | Thumbnail default |
| `privacyStatus` | VARCHAR(20) / String | NOT NULL DEFAULT 'public' | public/private/unlisted |
| `tags` | TEXT[] / String[] | NOT NULL DEFAULT '{}' | Tag YouTube |
| `lastStatSyncAt` | TIMESTAMPTZ / DateTime? | NULLABLE | Sync stat terakhir |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
| `updatedAt` | TIMESTAMPTZ / DateTime | NOT NULL | - |
- **Constraint:** `UNIQUE(channelId, youtubeVideoId)`.
- **Index:** `INDEX(channelId, publishedAt DESC)`, `INDEX(channelId, title)` + `pg_trgm` untuk search, `INDEX(youtubeVideoId)`.
- **Relasi:** N Videos : 1 Channels, 1 Videos : N VideoDailyStats.
## VideoDailyStats
Metrik harian per video untuk tabel performa, detail CTR/retensi/traffic source, dan ranking.
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `videoId` | UUID / String | FK -> Videos.id ON DELETE CASCADE, NOT NULL | - |
| `channelId` | UUID / String | FK -> Channels.id ON DELETE CASCADE, NOT NULL | Denormalisasi untuk query cepat per channel |
| `date` | DATE / DateTime @db.Date | NOT NULL | Tanggal metrik |
| `views` | BIGINT / BigInt | NOT NULL DEFAULT 0, CHECK >=0 | - |
| `likes` | INTEGER / Int | NOT NULL DEFAULT 0, CHECK >=0 | - |
| `comments` | INTEGER / Int | NOT NULL DEFAULT 0, CHECK >=0 | - |
| `watchTimeMinutes` | BIGINT / BigInt | NOT NULL DEFAULT 0, CHECK >=0 | - |
| `avgViewDurationSeconds` | DOUBLE PRECISION / Float | NOT NULL DEFAULT 0, CHECK >=0 | Durasi tonton rata-rata |
| `impressions` | BIGINT / BigInt | NOT NULL DEFAULT 0, CHECK >=0 | Impresi thumbnail |
| `ctr` | DOUBLE PRECISION / Float | NOT NULL DEFAULT 0, CHECK 0<=ctr<=100 | CTR % (0-100) |
| `retentionAvgPct` | DOUBLE PRECISION / Float? | NULLABLE, CHECK 0<=retention<=100 | Retensi rata-rata % |
| `trafficSource` | JSONB / Json? | NULLABLE | `{search, suggested, browse, external, ...}` views per sumber |
| `syncedAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
- **Constraint:** `UNIQUE(videoId, date)`, `CHECK(channelId = (SELECT channelId FROM Videos WHERE id=videoId))` ditegakkan di aplikasi/trigger.
- **Index:** `INDEX(videoId, date DESC)`, `INDEX(channelId, date DESC)`, `INDEX(channelId, views DESC)` untuk ranking.
- **Relasi:** N VideoDailyStats : 1 Videos, N VideoDailyStats : 1 Channels (via `channelId`).
## Competitors
Daftar channel kompetitor yang dipantau per user-channel (Fase 3, data publik saja).
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `userId` | UUID / String | FK -> Users.id ON DELETE CASCADE, NOT NULL | - |
| `channelId` | UUID / String | FK -> Channels.id ON DELETE CASCADE, NOT NULL | Channel milik user sebagai basis perbandingan |
| `youtubeChannelId` | VARCHAR(30) / String | NOT NULL | ID channel kompetitor |
| `title` | TEXT / String? | NULLABLE | Cache nama kompetitor |
| `thumbnailUrl` | TEXT / String? | NULLABLE | - |
| `notes` | TEXT / String? | NULLABLE | Catatan user |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
- **Constraint:** `UNIQUE(userId, channelId, youtubeChannelId)`.
- **Index:** `INDEX(userId, channelId)`.
- **Relasi:** N Competitors : 1 Channels, 1 Competitors : N CompetitorSnapshots.
## CompetitorSnapshots
Snapshot metrik publik kompetitor untuk tracking pertumbuhan dan deteksi viral (Fase 3).
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `competitorId` | UUID / String | FK -> Competitors.id ON DELETE CASCADE, NOT NULL | - |
| `snapshotDate` | DATE / DateTime @db.Date | NOT NULL | Tanggal snapshot |
| `subscriberCount` | BIGINT / BigInt | NOT NULL DEFAULT 0, CHECK >=0 | - |
| `viewCount` | BIGINT / BigInt | NOT NULL DEFAULT 0, CHECK >=0 | - |
| `videoCount` | INTEGER / Int | NOT NULL DEFAULT 0, CHECK >=0 | - |
| `topVideos` | JSONB / Json? | NULLABLE | Array `{youtubeVideoId, title, views, publishedAt}` bertumbuh tercepat |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
- **Constraint:** `UNIQUE(competitorId, snapshotDate)`.
- **Index:** `INDEX(competitorId, snapshotDate DESC)`.
- **Relasi:** N CompetitorSnapshots : 1 Competitors.
## Reports
Definisi ekspor sekali pakai dan laporan terjadwal (Fase 2).
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `userId` | UUID / String | FK -> Users.id ON DELETE CASCADE, NOT NULL | - |
| `channelId` | UUID / String | FK -> Channels.id ON DELETE CASCADE, NOT NULL | Channel yang dilaporkan |
| `name` | VARCHAR(150) / String | NOT NULL | Nama laporan |
| `type` | VARCHAR(20) / String | NOT NULL, CHECK IN ('EXPORT_ONCE','SCHEDULED') | - |
| `format` | VARCHAR(10) / String | NOT NULL, CHECK IN ('PDF','EXCEL') | Format unduhan |
| `filters` | JSONB / Json | NOT NULL DEFAULT '{}' | `{from, to, videoIds, playlistId}` filter tanggal kustom |
| `scheduleCron` | VARCHAR(50) / String? | NULLABLE | Cron untuk mingguan/bulanan, wajib jika SCHEDULED |
| `recipients` | TEXT[] / String[] | NOT NULL DEFAULT '{}' | Email penerima laporan terjadwal |
| `fileUrl` | TEXT / String? | NULLABLE | URL object storage hasil generate terakhir |
| `status` | VARCHAR(20) / String | NOT NULL DEFAULT 'ACTIVE' | ACTIVE/PAUSED/FAILED |
| `lastRunAt` | TIMESTAMPTZ / DateTime? | NULLABLE | Eksekusi terakhir |
| `nextRunAt` | TIMESTAMPTZ / DateTime? | NULLABLE | Jadwal berikutnya |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
| `updatedAt` | TIMESTAMPTZ / DateTime | NOT NULL | - |
- **Index:** `INDEX(userId, channelId)`, `INDEX(nextRunAt)` untuk scheduler.
- **Relasi:** N Reports : 1 Users, N Reports : 1 Channels.
## AIInsights
Hasil insight otomatis dan rekomendasi AI per channel/video (Fase 3).
| Kolom | Tipe PostgreSQL / Prisma | Constraint | Keterangan |
|---|---|---|---|
| `id` | UUID / String | PK | - |
| `userId` | UUID / String | FK -> Users.id ON DELETE CASCADE, NOT NULL | - |
| `channelId` | UUID / String | FK -> Channels.id ON DELETE CASCADE, NOT NULL | - |
| `videoId` | UUID / String? | FK -> Videos.id ON DELETE SET NULL, NULLABLE | Null untuk insight level channel |
| `type` | VARCHAR(30) / String | NOT NULL, CHECK IN ('SUMMARY','TITLE_SUGGESTION','PREDICTION') | Jenis insight |
| `inputPeriod` | JSONB / Json | NOT NULL | `{from, to}` periode data yang dianalisis |
| `resultText` | TEXT / String | NOT NULL | Narasi bahasa natural |
| `resultJson` | JSONB / Json? | NULLABLE | `{topics, titles, tags, predictedViews}` terstruktur |
| `model` | VARCHAR(50) / String | NOT NULL | Nama/model LLM |
| `createdAt` | TIMESTAMPTZ / DateTime | NOT NULL DEFAULT now() | - |
- **Index:** `INDEX(channelId, createdAt DESC)`, `INDEX(videoId, createdAt DESC)`, `INDEX(userId, type)`.
- **Relasi:** N AIInsights : 1 Users, N AIInsights : 1 Channels, N AIInsights : 0..1 Videos.