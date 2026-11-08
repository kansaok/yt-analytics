import { ArrowDownRight, ArrowUpRight, Minus } from "@phosphor-icons/react/dist/ssr";
import { formatDeltaPct } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Naik/turun/stabil: ikon + teks + warna semantik (warna tidak berdiri sendiri). */
export function DeltaBadge({ pct, compareLabel, className }: { pct: number | null; compareLabel?: string; className?: string }) {
  if (pct === null)
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm text-sea-muted", className)}>
        <Minus size={14} aria-hidden="true" /> N/A{compareLabel ? <span className="sr-only"> {compareLabel}</span> : null}
      </span>
    );
  const dir = Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const word = dir === "up" ? "naik" : dir === "down" ? "turun" : "stabil";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold tabular",
        dir === "up" ? "text-sea-success" : dir === "down" ? "text-sea-danger" : "text-sea-muted",
        className,
      )}
      data-testid="delta-badge"
    >
      <Icon size={16} aria-hidden="true" />
      <span className="sr-only">{word} </span>
      {formatDeltaPct(pct)}
      {compareLabel ? <span className="font-normal text-sea-muted"> {compareLabel}</span> : null}
    </span>
  );
}
