"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type ApiClientError } from "@/lib/client/api";
import { useRange } from "@/lib/client/store";
import { useChartColors, useReducedMotion } from "@/lib/client/theme-colors";
import { formatCompact, formatDateId, formatDuration, formatHours, formatInt, formatPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";
import { Tip } from "@/components/ui/tip";
import { RangePicker } from "@/components/dashboard/range-picker";

type Stats = {
  videoId: string;
  youtubeVideoId: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  thumbnailUrl: string | null;
  privacyStatus: string;
  available: boolean;
  unstable: boolean;
  hasStats: boolean;
  lastStatDate: string | null;
  lastStatSyncAt: string | null;
  views: number;
  likes: number;
  comments: number;
  watchTimeHours: number;
  impressions: number | null;
  ctrPct: number | null;
  avgViewDurationSec: number | null;
  avgRetentionPct: number | null;
  engagementPct: number | null;
  trafficSources: { source: string; views: number; pct: number }[];
  retentionCurve: { ratio: number; pct: number }[];
  daily: { date: string; views: number | null; watchTimeHours: number | null; partial: boolean }[];
};

const SOURCE_LABEL: Record<string, string> = {
  search: "Penelusuran YouTube",
  suggested: "Video yang disarankan",
  browse: "Fitur jelajah",
  external: "Eksternal",
  other: "Lainnya",
};
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

function Panel({ title, children, tip, testid }: { title: string; children: React.ReactNode; tip?: string; testid?: string }) {
  return (
    <Card className="p-4 sm:p-5" data-testid={testid}>
      <div className="mb-3 flex items-center gap-1">
        <h2 className="text-base">{title}</h2>
        {tip ? <Tip label={`Penjelasan ${title}`}>{tip}</Tip> : null}
      </div>
      {children}
    </Card>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-control border border-dashed border-sea-line px-6 text-center text-sm text-sea-muted" role="status">
      {text}
    </div>
  );
}

export function VideoDetailView({ id }: { id: string }) {
  const sp = useSearchParams();
  const back = sp.get("back") ?? "";
  const { from, to } = useRange();
  const colors = useChartColors();
  const reduced = useReducedMotion();
  const q = useQuery({
    queryKey: ["video-stats", id, from, to],
    queryFn: () => api<{ data: Stats }>(`/api/videos/${id}/stats?from=${from}&to=${to}`),
  });
  const backHref = `/videos${back ? `?${back}` : ""}`;
  const BackLink = (
    <Link href={backHref} className="inline-flex h-11 items-center gap-2 rounded-control pr-3 font-semibold text-sea-primary hover:underline">
      <ArrowLeft size={18} aria-hidden="true" /> Kembali ke daftar video
    </Link>
  );

  if (q.isLoading)
    return (
      <div className="space-y-6">
        <LoadingNote label="Memuat detail video..." />
        {BackLink}
        <Skeleton className="h-24" />
        <Skeleton className="h-[260px]" />
      </div>
    );
  if (q.isError) {
    const e = q.error as ApiClientError;
    return (
      <div className="space-y-6">
        {BackLink}
        <Notice
          tone="error"
          title={e.status === 404 || e.status === 403 ? "Video tidak ditemukan di channel Anda." : "Detail video gagal dimuat."}
          action={e.status >= 500 ? <Button size="sm" variant="secondary" onClick={() => q.refetch()}>Coba lagi</Button> : undefined}
        >
          {e.message}
        </Notice>
      </div>
    );
  }
  const s = q.data!.data;
  const noData = "Data belum cukup. Kembali lagi setelah 1-2 hari.";
  const topSource = s.trafficSources.reduce<Stats["trafficSources"][number] | null>((a, t) => (!a || t.views > a.views ? t : a), null);
  const tiedTop = topSource ? s.trafficSources.filter((t) => t.views === topSource.views).length > 1 : false;
  const curve = s.retentionCurve;
  const half = curve.find((p) => p.ratio >= 0.5);
  const dailyHas = s.daily.some((d) => d.views !== null);

  return (
    <div className="space-y-6">
      {BackLink}
      <div className="flex flex-col gap-4 sm:flex-row">
        {s.thumbnailUrl ? (
          <img src={s.thumbnailUrl} alt="" width={240} height={135} fetchPriority="high" className="aspect-video w-full max-w-[240px] rounded-control border border-sea-line object-cover" />
        ) : (
          <div aria-hidden="true" className="aspect-video w-full max-w-[240px] rounded-control bg-sea-tint" />
        )}
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px]">{s.title}</h1>
          <p className="mt-1 text-sea-muted">
            Terbit {formatDateId(s.publishedAt)} · Durasi {formatDuration(s.durationSec)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.durationSec > 0 && s.durationSec <= 60 ? <Badge tone="muted">Shorts</Badge> : null}
            {s.unstable ? <Badge tone="accent">Data belum stabil (terbit kurang dari 48 jam)</Badge> : null}
            {!s.available ? <Badge tone="accent">Tidak tersedia</Badge> : null}
          </div>
          {s.available ? (
            <a
              href={`https://www.youtube.com/watch?v=${s.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-control font-semibold text-sea-primary hover:underline"
            >
              Buka di YouTube <ArrowSquareOut size={16} aria-hidden="true" />
              <span className="sr-only">(tab baru)</span>
            </a>
          ) : null}
        </div>
      </div>

      {!s.available ? (
        <Notice tone="attention" title={`Statistik terakhir tersedia hingga ${s.lastStatDate ? formatDateId(s.lastStatDate) : "-"}. Video tidak dapat diputar.`}>
          Video ini privat atau sudah dihapus di YouTube. Data historis tetap disimpan.
        </Notice>
      ) : null}

      <RangePicker />

      {/* Fokus layar: views + CTR + retensi dalam satu baris angka */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-card border border-sea-line bg-sea-surface p-4 sm:grid-cols-4 sm:p-5" data-testid="video-metrics">
        {[
          ["Views", formatInt(s.views)],
          ["CTR thumbnail", formatPct(s.ctrPct)],
          ["Rata-rata durasi tonton", formatDuration(s.avgViewDurationSec)],
          ["Retensi rata-rata", formatPct(s.avgRetentionPct)],
          ["Watch time", formatHours(s.watchTimeHours)],
          ["Like", formatInt(s.likes)],
          ["Komentar", formatInt(s.comments)],
          ["Engagement", formatPct(s.engagementPct)],
        ].map(([k, v], i) => (
          <div key={k}>
            <dt className="text-sm text-sea-muted">{k}</dt>
            <dd className={i < 4 ? "text-[22px] font-bold tabular" : "text-lg font-semibold tabular"}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-3 text-xs text-sea-muted">
        CTR = klik / impresi. Engagement = (like + komentar) / views. Retensi dan CTR dari YouTube bisa terlambat 24-48 jam.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tren views harian" testid="panel-daily">
          {!dailyHas || !colors ? (
            <EmptyPanel text={noData} />
          ) : (
            <>
              <div className="h-[220px]" role="img" aria-label={`Views harian video ini, total ${formatInt(s.views)} pada periode terpilih.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.line }} tickLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      cursor={{ stroke: colors.muted }}
                      content={({ active, payload }) => {
                        const r = payload?.[0]?.payload as Stats["daily"][number] | undefined;
                        return active && r ? (
                          <div className="rounded-control border border-sea-line bg-sea-surface px-3 py-2 text-sm shadow-overlay">
                            <p className="font-semibold">{formatDateId(r.date)}{r.partial ? <span className="font-normal text-sea-accent"> · belum final</span> : null}</p>
                            <p className="tabular">{r.views === null ? "tidak ada data" : `${formatInt(r.views)} views`}</p>
                          </div>
                        ) : null;
                      }}
                    />
                    <Line type="monotone" dataKey="views" stroke={colors.primary} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={!reduced} animationDuration={180} activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-sm text-sea-muted">Total {formatInt(s.views)} views dan {formatHours(s.watchTimeHours)} watch time pada periode ini.</p>
            </>
          )}
        </Panel>

        <Panel
          title="Kurva retensi audiens"
          tip="Persentase penonton yang masih menonton di tiap titik durasi video (0% = awal, 100% = akhir). Bisa di atas 100% bila bagian itu diputar ulang."
          testid="panel-retention"
        >
          {!curve.length || !colors ? (
            <EmptyPanel text={noData} />
          ) : (
            <>
              <div className="h-[220px]" role="img" aria-label={`Kurva retensi. Di pertengahan video ${half ? formatPct(half.pct) : "-"} penonton masih menonton.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="ratio" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(r) => formatDuration(r * s.durationSec)} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.line }} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      cursor={{ stroke: colors.muted }}
                      content={({ active, payload }) => {
                        const r = payload?.[0]?.payload as { ratio: number; pct: number } | undefined;
                        return active && r ? (
                          <div className="rounded-control border border-sea-line bg-sea-surface px-3 py-2 text-sm shadow-overlay">
                            <p className="font-semibold tabular">Menit {formatDuration(r.ratio * s.durationSec)} ({Math.round(r.ratio * 100)}% durasi)</p>
                            <p className="tabular">{formatPct(r.pct)} penonton bertahan</p>
                          </div>
                        ) : null;
                      }}
                    />
                    <Line type="monotone" dataKey="pct" stroke={colors.primary} strokeWidth={2} dot={false} isAnimationActive={!reduced} animationDuration={180} activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-sm text-sea-muted">
                Di pertengahan video, {half ? formatPct(half.pct) : "-"} penonton masih menonton. Retensi rata-rata periode ini {formatPct(s.avgRetentionPct)}.
              </p>
            </>
          )}
        </Panel>

        <Panel title="Sumber traffic" tip="Dari mana penonton menemukan video ini, dikelompokkan dari taksonomi YouTube Analytics." testid="panel-traffic">
          {!s.trafficSources.length || !colors ? (
            <EmptyPanel text={noData} />
          ) : (
            <>
              {/* Bar berperingkat satu warna (bukan donut): validator dataviz menolak tint teal sebagai palet kategorikal. */}
              <div className="h-[200px]" role="img" aria-label={`Sumber traffic. Terbesar: ${topSource ? SOURCE_LABEL[topSource.source] : "-"} ${topSource ? formatPct(topSource.pct) : ""}.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...s.trafficSources].sort((a, b) => b.views - a.views)} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={6}>
                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                    <YAxis type="category" dataKey="source" tickFormatter={(k) => SOURCE_LABEL[k] ?? k} width={150} tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: colors.grid }}
                      content={({ active, payload }) => {
                        const r = payload?.[0]?.payload as Stats["trafficSources"][number] | undefined;
                        return active && r ? (
                          <div className="rounded-control border border-sea-line bg-sea-surface px-3 py-2 text-sm shadow-overlay">
                            <p className="font-semibold">{SOURCE_LABEL[r.source]}</p>
                            <p className="tabular">{formatInt(r.views)} views · {formatPct(r.pct)}</p>
                          </div>
                        ) : null;
                      }}
                    />
                    <Bar dataKey="views" fill={colors.primary} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      <LabelList dataKey="pct" position="right" formatter={(v: number) => formatPct(v)} style={{ fill: colors.text, fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-3 w-full text-sm tabular">
                <caption className="sr-only">Views per sumber traffic</caption>
                <thead>
                  <tr className="border-b border-sea-line text-left">
                    <th scope="col" className="py-1.5 font-semibold">Sumber</th>
                    <th scope="col" className="py-1.5 text-right font-semibold">Views</th>
                    <th scope="col" className="py-1.5 text-right font-semibold">Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {[...s.trafficSources].sort((a, b) => b.views - a.views).map((t) => (
                    <tr key={t.source} className="border-b border-sea-line last:border-0">
                      <td className="py-1.5">{SOURCE_LABEL[t.source] ?? t.source}</td>
                      <td className="py-1.5 text-right">{formatInt(t.views)}</td>
                      <td className="py-1.5 text-right">{formatPct(t.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-sm text-sea-muted">
                {tiedTop || !topSource
                  ? "Beberapa sumber menyumbang porsi yang sama besar."
                  : `${SOURCE_LABEL[topSource.source]} menyumbang porsi terbesar (${formatPct(topSource.pct)}).`}
                {topSource && topSource.pct > 80 ? " Traffic sangat terkonsentrasi pada satu sumber." : ""}
              </p>
            </>
          )}
        </Panel>

        <Panel title="CTR vs impresi" tip="Impresi: berapa kali thumbnail ditampilkan di YouTube. CTR: persentase impresi yang diklik." testid="panel-ctr">
          {s.ctrPct === null ? (
            <EmptyPanel text="Data CTR dan impresi belum tersedia dari YouTube untuk video ini." />
          ) : (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-sea-muted">Impresi</dt>
                  <dd className="text-[22px] font-bold tabular">{formatInt(s.impressions)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-sea-muted">CTR</dt>
                  <dd className="text-[22px] font-bold tabular">{formatPct(s.ctrPct)}</dd>
                </div>
              </dl>
              <p className="text-sm text-sea-muted">
                Sekitar {formatInt(Math.round(((s.impressions ?? 0) * (s.ctrPct ?? 0)) / 100))} dari {formatInt(s.impressions)} tampilan thumbnail menghasilkan klik pada periode ini.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
