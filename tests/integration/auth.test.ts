import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { prisma } from "@/lib/db/prisma";
import { decryptTokenPair } from "@/lib/crypto/tokens";
import { getAuthorizedClient, persistGoogleLogin } from "@/lib/auth/google-tokens";
import { resetDb } from "./helpers";

const server = setupServer(
  http.post("https://oauth2.googleapis.com/token", () =>
    HttpResponse.json({ access_token: "ya29.refreshed", expires_in: 3599, token_type: "Bearer" }),
  ),
);

beforeEach(async () => {
  await resetDb();
});

describe("login Google -> token terenkripsi di PostgreSQL", () => {
  it("menyimpan access & refresh token terenkripsi, login ulang tanpa refresh token mempertahankan yang lama", async () => {
    const account = {
      providerAccountId: "google-sub-123",
      access_token: "ya29.PLAIN-ACCESS",
      refresh_token: "1//PLAIN-REFRESH",
      expires_at: Math.floor(Date.now() / 1000) - 10, // sudah kedaluwarsa
      scope: "openid email https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
    };
    const uid = await persistGoogleLogin(account, { email: "Rizky@Example.com", name: "Rizky", picture: null });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    expect(user.email).toBe("rizky@example.com");

    const row = await prisma.oAuthToken.findFirstOrThrow({ where: { userId: uid } });
    const raw = JSON.stringify(row);
    expect(raw).not.toContain("PLAIN-ACCESS");
    expect(raw).not.toContain("PLAIN-REFRESH");
    expect(decryptTokenPair(row)).toEqual({ accessToken: "ya29.PLAIN-ACCESS", refreshToken: "1//PLAIN-REFRESH" });
    expect(row.scopes).toContain("https://www.googleapis.com/auth/yt-analytics.readonly");

    // Login ulang: Google tidak mengirim refresh token lagi => refresh lama dipertahankan, user sama.
    const uid2 = await persistGoogleLogin(
      { ...account, access_token: "ya29.SECOND", refresh_token: undefined },
      { email: "rizky@example.com", name: "Rizky", picture: null },
    );
    expect(uid2).toBe(uid);
    const row2 = await prisma.oAuthToken.findFirstOrThrow({ where: { userId: uid } });
    expect(decryptTokenPair(row2)).toEqual({ accessToken: "ya29.SECOND", refreshToken: "1//PLAIN-REFRESH" });
    expect(await prisma.oAuthToken.count({ where: { userId: uid } })).toBe(1);
  });

  it("refresh token kedaluwarsa memperbarui token terenkripsi; user & sesi (userId) tetap sama", async () => {
    server.listen({ onUnhandledRequest: "error" });
    try {
      const uid = await persistGoogleLogin(
        { providerAccountId: "sub-x", access_token: "ya29.old", refresh_token: "1//r", expires_at: 1, scope: "" },
        { email: "x@test.id", name: null, picture: null },
      );
      const tok = await prisma.oAuthToken.findFirstOrThrow({ where: { userId: uid } });
      const client = await getAuthorizedClient(tok);
      expect(client.credentials.access_token).toBe("ya29.refreshed");
      const after = await prisma.oAuthToken.findFirstOrThrow({ where: { userId: uid } });
      expect(after.accessTokenEnc).not.toContain("refreshed");
      expect(decryptTokenPair(after)).toEqual({ accessToken: "ya29.refreshed", refreshToken: "1//r" });
      expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now());
      // userId yang tersimpan di JWT sesi tidak berubah oleh refresh token Google
      expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
    } finally {
      server.close();
    }
  });
});
