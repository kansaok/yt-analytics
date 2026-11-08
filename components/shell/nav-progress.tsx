"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Garis progres tipis di atas layar saat pindah halaman. Selesai ketika path atau query berubah. */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setActive(false);
    clearTimeout(timer.current);
  }, [path, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 15000); // jaring pengaman
    }
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimeout(timer.current);
    };
  }, []);

  if (!active) return null;
  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-sea-line">
      <div className="h-full w-1/3 bg-sea-primary motion-safe:animate-nav-progress" />
    </div>
  );
}
