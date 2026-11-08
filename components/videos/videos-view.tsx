"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CaretDown, CaretUp, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useActiveChannel, useVideos } from "@/lib/client/hooks";
import { useRange } from "@/lib/client/store";
import type { VideoRowDto } from "@/lib/client/types";
import { formatCompact, formatDateId, formatDuration, formatHours, formatInt, formatPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";
import { RangePicker } from "@/components/dashboard/range-picker";
import { RankingPanel } from "./ranking-panel";
import { cn } from "@/lib/cn";

type Col = { key: string; label: string; sortable: boolean; align?: "right"; cell: (v: VideoRowDto) => React.ReactNode; hideSm?: boolean };

const COLS: Col[] = [
  { key: "publishedAt", label: "Terbit", sortable: true, cell: (v) => formatDateId(v.publishedAt) },
  { key: "views", label: "Views", sortable: true, align: "right", cell: (v) => formatInt(v.views) },
  { key: "watchTime", label: "Watch time", sortable: true, align: "right", cell: (v) => formatHours(v.watchTimeHours) },
  { key: "likes", label: "Like", sortable: true, align: "right", cell: (v) => formatInt(v.likes) },
  { key: "comments", label: "Komentar", sortable: true, align: "right", cell: (v) => formatInt(v.comments) },
  { key: "ctr", label: "CTR", sortable: true, align: "right", cell: (v) => formatPct(v.ctrPct) },
  { key: "retention", label: "Retensi rata-rata", sortable: true, align: "right", cell: (v) => formatPct(v.avgRetentionPct) },
  { key: "duration", label: "Durasi", sortable: false, align: "right", cell: (v) => formatDuration(v.durationSec) },
];

function StatusBadges({ v }: { v: VideoRowDto }) {
  return (
    <>
      {v.isShort ? <Badge tone="muted">Shorts</Badge> : null}
      {!v.available ? <Badge tone="accent">{v.privacyStatus === "deleted" ? "Tidak tersedia" : "Privat"}</Badge> : null}
      {!v.hasStats && v.available ? <Badge tone="muted">Belum ada data periode ini</Badge> : null}
    </>
  );
}

export function VideosView() {
  const router = useRouter();
  const sp = useSearchParams();
  const { active, isLoading: chLoading } = useActiveChannel();
  const { from, to } = useRange();
  const sort = sp.get("sort") ?? "views";
  const order = (sp.get("order") as "asc" | "desc") ?? "desc";
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const search = sp.get("search") ?? "";
  const published = sp.get("published") ?? undefined;
  const [term, setTerm] = useState(search);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  useEffect(() => setTerm(search), [search]);

  const q = useVideos(active?.id, from, to, { sort, order, page, search, published });

  // URL query = state tabel (bisa dibagikan, tombol kembali dari detail mempertahankannya).
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v === null || v === "" ? next.delete(k) : next.set(k, v);
    router.replace(`/videos${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const toggleSort = (key: string) =>
    setParams({ sort: key, order: sort === key && order === "desc" ? "asc" : "desc", page: null });
  const detailHref = (id: string) => `/videos/${id}?back=${encodeURIComponent(sp.toString())}`;

  if (chLoading)
    return (
      <div className="space-y-4">
        <LoadingNote label="Memuat daftar video..." />
        <Skeleton className="h-[400px]" />
      </div>
    );
  if (!active)
    return (
      <Card className="mx-auto max-w-task p-8 text-center">
        <h1 className="text-[24px]">Belum ada channel</h1>
        <p className="mt-2 text-sea-muted">Hubungkan channel untuk melihat performa tiap video.</p>
        <Button asChild className="mt-6"><Link href="/channels">Pilih channel</Link></Button>
      </Card>
    );

  const rows = q.data?.data ?? [];
  const meta = q.data?.meta;
  const compared = rows.filter((v) => compareIds.includes(v.id));
  const toggleCompare = (id: string) =>
    setCompareIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current,
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px]">Video</h1>
        <p className="mt-1 text-sea-muted">Performa tiap video di {active.title} pada periode terpilih.</p>
      </div>
      <RangePicker />
      <RankingPanel channelId={active.id} from={from} to={to} detailHref={detailHref} />

      {compareIds.length > 0 ? (
        <section aria-labelledby="bandingkan-h" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="bandingkan-h" className="text-lg">Bandingkan video</h2>
              <p className="text-sm text-sea-muted">
                {compared.length < 2 ? "Pilih satu video lagi dari tabel (maksimal 3)." : `Membandingkan ${compared.length} video pada periode terpilih.`}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCompareIds([])}>Kosongkan</Button>
          </div>
          {compared.length >= 2 ? (
            <Card as="div" className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm tabular">
                <caption className="sr-only">Perbandingan metrik video terpilih</caption>
                <thead><tr className="border-b border-sea-line text-left"><th className="px-3 py-3 font-semibold">Metrik</th>{compared.map((v) => <th key={v.id} className="max-w-[220px] px-3 py-3 font-semibold"><span className="line-clamp-2">{v.title}</span></th>)}</tr></thead>
                <tbody>
                  {[
                    ["Views", (v: VideoRowDto) => formatInt(v.views)],
                    ["Watch time", (v: VideoRowDto) => formatHours(v.watchTimeHours)],
                    ["Like", (v: VideoRowDto) => formatInt(v.likes)],
                    ["Komentar", (v: VideoRowDto) => formatInt(v.comments)],
                    ["CTR", (v: VideoRowDto) => formatPct(v.ctrPct)],
                    ["Retensi rata-rata", (v: VideoRowDto) => formatPct(v.avgRetentionPct)],
                    ["Engagement", (v: VideoRowDto) => formatPct(v.engagementPct)],
                  ].map(([label, value]) => <tr key={label as string} className="border-b border-sea-line last:border-0"><th className="px-3 py-2 text-left font-medium">{label as string}</th>{compared.map((v) => <td key={v.id} className="px-3 py-2">{(value as (v: VideoRowDto) => string)(v)}</td>)}</tr>)}
                </tbody>
              </table>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="tabel-h" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="tabel-h" className="text-lg">Semua video</h2>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setParams({ search: term.trim(), page: null });
            }}
            className="flex w-full items-end gap-2 sm:w-auto"
          >
            <div className="flex-1 sm:w-72">
              <label htmlFor="cari" className="block text-sm font-medium">Cari judul</label>
              <div className="relative mt-1">
                <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sea-muted" aria-hidden="true" />
                <input
                  id="cari"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="mis. resep"
                  className="h-11 w-full rounded-control border-[1.5px] border-sea-line bg-sea-surface pl-9 pr-3 text-sea-text placeholder:text-sea-muted"
                />
              </div>
            </div>
            <Button type="submit" size="sm" variant="secondary">Cari</Button>
          </form>
        </div>

        {published ? (
          <Notice
            tone="info"
            title={`Menampilkan video yang terbit ${formatDateId(published)}.`}
            action={<Button size="sm" variant="ghost" onClick={() => setParams({ published: null, page: null })}><X size={16} aria-hidden="true" /> Hapus filter</Button>}
          />
        ) : null}

        {q.isError ? (
          <Notice tone="error" title="Tabel video gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => q.refetch()}>Coba lagi</Button>}>
            Data Anda aman.
          </Notice>
        ) : q.isLoading ? (
          <div className="space-y-2">
            <LoadingNote label="Memuat daftar video..." />
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-card border border-dashed border-sea-line px-6 py-10 text-center">
            {search || published ? (
              <>
                <p className="font-semibold">
                  {search ? `Tidak ada video cocok dengan "${search}" pada rentang ini.` : "Tidak ada video yang terbit pada tanggal itu."}
                </p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setParams({ search: null, published: null, page: null })}>
                  Reset filter
                </Button>
              </>
            ) : active.syncStatus === "syncing" ? (
              <p className="font-semibold">Sedang memuat daftar video...</p>
            ) : (
              <>
                <p className="font-semibold">Belum ada video disinkronkan.</p>
                <p className="mt-1 text-sm text-sea-muted">Pastikan video Anda publik atau unlisted di YouTube Studio, lalu sinkron ulang.</p>
                <Button asChild variant="secondary" size="sm" className="mt-4"><Link href="/channels">Sinkron ulang</Link></Button>
              </>
            )}
          </div>
        ) : (
          <Card as="div" className={cn("overflow-hidden", q.isFetching && "opacity-70 transition-opacity")}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm tabular" data-testid="video-table">
                <caption className="sr-only">
                  Tabel performa video, diurutkan berdasarkan {sort} {order === "desc" ? "menurun" : "menaik"}
                </caption>
                <thead>
                  <tr className="border-b border-sea-line text-left">
                    <th scope="col" className="sticky left-0 z-10 w-[180px] bg-sea-surface px-3 py-3 font-semibold sm:w-[320px]">Video</th>
                    <th scope="col" className="w-14 px-2 py-3 text-center font-semibold"><span className="sr-only">Bandingkan</span></th>
                    {COLS.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={sort === c.key ? (order === "desc" ? "descending" : "ascending") : c.sortable ? "none" : undefined}
                        className={cn("px-3 py-2 font-semibold whitespace-nowrap", c.align === "right" && "text-right")}
                      >
                        {c.sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className={cn(
                              "inline-flex h-10 items-center gap-1 rounded-control px-1.5 hover:bg-sea-tint",
                              sort === c.key ? "text-sea-primary" : "",
                            )}
                          >
                            {c.label}
                            {sort === c.key ? (order === "desc" ? <CaretDown size={14} aria-hidden="true" /> : <CaretUp size={14} aria-hidden="true" />) : null}
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id} className="group border-b border-sea-line last:border-0 hover:bg-sea-tint/60" data-testid="video-row">
                      <th scope="row" className="sticky left-0 z-10 bg-sea-surface px-3 py-2 text-left font-normal group-hover:bg-sea-tint">
                        <Link href={detailHref(v.id)} className="flex items-center gap-3 rounded-control py-1">
                          {v.thumbnailUrl ? (
                            <img src={v.thumbnailUrl} alt="" width={64} height={36} loading="lazy" className="hidden h-9 w-16 shrink-0 rounded-tag object-cover sm:block" />
                          ) : (
                            <span aria-hidden="true" className="hidden h-9 w-16 shrink-0 rounded-tag bg-sea-tint sm:block" />
                          )}
                          <span className="min-w-0">
                            <span className="line-clamp-2 font-medium text-sea-text group-hover:underline">{v.title}</span>
                            <span className="mt-0.5 flex flex-wrap gap-1"><StatusBadges v={v} /></span>
                          </span>
                        </Link>
                      </th>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Bandingkan ${v.title}`}
                          checked={compareIds.includes(v.id)}
                          disabled={!compareIds.includes(v.id) && compareIds.length >= 3}
                          onChange={() => toggleCompare(v.id)}
                          className="h-4 w-4 accent-sea-primary"
                        />
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className={cn("px-3 py-2 whitespace-nowrap", c.align === "right" && "text-right")}>
                          {c.cell(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {meta && meta.total > 0 ? (
          <nav aria-label="Halaman tabel" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-sea-muted tabular">
              Halaman {meta.page} dari {meta.totalPages} · {formatCompact(meta.total)} video
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
                Sebelumnya
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= meta.totalPages} onClick={() => setParams({ page: String(page + 1) })}>
                Berikutnya
              </Button>
            </div>
          </nav>
        ) : null}
        <p className="text-sm text-sea-muted">
          CTR dan retensi tampil &quot;-&quot; bila YouTube belum menyediakan datanya (mis. video sangat baru). Statistik harian disinkron untuk 50 video terbaru.
        </p>
      </section>
    </div>
  );
}
