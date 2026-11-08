-- Metadata versi memungkinkan rotasi AES-GCM tanpa kehilangan akses ke grant lama.
ALTER TABLE "OAuthTokens" ADD COLUMN "keyVersion" INTEGER NOT NULL DEFAULT 1;
