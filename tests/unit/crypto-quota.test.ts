import { describe, expect, it } from "vitest";
import { decryptTokenPair, encryptTokenPair } from "@/lib/crypto/tokens";
import { backoffDelay, classifyGoogleError, QUOTA_BACKOFF_MS } from "@/lib/youtube/quota";
import { parseIsoDuration, trafficBucket } from "@/lib/youtube/mapper";
import { hasRequiredScopes } from "@/lib/auth/google-tokens";

describe("enkripsi token AES-256-GCM", () => {
  it("round-trip, ciphertext tidak memuat plaintext, IV berbeda per token", () => {
    const enc = encryptTokenPair("ya29.access-SECRET", "1//refresh-SECRET");
    expect(enc.accessTokenEnc).not.toContain("SECRET");
    expect(enc.refreshTokenEnc).not.toContain("SECRET");
    const [a, r] = enc.iv.split(":");
    expect(a).not.toBe(r);
    expect(decryptTokenPair(enc)).toEqual({ accessToken: "ya29.access-SECRET", refreshToken: "1//refresh-SECRET" });
  });
  it("ciphertext yang diubah ditolak (auth tag)", () => {
    const enc = encryptTokenPair("a", "b");
    const tampered = { ...enc, accessTokenEnc: "AAAA" + enc.accessTokenEnc.slice(4) };
    expect(() => decryptTokenPair(tampered)).toThrow();
  });
});

describe("klasifikasi error & backoff kuota", () => {
  it("403 quotaExceeded => QuotaExceededError", () => {
    const err = classifyGoogleError({ response: { status: 403, data: { error: { errors: [{ reason: "quotaExceeded" }] } } } });
    expect(err.name).toBe("QuotaExceededError");
    expect(classifyGoogleError({ response: { status: 429 } }).name).toBe("QuotaExceededError");
    expect(classifyGoogleError({ response: { status: 400, data: { error: "invalid_grant" } } }).name).toBe("AuthRevokedError");
    expect(classifyGoogleError({ response: { status: 400 } }).name).toBe("YtBadRequestError");
  });
  it("jadwal 5m/30m/2j + jitter maks 10%", () => {
    const q = Object.assign(new Error(), { name: "QuotaExceededError" });
    expect(backoffDelay(1, q, 1, () => 0)).toBe(QUOTA_BACKOFF_MS[0]);
    expect(backoffDelay(2, q, 1, () => 0)).toBe(QUOTA_BACKOFF_MS[1]);
    expect(backoffDelay(3, q, 1, () => 0)).toBe(QUOTA_BACKOFF_MS[2]);
    expect(backoffDelay(1, q, 1, () => 1)).toBe(Math.round(QUOTA_BACKOFF_MS[0] * 1.1));
    expect(backoffDelay(2, new Error("x"), 1, () => 0)).toBe(120_000);
  });
});

describe("mapper & scope", () => {
  it("durasi ISO dan taksonomi traffic", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(trafficBucket("YT_SEARCH")).toBe("search");
    expect(trafficBucket("RELATED_VIDEO")).toBe("suggested");
    expect(trafficBucket("EXT_URL")).toBe("external");
    expect(trafficBucket("WHATEVER")).toBe("other");
  });
  it("scope least-privilege wajib lengkap", () => {
    expect(hasRequiredScopes("openid email https://www.googleapis.com/auth/youtube.readonly")).toBe(false);
    expect(
      hasRequiredScopes(
        "openid https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
      ),
    ).toBe(true);
  });
});
