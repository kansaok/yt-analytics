import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Font di-self-host (subset latin, lisensi OFL) agar build tidak bergantung pada unduhan Google Fonts.
// Plus Jakarta Sans: dirancang untuk pembaca Indonesia, angka jelas untuk metrik (DESIGN.md).
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-latin-var.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-latin-400.woff2", weight: "400" },
    { path: "./fonts/IBMPlexMono-latin-500.woff2", weight: "500" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: { default: "Analitik Kanal", template: "%s · Analitik Kanal" },
  description: "Analitik channel YouTube terpusat: views, subscriber, watch time, dan performa per video.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Terapkan tema tersimpan sebelum paint agar tidak berkedip. Default: ikut sistem.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
