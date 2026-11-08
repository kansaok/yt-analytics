"use client";
import { useState } from "react";
import type { HeatmapDto } from "@/lib/client/types";
import { formatCompact, formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";

type Metric = "views" | "watchTime";

/**
 * Intensitas rata-rata per hari dalam minggu. Nilai selalu tertulis di bawah blok (kontras teks aman,
 * warna bukan satu-satunya pembawa makna). Siap diperluas ke 7x24 bila `matrix` tersedia dari sumber per jam.
 */
export function HeatStrip({ data }: { data: HeatmapDto }) {
  const [metric, setMetric] = useState<Metric>("views");
  const val = (w: HeatmapDto["weekdays"][number]) => (metric === "views" ? w.avgViews : w.avgWatchTimeHours);
  const nums = data.weekdays.map(val).filter((v): v is number => v !== null);
  const max = Math.max(1, ...nums);
  const min = nums.length ? Math.min(...nums) : 0;
  const best = metric === "views" ? data.best.views : data.best.watchTime;
  const spread = max - min;
  return (
    <div>
      <div role="group" aria-label="Metrik heatmap" className="mb-4 inline-flex rounded-control border border-sea-line bg-sea-surface p-1">
        {([["views", "Views"], ["watchTime", "Watch time"]] as const).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={metric === k}
            onClick={() => setMetric(k)}
            className={cn("h-10 rounded-[8px] px-4 text-sm font-semibold", metric === k ? "bg-sea-primary text-sea-on-primary" : "hover:bg-sea-tint")}
          >
            {l}
          </button>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2" data-testid="heat-strip" aria-label={`Rata-rata ${metric === "views" ? "views" : "watch time"} per hari dalam minggu`}>
        {data.weekdays.map((w) => {
          const v = val(w);
          // Tanpa variasi nyata (semua nilai sama) semua blok memakai intensitas yang sama.
          const t = v === null ? 0 : spread === 0 ? 40 : 18 + ((v - min) / spread) * 72;
          const isBest = best?.day === w.day;
          return (
            <li
              key={w.day}
              className="flex min-w-0 flex-col items-center gap-1.5"
              title={`${w.label}: ${v === null ? "tidak ada data" : metric === "views" ? `${v.toLocaleString("id-ID")} views rata-rata` : formatHours(v)} (${w.daysObserved} hari diamati)`}
            >
              <span className={cn("text-xs sm:text-sm", isBest ? "font-bold text-sea-accent" : "text-sea-muted")}>
                <span className="sm:hidden" aria-hidden="true">{w.label.slice(0, 3)}</span>
                <span className="hidden sm:inline">{w.label}</span>
                <span className="sr-only sm:hidden">{w.label}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn("h-14 w-full rounded-control border sm:h-16", isBest ? "border-2 border-sea-accent" : "border-sea-line")}
                style={{ background: v === null ? "var(--surface)" : `color-mix(in srgb, var(--primary) ${t}%, var(--surface))` }}
              />
              <span className="text-xs font-semibold tabular sm:text-sm">
                {v === null ? "-" : metric === "views" ? formatCompact(v) : `${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })}j`}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
