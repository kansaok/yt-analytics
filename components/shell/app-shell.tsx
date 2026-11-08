"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLineUp, FilmStrip, SignOut, SquaresFour, UsersThree } from "@phosphor-icons/react";
import { Suspense } from "react";
import { NavProgress } from "./nav-progress";
import { ChannelSwitcher } from "./channel-switcher";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/cn";

// Navigasi hanya ke halaman yang benar-benar ada (R-24).
const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: ChartLineUp },
  { href: "/videos", label: "Video", Icon: FilmStrip },
  { href: "/audience", label: "Audiens", Icon: UsersThree },
  { href: "/channels", label: "Channel", Icon: SquaresFour },
];

export function AppShell({ children, devMode, signOutAction }: { children: React.ReactNode; devMode: boolean; signOutAction: () => Promise<void> }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-control focus:bg-sea-surface focus:px-4 focus:py-2">
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-30 border-b border-sea-line bg-sea-bg">
        <div className="mx-auto flex h-16 max-w-overview items-center gap-3 px-4 sm:px-5">
          <Link href="/dashboard" className="flex h-11 items-center rounded-control pr-1 text-[17px] font-bold tracking-tight text-sea-primary">
            Analitik Kanal
          </Link>
          <nav aria-label="Utama" className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-control px-3 font-medium hover:bg-sea-tint",
                  isActive(href) ? "text-sea-primary underline decoration-2 underline-offset-[10px]" : "text-sea-muted",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <div className="hidden min-w-0 sm:block">
              <ChannelSwitcher />
            </div>
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Keluar"
                title="Keluar"
                className="inline-flex h-11 w-11 items-center justify-center rounded-control hover:bg-sea-tint active:bg-sea-line/40"
              >
                <SignOut size={22} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-sea-line px-4 py-2 sm:hidden">
          <ChannelSwitcher />
        </div>
      </header>
      {devMode ? (
        <div className="border-b border-sea-accent bg-sea-surface px-4 py-2 text-center text-sm">
          <span className="font-semibold text-sea-accent">Mode data uji.</span> Angka berasal dari generator lokal, bukan dari YouTube. Hanya untuk pengembangan.
        </div>
      ) : null}
      <main id="konten" className="mx-auto w-full max-w-overview flex-1 px-4 pb-28 pt-6 sm:px-5 md:pb-12">
        {children}
      </main>
      <footer className="hidden border-t border-sea-line md:block">
        <div className="mx-auto flex max-w-overview flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4 text-sm text-sea-muted">
          <span>Data dari YouTube API Services.</span>
          <Link href="/privacy" className="underline-offset-4 hover:underline">Kebijakan Privasi</Link>
          <a href="https://www.youtube.com/t/terms" className="underline-offset-4 hover:underline" rel="noopener noreferrer" target="_blank">Ketentuan YouTube</a>
          <a href="https://policies.google.com/privacy" className="underline-offset-4 hover:underline" rel="noopener noreferrer" target="_blank">Kebijakan Privasi Google</a>
        </div>
      </footer>
      {/* Mobile: navigasi bawah maks 4 item (DESIGN.md Platform notes) */}
      <nav aria-label="Utama (seluler)" className="fixed inset-x-0 bottom-0 z-30 border-t border-sea-line bg-sea-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold", isActive(href) ? "text-sea-primary" : "text-sea-muted")}
              >
                <Icon size={24} weight="regular" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
