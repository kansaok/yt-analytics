"use client";
import type { Delta } from "@/lib/client/types";
import { formatCompact, formatHours, formatInt } from "@/lib/format";
import { Tip } from "@/components/ui/tip";
import { DeltaBadge } from "./delta-badge";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/cn";

export type CardKind = "views" | "subscribersNet" | "watchTimeHours" | "estRevenueUSD";

const META: Record<CardKind, { title: string; tip: string }> = {
  views: { title: "Total views", tip: "Jumlah tayangan semua video di channel ini selama periode terpilih." },
  subscribersNet: { title: "Subscriber baru (net)", tip: "Subscriber bertambah dikurangi subscriber yang berhenti. Bisa negatif." },
  watchTimeHours: { title: "Watch time", tip: "Total waktu tonton semua video, dalam jam (1 desimal)." },
  estRevenueUSD: {
    title: "Estimasi revenue*",
    tip: "Butuh izin data pendapatan YouTube (yt-analytics-monetary), yang sengaja tidak diminta di MVP. Karena itu nilainya kosong, bukan 0.",
  },
};

export function MetricCard({
  kind,
  delta,
  spark,
  selected,
  onSelect,
  compare,
  previousComplete,
}: {
  kind: CardKind;
  delta: Delta;
  spark: (number | null)[];
  selected: boolean;
  onSelect?: () => void;
  compare: boolean;
  previousComplete: boolean;
}) {
  const m = META[kind];
  const v = delta.value;
  const negative = v !== null && v < 0;
  const display =
    v === null ? "-" : kind === "watchTimeHours" ? formatHours(v) : kind === "subscribersNet" ? (v > 0 ? "+" : "") + formatCompact(v) : formatCompact(v);
  const interactive = !!onSelect;
  const Body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-sea-muted">{m.title}</span>
      </span>
      <span
        className={cn("mt-1 block text-[26px] font-bold leading-tight tabular sm:text-[28px]", negative && "text-sea-danger")}
        title={v !== null ? formatInt(v) : undefined}
      >
        {display}
      </span>
      <span className="mt-1 block min-h-[22px]">
        {kind === "estRevenueUSD" && v === null ? (
          <span className="text-sm text-sea-muted">Belum tersedia</span>
        ) : compare && previousComplete ? (
          <DeltaBadge pct={delta.deltaPct} compareLabel="vs periode lalu" />
        ) : compare ? (
          <span className="text-sm text-sea-muted">Data pembanding tidak lengkap</span>
        ) : null}
      </span>
      <span className="mt-2 block h-9" aria-hidden="true">
        <Sparkline values={spark} stroke={selected ? "var(--primary)" : "var(--chart-3)"} />
      </span>
    </>
  );
  return (
    <div
      className={cn(
        "relative rounded-card border bg-sea-surface",
        selected ? "border-sea-primary ring-1 ring-sea-primary" : "border-sea-line",
      )}
      data-testid={`metric-${kind}`}
    >
      <div className="absolute right-2 top-2 z-10">
        <Tip label={`Definisi ${m.title}`}>{m.tip}</Tip>
      </div>
      {interactive ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`${m.title}: ${display}. Tampilkan di grafik`}
          className="block w-full rounded-card p-4 pr-10 text-left hover:bg-sea-tint/60 active:bg-sea-tint"
        >
          {Body}
        </button>
      ) : (
        <div className="p-4 pr-10">{Body}</div>
      )}
    </div>
  );
}
