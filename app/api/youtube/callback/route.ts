import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSessionUserId } from "@/lib/auth/session";
import { hasRequiredScopes, oauthClient, saveGrant } from "@/lib/auth/google-tokens";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const back = (req: NextRequest, q: string) => {
  const res = NextResponse.redirect(new URL(`/channels?${q}`, req.url));
  res.cookies.delete("yt_oauth_state");
  return res;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.url));
  const cookie = req.cookies.get("yt_oauth_state")?.value ?? "";
  const [expected, cookieUser] = cookie.split(".");
  const state = sp.get("state") ?? "";
  const valid =
    !!expected &&
    cookieUser === userId &&
    expected.length === state.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(state));
  if (!valid) return back(req, "error=state");
  if (sp.get("error")) return back(req, "error=denied");
  const code = sp.get("code");
  if (!code) return back(req, "error=denied");
  try {
    const client = oauthClient(`${env().AUTH_URL}/api/youtube/callback`);
    const { tokens } = await client.getToken(code);
    if (!hasRequiredScopes(tokens.scope)) return back(req, "error=scope");
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: env().GOOGLE_CLIENT_ID });
    const sub = ticket.getPayload()?.sub;
    if (!sub || !tokens.access_token) return back(req, "error=denied");
    const grant = await saveGrant({
      userId,
      googleSubject: sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      scopes: (tokens.scope ?? "").split(" "),
    });
    if (!grant) return back(req, "error=refresh");
    return back(req, `added=${grant.id}`);
  } catch {
    return back(req, "error=exchange");
  }
}
