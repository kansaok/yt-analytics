"use client";
import { useState } from "react";
import { useUi, useRange } from "@/lib/client/store";
import { cn } from "@/lib/cn";

const PRESETS = [
  { v: 7, label: "7 hari" },
  { v: 28, label: "28 hari" },
  { v: 90, label: "90 hari" },
] as const;

/** Preset 7/28/90 + kustom (Scope S3) dan toggle banding periode. Rentang kustom maks 365 hari, tidak ke masa depan. */
export function RangePicker() {
  const { preset, setPreset, setCustom, compare, setCompare } = useUi();
  const range = useRange();
  const [open, setOpen] = useState(preset === "custom");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setErr("Isi kedua tanggal.");
    if (from > to) return setErr("Tanggal mulai harus sebelum tanggal akhir.");
    if (to > today) return setErr("Tanggal akhir tidak boleh melewati hari ini.");
    if ((Date.parse(to) - Date.parse(from)) / 86400_000 + 1 > 365) return setErr("Rentang maksimal 365 hari.");
    setErr(null);
    setCustom(from, to);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Rentang tanggal" className="inline-flex rounded-control border border-sea-line bg-sea-surface p-1">
          {PRESETS.map((p) => (
            <button
              key={p.v}
              type="button"
              aria-pressed={preset === p.v}
              onClick={() => {
                setPreset(p.v);
                setOpen(false);
              }}
              className={cn(
                "h-10 rounded-[8px] px-3 text-sm font-semibold sm:px-4",
                preset === p.v ? "bg-sea-primary text-sea-on-primary" : "text-sea-text hover:bg-sea-tint",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={preset === "custom"}
            aria-expanded={open}
            aria-controls="rentang-kustom"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "h-10 rounded-[8px] px-3 text-sm font-semibold sm:px-4",
              preset === "custom" ? "bg-sea-primary text-sea-on-primary" : "text-sea-text hover:bg-sea-tint",
            )}
          >
            Kustom
          </button>
        </div>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="h-5 w-5 accent-[var(--primary)]"
          />
          Bandingkan dengan periode sebelumnya
        </label>
      </div>
      {open ? (
        <form id="rentang-kustom" onSubmit={apply} className="flex flex-wrap items-end gap-3" noValidate>
          <div>
            <label htmlFor="dari" className="block text-sm font-medium">Dari</label>
            <input id="dari" type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)}
              className="mt-1 h-11 rounded-control border-[1.5px] border-sea-line bg-sea-surface px-3 text-sea-text" />
          </div>
          <div>
            <label htmlFor="sampai" className="block text-sm font-medium">Sampai</label>
            <input id="sampai" type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)}
              className="mt-1 h-11 rounded-control border-[1.5px] border-sea-line bg-sea-surface px-3 text-sea-text" />
          </div>
          <button type="submit" className="h-11 rounded-control border-[1.5px] border-sea-primary px-4 font-semibold text-sea-primary hover:bg-sea-tint">
            Terapkan
          </button>
          <p className="w-full text-sm text-sea-muted">Periode pembanding otomatis memakai durasi yang sama tepat sebelum rentang ini.</p>
          {err ? <p role="alert" className="w-full text-sm font-medium text-sea-danger">{err}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
