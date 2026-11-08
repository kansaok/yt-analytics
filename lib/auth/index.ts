import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./config";
import { prisma } from "@/lib/db/prisma";
import { devModeEnabled } from "@/lib/env";
import { FIXTURE_SUBJECT_PREFIX, hasRequiredScopes, LOGIN_SCOPES, persistGoogleLogin, saveGrant } from "./google-tokens";

const DEV_EMAIL = "penguji@lokal.test";

const providers = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorization: {
      params: { scope: LOGIN_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "false" },
    },
    checks: ["pkce", "state", "nonce"],
  }),
  ...(devModeEnabled()
    ? [
        Credentials({
          id: "dev-login",
          name: "Mode pengembangan",
          credentials: {},
          async authorize() {
            const user = await prisma.user.upsert({
              where: { email: DEV_EMAIL },
              create: { email: DEV_EMAIL, name: "Penguji Lokal" },
              update: { lastLoginAt: new Date() },
            });
            // Grant data uji agar alur pilih channel + sync bisa diuji tanpa Google.
            await saveGrant({
              userId: user.id,
              googleSubject: `${FIXTURE_SUBJECT_PREFIX}${user.id}`,
              accessToken: "fixture-access",
              refreshToken: "fixture-refresh",
              expiresAt: new Date(Date.now() + 365 * 86400_000),
              scopes: LOGIN_SCOPES,
            });
            return { id: user.id, email: user.email, name: user.name };
          },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email || profile.email_verified !== true) return "/login?error=EmailUnverified";
      if (!hasRequiredScopes(account.scope)) return "/login?error=ScopeDenied";
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "google" && profile?.email) {
        token.uid = await persistGoogleLogin(account, {
          email: profile.email,
          name: profile.name ?? null,
          picture: (profile.picture as string) ?? null,
        });
        // Jangan simpan token Google di JWT sesi.
        delete (token as Record<string, unknown>).access_token;
      } else if (account?.provider === "dev-login" && user?.id) {
        token.uid = user.id;
      }
      return token;
    },
  },
});
