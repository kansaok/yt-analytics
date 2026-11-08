-- Rekam waktu revoke agar data OAuth yang sudah tidak berizin dapat dihapus setelah 7 hari.
ALTER TABLE "Channels" ADD COLUMN "revokedAt" TIMESTAMPTZ;

-- Data REVOKED lama tidak memiliki waktu revoke; gunakan pembaruan terakhir sebagai batas konservatif.
UPDATE "Channels" SET "revokedAt" = "updatedAt" WHERE "status" = 'REVOKED' AND "revokedAt" IS NULL;

CREATE INDEX "Channels_status_revokedAt_idx" ON "Channels"("status", "revokedAt");
