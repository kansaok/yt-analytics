import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Halaman aplikasi wajib login. API dicek di withApi (mengembalikan 401 JSON, bukan redirect).
  matcher: ["/dashboard/:path*", "/videos/:path*", "/channels/:path*", "/audience/:path*"],
};
