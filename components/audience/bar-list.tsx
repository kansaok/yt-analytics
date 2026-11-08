import { cn } from "@/lib/cn";

export type BarItem = { key: string; label: string; pct: number; value?: string; sub?: string };

/** Hanya satu baris yang boleh disorot, dan hanya bila nilai tertingginya tunggal (DESIGN.md: sorot hanya bila ada beda nyata). */
export function uniqueTopKey(items: BarItem[]): string | null {
  if (items.length < 2) return null;
  const max = Math.max(...items.map((i) => i.pct));
  const tops = items.filter((i) => i.pct === max);
  return max > 0 && tops.length === 1 ? tops[0].key : null;
}

/**
 * Bar horizontal berperingkat: satu warna teal; label dan nilai langsung di teks (warna tidak membawa makna sendirian).
 * Dipakai sebagai pengganti donut karena tint teal tidak lolos uji palet kategorikal.
 * - `highlightTop`: terakota untuk puncak tunggal, hanya dipakai bila kalimat judul grafik menyebut puncak itu.
 * - `stackOnMobile`: label di atas bar pada layar kecil agar label panjang tidak terpotong.
 */
export function BarList({
  items,
  label,
  labelWidth = "sm:w-36",
  highlightTop = false,
  stackOnMobile = false,
}: {
  items: BarItem[];
  label: string;
  labelWidth?: string;
  highlightTop?: boolean;
  stackOnMobile?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.pct));
  const top = highlightTop ? uniqueTopKey(items) : null;
  return (
    <ul aria-label={label} className="space-y-2.5">
      {items.map((i) => (
        <li
          key={i.key}
          className={cn(stackOnMobile ? "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:flex" : "flex items-center gap-3")}
          title={`${i.label}: ${i.value ?? `${i.pct}%`}`}
        >
          {/* Mode inline: lebar tetap 96px di mobile, labelWidth di sm+ agar bar antar baris sejajar. */}
          <span className={cn("min-w-0 truncate text-sm", stackOnMobile ? "sm:shrink-0" : "w-24 shrink-0", labelWidth)}>
            {i.label}
          </span>
          <span
            className={cn(
              "relative h-5 min-w-0 rounded-tag bg-sea-tint",
              stackOnMobile ? "order-3 col-span-2 sm:order-2 sm:flex-1" : "flex-1",
            )}
            aria-hidden="true"
          >
            <span
              className={cn("absolute inset-y-0 left-0 rounded-tag", i.key === top ? "bg-sea-accent" : "bg-sea-primary")}
              style={{ width: `${Math.max(i.pct > 0 ? 2 : 0, (i.pct / max) * 100)}%` }}
            />
          </span>
          <span className={cn("w-[4.5rem] shrink-0 text-right text-sm font-semibold tabular", stackOnMobile && "order-2 sm:order-3")}>
            {i.value ?? `${i.pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`}
          </span>
          {i.sub ? <span className="sr-only">{i.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}
