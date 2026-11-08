import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * AES-256-GCM. Setiap token memakai IV acak sendiri (IV tidak boleh dipakai ulang di GCM).
 * Kolom OAuthTokens.iv menyimpan "ivAccess:ivRefresh"; kolom *Enc menyimpan "ciphertext.authTag" (base64).
 */
function decodeKey(raw: string, label: string): Buffer {
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error(`${label} harus 32 byte base64`);
  return buf;
}

export function encryptionKeyVersion() {
  return env().ENCRYPTION_KEY_VERSION;
}

function key(version: number): Buffer {
  const e = env();
  if (version === e.ENCRYPTION_KEY_VERSION) return decodeKey(e.ENCRYPTION_KEY, "ENCRYPTION_KEY");
  if (e.ENCRYPTION_KEY_PREVIOUS && version === e.ENCRYPTION_KEY_PREVIOUS_VERSION)
    return decodeKey(e.ENCRYPTION_KEY_PREVIOUS, "ENCRYPTION_KEY_PREVIOUS");
  throw new Error(`Kunci enkripsi versi ${version} tidak tersedia`);
}

export function encrypt(plain: string): { ct: string; iv: string } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(encryptionKeyVersion()), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { ct: `${ct.toString("base64")}.${c.getAuthTag().toString("base64")}`, iv: iv.toString("base64") };
}

export function decrypt(payload: string, ivB64: string, version = 1): string {
  const [ctB64, tagB64] = payload.split(".");
  if (!ctB64 || !tagB64) throw new Error("Format ciphertext tidak valid");
  const d = createDecipheriv("aes-256-gcm", key(version), Buffer.from(ivB64, "base64"));
  d.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([d.update(Buffer.from(ctB64, "base64")), d.final()]).toString("utf8");
}

export function encryptTokenPair(accessToken: string, refreshToken: string) {
  const a = encrypt(accessToken);
  const r = encrypt(refreshToken);
  return { accessTokenEnc: a.ct, refreshTokenEnc: r.ct, iv: `${a.iv}:${r.iv}`, keyVersion: encryptionKeyVersion() };
}

export function decryptTokenPair(row: { accessTokenEnc: string; refreshTokenEnc: string; iv: string; keyVersion?: number }) {
  const [ivA, ivR] = row.iv.split(":");
  const version = row.keyVersion ?? 1;
  return { accessToken: decrypt(row.accessTokenEnc, ivA, version), refreshToken: decrypt(row.refreshTokenEnc, ivR, version) };
}
