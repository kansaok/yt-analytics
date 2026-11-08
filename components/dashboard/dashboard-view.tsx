"use client";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useActiveChannel, useMetrics, useSyncNow, useTimeseries } from "@/lib/client/hooks";
import { useRange, useUi, type Metric } from "@/lib/client/store";
import type { ApiClientError } from "@/lib/client/api";
import { formatDateId, formatDateTimeId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";
import { MetricCard, type CardKind } from "./metric-card";
import { RangePicker } from "./range-picker";
import dynamic from "next/dynamic";
import { METRIC_LABEL } from "./metric-labels";

// Recharts dimuat terpisah agar JS awal route < 250 kB (prd/05 Performa).
const GrowthChart = dynamic(() => import("./growth-chart").then((m) => m.GrowthChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

const CARDS: CardKind[] = ["views", "subscribersNet", "watchTimeHours", "estRevenueUSD"];

export function DashboardView() {
  const { active, isLoading: chLoading, isError: chError, refetch } = useActiveChannel();
  const { from, to } = useRange();
  const { compare, metric, setMetric } = useUi();
  const syncing = active?.syncStatus === "syncing";
  const metrics = useMetrics(active?.id, from, to, syncing);
  const series = useTimeseries(active?.id, from, to, syncing);
  const syncNow = useSyncNow(active?.id);
  const qc = useQueryClient();

  // Sinkronisasi selesai => muat ulang metrik & grafik (cache server sudah diinvalidasi worker).
  useEffect(() => {
    if (active?.syncStatus === "synced") {
      qc.invalidateQueries({ queryKey: ["metrics", active.id] });
      qc.invalidateQueries({ queryKey: ["timeseries", active.id] });
    }
  }, [active?.syncStatus, active?.id, active?.lastSyncedAt, qc]);

  if (chLoading)
    return (
      <div className="space-y-6" >
        <LoadingNote label="Memuat dashboard..." />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CARDS.map((c) => <Skeleton key={c} className="h-[150px]" />)}
        </div>
        <Skeleton className="h-[360px]" />
      </div>
    );
  if (chError)
    return (
      <Notice tone="error" title="Dashboard gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Coba lagi</Button>}>
        Data Anda aman. Ini masalah koneksi ke server.
      </Notice>
    );
  if (!active)
    return (
      <Card className="mx-auto max-w-task p-8 text-center">
        <h1 className="text-[24px]">Hubungkan YouTube untuk mulai</h1>
        <p className="mt-2 text-sea-muted">
          Setelah channel terhubung, kami menarik 90 hari terakhir views, subscriber, watch time, dan daftar video Anda.
        </p>
        <Button asChild className="mt-6">
          <Link href="/channels">Pilih channel</Link>
        </Button>
      </Card>
    );

  const m = metrics.data?.data;
  const firstSync = syncing && !active.lastSyncedAt;
  const syncErr = metrics.error as ApiClientError | null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[26px]">{active.title}</h1>
          <p className="text-sm text-sea-muted">
            Terakhir disinkron: <span className="tabular">{formatDateTimeId(active.lastSyncedAt)}</span>
            {active.lastSyncedAt ? " WIB" : ""}
            {active.historySince ? <> · Data sejak {formatDateId(active.historySince)}</> : null}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => syncNow.mutate()}
          disabled={syncing || syncNow.isPending || active.needsReauth}
        >
          <ArrowsClockwise size={18} aria-hidden="true" />
          {syncing ? "Menyinkronkan..." : "Sinkron Sekarang"}
        </Button>
      </div>

      <div className="space-y-3" aria-live="polite">
        {syncing ? (
          <Notice tone="info" title={firstSync ? "Sinkronisasi awal berjalan..." : "Sinkronisasi berjalan..."}>
            {active.progress?.total
              ? `${active.progress.step} ${active.progress.done}/${active.progress.total}.`
              : active.progress?.step ?? "Menghubungi YouTube."}{" "}
            Halaman ini diperbarui otomatis; Anda bisa tetap menjelajah.
          </Notice>
        ) : null}
        {active.needsReauth ? (
          <Notice tone="attention" title="Koneksi terputus. Hubungkan ulang." action={<Button asChild size="sm"><Link href="/channels">Ke halaman Channel</Link></Button>}>
            Sinkronisasi otomatis dihentikan. Data terakhir tetap ditampilkan.
          </Notice>
        ) : active.syncError && !syncing ? (
          <Notice tone="attention" title={active.syncError}>
            {active.lastSyncedAt ? `Data per ${formatDateTimeId(active.lastSyncedAt)} WIB tetap ditampilkan.` : "Belum ada data yang tersimpan."}
          </Notice>
        ) : null}
        {syncNow.isError ? <Notice tone="attention" title={(syncNow.error as ApiClientError).message} /> : null}
        {syncErr ? (
          <Notice tone="error" title="Metrik gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => metrics.refetch()}>Coba lagi</Button>}>
            {syncErr.message}
          </Notice>
        ) : null}
      </div>

      <RangePicker />

      {firstSync && !m?.hasData ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
          {CARDS.map((c) => <Skeleton key={c} className="h-[150px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((k) =>
            m ? (
              <MetricCard
                key={k}
                kind={k}
                delta={m.metrics[k]}
                spark={(series.data?.data.points ?? []).map((p) => (k === "estRevenueUSD" ? null : (p[k as Metric] as number | null)))}
                selected={k === metric}
                onSelect={k === "estRevenueUSD" ? undefined : () => setMetric(k as Metric)}
                compare={compare}
                previousComplete={m.previousComplete}
              />
            ) : (
              <Skeleton key={k} className="h-[150px]" />
            ),
          )}
        </div>
      )}
      {m ? (
        <p className="text-xs text-sea-muted">
          Periode {formatDateId(m.period.from)} sampai {formatDateId(m.period.to)}
          {compare ? <> dibanding {formatDateId(m.period.compareFrom)} sampai {formatDateId(m.period.compareTo)}</> : null}.
          {m.includesPartialDays ? " Data 2-3 hari terakhir belum final dan bisa berubah." : ""} *Revenue tidak diambil di MVP.
        </p>
      ) : null}

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg">Pertumbuhan harian: {METRIC_LABEL[metric]}</h2>
          <div role="group" aria-label="Metrik grafik" className="flex gap-1">
            {(Object.keys(METRIC_LABEL) as Metric[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === metric}
                onClick={() => setMetric(k)}
                className={
                  k === metric
                    ? "h-11 rounded-control bg-sea-tint px-3 text-sm font-semibold text-sea-primary"
                    : "h-11 rounded-control px-3 text-sm text-sea-muted hover:bg-sea-tint"
                }
              >
                {k === "views" ? "Views" : k === "subscribersNet" ? "Subscriber" : "Watch time"}
              </button>
            ))}
          </div>
        </div>
        {series.isError ? (
          <Notice tone="error" title="Grafik gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => series.refetch()}>Coba lagi</Button>} />
        ) : firstSync && !m?.hasData ? (
          <div className="flex h-[320px] items-center justify-center text-sea-muted" role="status">Menyiapkan data...</div>
        ) : (
          <GrowthChart points={series.data?.data.points} metric={metric} compare={compare} loading={series.isLoading} />
        )}
        {m && m.hasData && m.metrics.views.value === 0 ? (
          <p className="mt-3 text-sm text-sea-muted">Upload video pertama, data akan muncul setelah sinkronisasi berikutnya.</p>
        ) : null}
      </Card>
    </div>
  );
}
