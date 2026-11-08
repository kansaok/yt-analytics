import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, LockKey, Trash } from "@phosphor-icons/react/dist/ssr";
import { auth, signIn } from "@/lib/auth";
import { devModeEnabled, env } from "@/lib/env";
import { Notice } from "@/components/ui/notice";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export const metadata: Metadata = { title: "Masuk" };

const ERRORS: Record<string, { title: string; body: string }> = {
  ScopeDenied: {
    title: "Akses YouTube diperlukan untuk menampilkan analitik.",
    body: "Saat memilih izin di Google, centang akses baca YouTube dan YouTube Analytics. Coba lagi.",
  },
  AccessDenied: {
    title: "Akses YouTube diperlukan untuk menampilkan analitik.",
    body: "Anda membatalkan persetujuan di Google. Coba lagi.",
  },
  EmailUnverified: {
    title: "Email Google Anda belum terverifikasi.",
    body: "Verifikasi email di akun Google terlebih dahulu, lalu masuk lagi.",
  },
  OAuthCallbackError: { title: "Login dibatalkan.", body: "Proses masuk tidak selesai. Silakan coba lagi." },
  Configuration: { title: "Login Google belum dapat dipakai.", body: "Konfigurasi OAuth di server belum lengkap." },
};

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; out?: string } }) {
  const s = await auth();
  if (s?.user) redirect("/dashboard");
  const err = searchParams.error ? ERRORS[searchParams.error] ?? ERRORS.OAuthCallbackError : null;
  const googleReady = !!env().GOOGLE_CLIENT_ID;
  const dev = devModeEnabled();

  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/channels" });
  }
  async function devLogin() {
    "use server";
    await signIn("dev-login", { redirectTo: "/channels" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-task items-center justify-between px-5">
        <span className="text-[17px] font-bold text-sea-primary">Analitik Kanal</span>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-task flex-1 px-5 pb-16 pt-6 sm:pt-12">
        <h1 className="text-[28px] sm:text-[34px]">Lihat kondisi channel YouTube Anda dalam satu layar.</h1>
        <p className="mt-3 max-w-[560px] text-[17px] text-sea-muted">
          Views, subscriber, watch time, dan performa tiap video, dibandingkan dengan periode sebelumnya.
        </p>

        <div className="mt-8 space-y-4">
          {searchParams.out ? <Notice tone="success" title="Anda sudah keluar.">Sesi di perangkat ini sudah dihapus.</Notice> : null}
          {err ? <Notice tone="error" title={err.title}>{err.body}</Notice> : null}
        </div>

        <form action={google} className="mt-8">
          <button
            type="submit"
            disabled={!googleReady}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-control bg-sea-primary px-6 text-[16px] font-semibold text-sea-on-primary hover:brightness-110 active:brightness-95 disabled:opacity-50 sm:w-auto"
          >
            Masuk dengan Google
          </button>
          {!googleReady ? (
            <p className="mt-2 text-sm text-sea-muted">
              Login Google belum aktif: GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diisi di server.
            </p>
          ) : null}
        </form>

        {dev ? (
          <form action={devLogin} className="mt-3">
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-control border-[1.5px] border-sea-primary px-6 font-semibold text-sea-primary hover:bg-sea-tint sm:w-auto"
              data-testid="dev-login"
            >
              Masuk mode pengembangan (data uji)
            </button>
            <p className="mt-2 text-sm text-sea-muted">Hanya muncul saat AUTH_DEV_LOGIN=1 di luar produksi.</p>
          </form>
        ) : null}

        <section aria-labelledby="izin" className="mt-12 border-t border-sea-line pt-8">
          <h2 id="izin" className="text-lg">Apa yang kami minta dari akun Google Anda</h2>
          <ul className="mt-4 space-y-5">
            <li className="flex gap-3">
              <Eye size={24} className="mt-0.5 shrink-0 text-sea-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Hanya membaca</p>
                <p className="text-sea-muted">
                  Izin baca YouTube dan YouTube Analytics. Aplikasi tidak bisa mengunggah, mengubah judul, atau membalas komentar.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <LockKey size={24} className="mt-0.5 shrink-0 text-sea-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Token disimpan terenkripsi</p>
                <p className="text-sea-muted">Token akses tidak pernah dikirim ke browser Anda dan tidak dicatat di log.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <Trash size={24} className="mt-0.5 shrink-0 text-sea-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">Bisa diputus kapan saja</p>
                <p className="text-sea-muted">Memutus channel menghapus statistik dan token channel itu dari sistem.</p>
              </div>
            </li>
          </ul>
          <p className="mt-6 text-sm text-sea-muted">
            Rincian ada di{" "}
            <Link href="/privacy" className="font-semibold text-sea-primary underline underline-offset-4">
              Kebijakan Privasi
            </Link>
            .
          </p>
        </section>
      </main>
      <footer className="border-t border-sea-line">
        <p className="mx-auto max-w-task px-5 py-4 text-sm text-sea-muted">Data dari YouTube API Services.</p>
      </footer>
    </div>
  );
}
