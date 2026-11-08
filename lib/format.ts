/** Pembulatan konsisten gaya Indonesia: 1,2rb / 3,4jt / 1,1M. */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const one = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  if (abs >= 1e9) return `${sign}${one(abs / 1e9)}M`;
  if (abs >= 1e6) return `${sign}${one(abs / 1e6)}jt`;
  if (abs >= 1e3) return `${sign}${one(abs / 1e3)}rb`;
  return `${sign}${Math.round(abs).toLocaleString("id-ID")}`;
}

export function formatInt(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return Math.round(n).toLocaleString("id-ID");
}

/** Watch time selalu jam dengan 1 desimal. */
export function formatHours(h: number | null | undefined) {
  if (h === null || h === undefined) return "-";
  return `${h.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jam`;
}

export function formatPct(p: number | null | undefined, digits = 1) {
  if (p === null || p === undefined || Number.isNaN(p)) return "-";
  return `${p.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatDeltaPct(p: number | null | undefined) {
  if (p === null || p === undefined) return "N/A";
  const s = p > 0 ? "+" : "";
  return `${s}${formatPct(p)}`;
}

export function formatDuration(sec: number | null | undefined) {
  if (sec === null || sec === undefined) return "-";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

export function formatUsd(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return `US$${n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateId(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTimeId(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}
