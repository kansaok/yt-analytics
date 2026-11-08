import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionUserId } from "@/lib/auth/session";
import { oauthClient, YT_SCOPES } from "@/lib/auth/google-tokens";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * "Tambah Channel": otorisasi data YouTube terpisah dari login (prd/03 #2), agar user tetap
 * di akun aplikasi yang sama walau memilih akun Google / Brand Account lain. State disimpan di cookie
 * HttpOnly dan diverifikasi di callback (anti-CSRF).
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.url));
  const state = randomBytes(24).toString("base64url");
  const url = oauthClient(`${env().AUTH_URL}/api/youtube/callback`).generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    scope: ["openid", "email", ...YT_SCOPES],
    state,
    include_granted_scopes: false,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set("yt_oauth_state", `${state}.${userId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/youtube/callback",
    maxAge: 600,
  });
  return res;
}
