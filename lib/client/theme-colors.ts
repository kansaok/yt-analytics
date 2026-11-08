"use client";
import { useEffect, useState } from "react";

export type ChartColors = { primary: string; accent: string; muted: string; text: string; grid: string; surface: string; line: string; c2: string; c3: string; c4: string; danger: string; success: string };

function read(): ChartColors {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    primary: v("--primary"),
    accent: v("--accent"),
    muted: v("--text-muted"),
    text: v("--text"),
    grid: v("--grid"),
    surface: v("--surface"),
    line: v("--border"),
    c2: v("--chart-2"),
    c3: v("--chart-3"),
    c4: v("--chart-4"),
    danger: v("--danger"),
    success: v("--success"),
  };
}

/** Warna grafik dibaca dari CSS variables agar ikut tema aktif (DESIGN.md: tanpa hex hardcode). */
export function useChartColors(): ChartColors | null {
  const [c, setC] = useState<ChartColors | null>(null);
  useEffect(() => {
    const update = () => setC(read());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return c;
}

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const f = () => setR(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return r;
}
