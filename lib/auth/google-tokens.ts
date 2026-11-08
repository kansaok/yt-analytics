import { OAuth2Client } from "google-auth-library";
import type { OAuthToken } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env, fixturesEnabled } from "@/lib/env";
import { decryptTokenPair, encryptionKeyVersion, encryptTokenPair } from "@/lib/crypto/tokens";
import { AuthRevokedError, classifyGoogleError } from "@/lib/youtube/quota";
import { realGateway } from "@/lib/youtube/client";
import { fixtureGateway } from "@/lib/youtube/fixtures";
import type { YouTubeGateway } from "@/lib/youtube/types";

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
export const LOGIN_SCOPES = ["openid", "email", "profile", ...YT_SCOPES];
export const FIXTURE_SUBJECT_PREFIX = "fixture-";

export function hasRequiredScopes(scope: string | string[] | undefined | null) {
  const granted = Array.isArray(scope) ? scope : (scope ?? "").split(/[\s,]+/);
  return YT_SCOPES.every((s) => granted.includes(s));
}

export function oauthClient(redirectUri?: string) {
  const e = env();
  return new OAuth2Client({ clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, redirectUri });
}

/** Simpan/rotasi satu grant Google (D5: satu baris per grant). Token tidak pernah dikirim ke client atau log. */
export async function saveGrant(input: {
  userId: string;
  googleSubject: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  scopes: string[];
}) {
  const existing = await prisma.oAuthToken.findUnique({
    where: {
      userId_provider_googleSubject: { userId: input.userId, provider: "google", googleSubject: input.googleSubject },
    },
  });
  let refresh = input.refreshToken ?? null;
  if (!refresh && existing) refresh = decryptTokenPair(existing).refreshToken;
  if (!refresh) return null; // tanpa refresh token, sync background tidak mungkin
  const enc = encryptTokenPair(input.accessToken, refresh);
  return prisma.oAuthToken.upsert({
    where: {
      userId_provider_googleSubject: { userId: input.userId, provider: "google", googleSubject: input.googleSubject },
    },
    create: { userId: input.userId, googleSubject: input.googleSubject, ...enc, scopes: input.scopes, expiresAt: input.expiresAt },
    update: { ...enc, scopes: input.scopes, expiresAt: input.expiresAt },
  });
}

/** Revoke/kehilangan akses: hapus token, tandai semua channel di grant itu REVOKED, hentikan sync. */
export async function markGrantRevoked(tokenId: string) {
  await prisma.channel.updateMany({
    where: { oauthTokenId: tokenId },
    data: { status: "REVOKED", syncError: "Koneksi terputus. Hubungkan ulang.", revokedAt: new Date() },
  });
  await prisma.oAuthToken.deleteMany({ where: { id: tokenId } });
}

/** Access token valid; refresh otomatis lewat google-auth-library bila < 60 detik lagi kedaluwarsa. */
export async function getAuthorizedClient(token: OAuthToken): Promise<OAuth2Client> {
  const { accessToken, refreshToken } = decryptTokenPair(token);
  // Rotasi bertahap: grant lama dibungkus ulang pada penggunaan pertama dengan kunci aktif.
  if (token.keyVersion !== encryptionKeyVersion())
    await prisma.oAuthToken.update({ where: { id: token.id }, data: encryptTokenPair(accessToken, refreshToken) });
  const client = oauthClient();
  if (token.expiresAt.getTime() - Date.now() > 60_000) {
    client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return client;
  }
  client.setCredentials({ refresh_token: refreshToken });
  try {
    const res = await client.refreshAccessToken();
    const c = res.credentials;
    if (!c.access_token) throw new AuthRevokedError("Refresh tidak mengembalikan access token");
    await prisma.oAuthToken.update({
      where: { id: token.id },
      data: {
        ...encryptTokenPair(c.access_token, c.refresh_token ?? refreshToken),
        expiresAt: new Date(c.expiry_date ?? Date.now() + 3600_000),
      },
    });
    client.setCredentials({ access_token: c.access_token, refresh_token: c.refresh_token ?? refreshToken });
    return client;
  } catch (e) {
    const err = classifyGoogleError(e);
    if (err instanceof AuthRevokedError) await markGrantRevoked(token.id);
    throw err;
  }
}

export async function gatewayForToken(token: OAuthToken): Promise<YouTubeGateway> {
  if (token.googleSubject.startsWith(FIXTURE_SUBJECT_PREFIX)) {
    if (!fixturesEnabled()) throw new AuthRevokedError("Grant data uji tidak berlaku di lingkungan ini");
    return fixtureGateway();
  }
  return realGateway(await getAuthorizedClient(token));
}

/**
 * Callback login Google (Auth.js jwt): buat/temukan user dari email, simpan grant terenkripsi.
 * Dipisah agar bisa diuji tanpa alur OAuth penuh. Mengembalikan userId untuk sesi.
 */
export async function persistGoogleLogin(
  account: { providerAccountId: string; access_token?: string; refresh_token?: string; expires_at?: number; scope?: string },
  profile: { email: string; name: string | null; picture: string | null },
) {
  const email = profile.email.toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: profile.name ?? email, avatarUrl: profile.picture, lastLoginAt: new Date() },
    update: { name: profile.name ?? undefined, avatarUrl: profile.picture ?? undefined, lastLoginAt: new Date() },
  });
  if (account.access_token) {
    await saveGrant({
      userId: user.id,
      googleSubject: account.providerAccountId,
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: new Date((account.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000),
      scopes: (account.scope ?? "").split(" "),
    });
  }
  return user.id;
}
