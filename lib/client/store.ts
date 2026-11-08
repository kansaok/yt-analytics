"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Metric = "views" | "subscribersNet" | "watchTimeHours";

/** State UI (prd/07 §2.1): rentang tanggal & mode banding. Rentang terakhir disimpan sebagai preferensi. */
type UiState = {
  preset: 7 | 28 | 90 | "custom";
  customFrom?: string;
  customTo?: string;
  compare: boolean;
  metric: Metric;
  setPreset: (p: 7 | 28 | 90) => void;
  setCustom: (from: string, to: string) => void;
  setCompare: (v: boolean) => void;
  setMetric: (m: Metric) => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      preset: 28,
      compare: true,
      metric: "views",
      setPreset: (preset) => set({ preset }),
      setCustom: (customFrom, customTo) => set({ preset: "custom", customFrom, customTo }),
      setCompare: (compare) => set({ compare }),
      setMetric: (metric) => set({ metric }),
    }),
    { name: "ui-pref", partialize: (s) => ({ preset: s.preset, customFrom: s.customFrom, customTo: s.customTo, compare: s.compare }) },
  ),
);

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Rentang aktif dalam format API. Hari ini = tanggal UTC, konsisten dengan server. */
export function useRange(): { from: string; to: string; label: string } {
  const { preset, customFrom, customTo } = useUi();
  if (preset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo, label: "kustom" };
  const n = preset === "custom" ? 28 : preset;
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - (n - 1) * 86400_000);
  return { from: iso(from), to: iso(to), label: `${n} hari` };
}
export { iso as isoDate };
