"use client";
import Link from "next/link";
import { useState } from "react";
import { useRanking } from "@/lib/client/hooks";
import type { VideoRowDto } from "@/lib/client/types";
import { formatCompact, formatPct } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const BY = [
  { v: "views", label: "Views" },
  { v: "ctr", label: "CTR" },
  { v: "retention", label: "Retensi" },
  { v: "engagement", label: "Engagement" },
] as const;
type By = (typeof BY)[number]["v"];

const value = (by: By, r: VideoRowDto) =>
  by === "views" ? `${formatCompact(r.views)} views` : by === "ctr" ? `CTR ${formatPct(r.ctrPct)}` : by === "retention" ? `Retensi ${formatPct(r.avgRetentionPct)}` : `Engagement ${formatPct(r.engagementPct)}`;

function List({
  title,
  tone,
  items,
  by,
  loading,
  error,
  onRetry,
  detailHref,
  limit,
}: {
  title: string;
  tone: "best" | "worst";
  items: (VideoRowDto & { rank: number })[] | undefined;
  by: By;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  detailHref: (id: string) => string;
  limit: number;
}) {
  return (
    <Card className="p-4 sm:p-5" data-testid={`ranking-${tone}`}>
      <h3 className="font-semibold">{title}</h3>
      {loading ? (
        <div className="mt-3 space-y-2">
          <LoadingNote label="Memuat ranking..." />
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : error ? (
        <Notice className="mt-3" tone="error" title="Ranking gagal dimuat." action={<Button size="sm" variant="secondary" onClick={onRetry}>Coba lagi</Button>} />
      ) : !items?.length ? (
        <p className="mt-3 text-sm text-sea-muted">Belum ada video yang memenuhi syarat pada rentang ini.</p>
      ) : (
        <>
          <ol className="mt-3 space-y-1">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  href={detailHref(r.id)}
                  className="flex min-h-12 items-center gap-3 rounded-control px-2 py-1.5 hover:bg-sea-tint"
                  aria-label={`Peringkat ${r.rank}: ${r.title}, ${value(by, r)}. Lihat detail`}
                >
                  <span
                    className={cn(
                      "inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-tag px-1 text-sm font-bold tabular",
                      // Aksen terakota menandai video yang perlu perhatian (terbawah); bukan error.
                      tone === "worst" ? "border border-sea-accent text-sea-accent" : "bg-sea-primary text-sea-on-primary",
                    )}
                  >
                    {tone === "best" ? `#${r.rank}` : `${r.rank}`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block text-xs text-sea-muted tabular">
                      {value(by, r)}
                      {by !== "views" ? ` · ${formatCompact(r.views)} views` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {items.length < limit ? (
            <p className="mt-2 text-xs text-sea-muted">Hanya {items.length} video yang memenuhi syarat.</p>
          ) : null}
        </>
      )}
    </Card>
  );
}

export function RankingPanel({ channelId, from, to, detailHref }: { channelId: string; from: string; to: string; detailHref: (id: string) => string }) {
  const [by, setBy] = useState<By>("views");
  const [hideSmallPref, setHideSmall] = useState<boolean | null>(null);
  const hideSmall = hideSmallPref ?? (by === "ctr" || by === "retention");
  const [ten, setTen] = useState(false);
  const limit = ten ? 10 : 5;
  const best = useRanking(channelId, from, to, by, "desc", hideSmall, limit);
  const worst = useRanking(channelId, from, to, by, "asc", hideSmall, 5);

  return (
    <section aria-labelledby="ranking-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ranking-h" className="text-lg">Ranking video</h2>
        <div role="group" aria-label="Urutkan ranking berdasarkan" className="inline-flex rounded-control border border-sea-line bg-sea-surface p-1">
          {BY.map((b) => (
            <button
              key={b.v}
              type="button"
              aria-pressed={by === b.v}
              onClick={() => {
                setBy(b.v);
                setHideSmall(null);
              }}
              className={cn("h-10 rounded-[8px] px-3 text-sm font-semibold", by === b.v ? "bg-sea-primary text-sea-on-primary" : "hover:bg-sea-tint")}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={hideSmall} onChange={(e) => setHideSmall(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
          Sembunyikan video dengan views di bawah 100
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={ten} onChange={(e) => setTen(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
          Tampilkan 10 terbaik
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <List title={`${limit} terbaik`} tone="best" items={best.data?.data.items} by={by} loading={best.isLoading} error={best.isError} onRetry={() => best.refetch()} detailHref={detailHref} limit={limit} />
        <List title="5 terendah" tone="worst" items={worst.data?.data.items} by={by} loading={worst.isLoading} error={worst.isError} onRetry={() => worst.refetch()} detailHref={detailHref} limit={5} />
      </div>
      <p className="text-sm text-sea-muted">
        Video privat atau dihapus tidak ikut ranking. Nilai sama diurutkan berdasarkan views tertinggi.
      </p>
    </section>
  );
}
