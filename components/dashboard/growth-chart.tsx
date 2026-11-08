"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PointDto } from "@/lib/client/types";
import type { Metric } from "@/lib/client/store";
import { useChartColors, useReducedMotion } from "@/lib/client/theme-colors";
import { formatCompact, formatDateId, formatDeltaPct, formatHours, formatInt } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

import { METRIC_LABEL } from "./metric-labels";
const PREV_KEY: Record<Metric, keyof PointDto> = {
  views: "previousViews",
  subscribersNet: "previousSubscribersNet",
  watchTimeHours: "previousWatchTimeHours",
};
const fmtVal = (m: Metric, v: number | null) =>
  v === null ? "tidak ada data" : m === "watchTimeHours" ? formatHours(v) : formatInt(v);
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

type Row = { date: string; cur: number | null; prev: number | null; prevDate: string | null; partial: boolean; partialVal: number | null };

/** Downsampling klien untuk rentang panjang (>180 titik): rata-rata per bucket, gap tetap gap. */
function downsample(rows: Row[], max = 180): Row[] {
  if (rows.length <= max) return rows;
  const size = Math.ceil(rows.length / max);
  const out: Row[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const b = rows.slice(i, i + size);
    const avg = (k: "cur" | "prev") => {
      const xs = b.map((r) => r[k]).filter((x): x is number => x !== null);
      return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null;
    };
    out.push({ ...b[0], cur: avg("cur"), prev: avg("prev"), partial: b.some((r) => r.partial), partialVal: null });
  }
  return out;
}

export function GrowthChart({
  points,
  metric,
  compare,
  loading,
}: {
  points: PointDto[] | undefined;
  metric: Metric;
  compare: boolean;
  loading?: boolean;
}) {
  const colors = useChartColors();
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  const rows: Row[] = useMemo(
    () =>
      (points ?? []).map((p) => {
        const cur = p[metric] as number | null;
        return {
          date: p.date,
          cur,
          prev: p[PREV_KEY[metric]] as number | null,
          prevDate: p.previousDate,
          partial: p.partial,
          // Titik "belum final" diberi marker aksen tersendiri.
          partialVal: p.partial ? cur : null,
        };
      }),
    [points, metric],
  );
  const data = useMemo(() => downsample(rows), [rows]);
  const hasData = rows.some((r) => r.cur !== null);
  const gaps = rows.filter((r) => r.cur === null).length;

  const summary = useMemo(() => {
    const vals = rows.filter((r) => r.cur !== null) as (Row & { cur: number })[];
    if (!vals.length) return "";
    const total = vals.reduce((a, r) => a + r.cur, 0);
    const prevVals = rows.filter((r) => r.prev !== null);
    const prevTotal = prevVals.reduce((a, r) => a + (r.prev ?? 0), 0);
    const best = vals.reduce((a, r) => (r.cur > a.cur ? r : a), vals[0]);
    const tie = vals.filter((r) => r.cur === best.cur).length > 1;
    const unit = metric === "watchTimeHours" ? formatHours(total) : formatCompact(total);
    let s = `${METRIC_LABEL[metric]} periode ini ${unit}`;
    if (compare && prevVals.length === rows.length && prevTotal !== 0)
      s += `, ${formatDeltaPct(Math.round(((total - prevTotal) / Math.abs(prevTotal)) * 1000) / 10)} dibanding periode sebelumnya`;
    s += tie ? ". Beberapa hari memiliki nilai tertinggi yang sama." : `. Hari tertinggi: ${formatDateId(best.date)} (${fmtVal(metric, best.cur)}).`;
    if (gaps) s += ` ${gaps} hari tanpa data ditampilkan sebagai celah.`;
    return s;
  }, [rows, metric, compare, gaps]);

  if (loading || !colors)
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-3" role="status">
        <Skeleton className="h-[260px] w-full" />
        <span className="text-sm text-sea-muted">Menyiapkan grafik...</span>
      </div>
    );
  if (!hasData)
    return (
      <div className="flex h-[320px] flex-col items-center justify-center rounded-card border border-dashed border-sea-line px-6 text-center" role="status">
        <p className="font-semibold">Belum ada data pada rentang ini.</p>
        <p className="mt-1 text-sm text-sea-muted">Coba 7 hari terakhir, atau tunggu sinkronisasi berikutnya.</p>
      </div>
    );

  const pickedRow = picked ? rows.find((r) => r.date === picked) : null;
  const yFmt = (v: number) => (metric === "watchTimeHours" ? formatCompact(v) : formatCompact(v));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {/* Legenda selalu ada bila >= 2 deret; identitas tidak hanya warna (garis penuh vs putus-putus). */}
        <span className="inline-flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke={colors.primary} strokeWidth="2" /></svg>
          Periode ini
        </span>
        {compare ? (
          <span className="inline-flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke={colors.c3} strokeWidth="2" strokeDasharray="5 4" /></svg>
            Periode sebelumnya
          </span>
        ) : null}
        {rows.some((r) => r.partial && r.cur !== null) ? (
          <span className="inline-flex items-center gap-2">
            <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={colors.accent} /></svg>
            Belum final (data YouTube 2-3 hari terakhir masih berubah)
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          aria-pressed={asTable}
          className="ml-auto inline-flex h-11 items-center rounded-control px-3 font-semibold text-sea-primary hover:bg-sea-tint"
        >
          {asTable ? "Tampilkan grafik" : "Tampilkan tabel"}
        </button>
      </div>

      {asTable ? (
        <div className="relative max-h-[360px] overflow-auto rounded-control border border-sea-line">
          <table className="w-full text-sm tabular">
            <caption className="sr-only">{METRIC_LABEL[metric]} harian</caption>
            <thead className="sticky top-0 bg-sea-surface">
              <tr className="border-b border-sea-line text-left">
                <th scope="col" className="px-3 py-2 font-semibold">Tanggal</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Periode ini</th>
                {compare ? <th scope="col" className="px-3 py-2 text-right font-semibold">Periode lalu</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="border-b border-sea-line last:border-0">
                  <td className="px-3 py-1.5">{formatDateId(r.date)}{r.partial ? " (belum final)" : ""}</td>
                  <td className="px-3 py-1.5 text-right">{r.cur === null ? "-" : fmtVal(metric, r.cur)}</td>
                  {compare ? <td className="px-3 py-1.5 text-right">{r.prev === null ? "-" : fmtVal(metric, r.prev)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[320px] w-full" role="img" aria-label={`Grafik garis ${METRIC_LABEL[metric]} harian. ${summary}`} data-testid="growth-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              onClick={(s) => {
                const d = (s?.activePayload?.[0]?.payload as Row | undefined)?.date;
                if (d) setPicked(d);
              }}
            >
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fill: colors.muted, fontSize: 12 }}
                axisLine={{ stroke: colors.line }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis tickFormatter={yFmt} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                cursor={{ stroke: colors.muted, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as Row | undefined;
                  if (!active || !r) return null;
                  return (
                    <div className="rounded-control border border-sea-line bg-sea-surface px-3 py-2 text-sm shadow-overlay">
                      <p className="font-semibold">
                        {formatDateId(r.date)}
                        {r.partial ? <span className="font-normal text-sea-accent"> · belum final</span> : null}
                      </p>
                      <p className="tabular">Periode ini: {fmtVal(metric, r.cur)}</p>
                      {compare ? (
                        <p className="tabular text-sea-muted">
                          {r.prevDate ? formatDateId(r.prevDate) : "Periode lalu"}: {fmtVal(metric, r.prev)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-sea-muted">Klik untuk melihat video yang terbit hari itu</p>
                    </div>
                  );
                }}
              />
              {compare ? (
                <Line
                  type="monotone"
                  dataKey="prev"
                  stroke={colors.c3}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4, fill: colors.c3, stroke: colors.surface, strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={!reduced}
                  animationDuration={180}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="cur"
                stroke={colors.primary}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: colors.primary, stroke: colors.surface, strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={!reduced}
                animationDuration={180}
              />
              <Line
                dataKey="partialVal"
                stroke="none"
                dot={{ r: 4, fill: colors.accent, stroke: colors.surface, strokeWidth: 2 }}
                activeDot={false}
                isAnimationActive={false}
                legendType="none"
              />
              {data.length > 31 ? (
                <Brush dataKey="date" height={28} stroke={colors.c3} fill={colors.surface} travellerWidth={10} tickFormatter={shortDate} />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-3 text-sm text-sea-muted" data-testid="chart-summary">{summary}</p>
      {data.length > 31 && !asTable ? (
        <p className="mt-1 text-xs text-sea-muted">Geser pegangan di bawah grafik untuk zoom dan menggeser rentang.</p>
      ) : null}

      {pickedRow ? (
        <div className={cn("mt-4 flex flex-wrap items-center gap-3 rounded-control border border-sea-line px-4 py-3")} role="status">
          <p className="text-sm">
            <span className="font-semibold">{formatDateId(pickedRow.date)}</span>: {fmtVal(metric, pickedRow.cur)}
            {compare ? <span className="text-sea-muted"> · periode lalu {fmtVal(metric, pickedRow.prev)}</span> : null}
          </p>
          <Link
            href={`/videos?published=${pickedRow.date}`}
            className="inline-flex h-11 items-center rounded-control px-3 font-semibold text-sea-primary underline-offset-4 hover:bg-sea-tint hover:underline"
          >
            Lihat video terbit hari itu
          </Link>
          <button type="button" onClick={() => setPicked(null)} className="ml-auto h-11 rounded-control px-3 text-sm hover:bg-sea-tint">
            Tutup
          </button>
        </div>
      ) : null}
    </div>
  );
}
