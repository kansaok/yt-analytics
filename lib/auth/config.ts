import type { NextAuthConfig } from "next-auth";

/** Bagian config yang aman untuk Edge (middleware). Provider ada di lib/auth/index.ts. */
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const p = request.nextUrl.pathname;
      const isPublic = p === "/login" || p.startsWith("/privacy") || p === "/";
      if (isPublic) return true;
      return !!auth?.user;
    },
    session({ session, token }) {
      if (token.uid && session.user) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
