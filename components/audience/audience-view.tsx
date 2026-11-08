"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useActiveChannel, useDemographics, useTraffic, useWatchHeatmap } from "@/lib/client/hooks";
import { useRange } from "@/lib/client/store";
import { formatDateId, formatDateTimeId, formatInt, formatHours, formatPct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";
import { RangePicker } from "@/components/dashboard/range-picker";
import { DeltaBadge } from "@/components/dashboard/delta-badge";
import { BarList } from "./bar-list";
import { HeatStrip } from "./heat-strip";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "demografi", label: "Demografi" },
  { key: "waktu", label: "Waktu optimal" },
  { key: "traffic", label: "Sumber traffic" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingNote label="Memuat data audiens..." />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-[220px]" />
    </div>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-sea-line px-6 py-10 text-center" role="status">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-[520px] text-sm text-sea-muted">{children}</p>
    </div>
  );
}

function Demografi({ channelId }: { channelId: string }) {
  const { from, to } = useRange();
  const q = useDemographics(channelId, from, to);
  const [sort, setSort] = useState<"views" | "watch">("views");
  if (q.isLoading) return <PanelSkeleton />;
  if (q.isError)
    return <Notice tone="error" title="Data demografi gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => q.refetch()}>Coba lagi</Button>}>Data Anda aman.</Notice>;
  const d = q.data!.data;
  if (!d.hasData)
    return (
      <Empty title="Data demografi belum tersedia.">
        {d.syncedAt
          ? "YouTube menyembunyikan demografi untuk channel dengan penonton sedikit (ambang privasi), dan tidak ada data individu yang dapat ditampilkan."
          : "Channel ini belum menyelesaikan sinkronisasi audiens. Data muncul setelah sinkronisasi berikutnya."}
      </Empty>
    );
  const countries = [...d.countries].sort((a, b) => (sort === "views" ? b.views - a.views : b.watchTimeHours - a.watchTimeHours));
  return (
    <div className="space-y-8">
      <div>
        {d.summary ? <p className="text-[22px] font-bold leading-snug sm:text-[26px]" data-testid="demo-summary">{d.summary}</p> : null}
        <p className="mt-1 text-sm text-sea-muted">
          Data {d.windowLabel}, disinkron {formatDateTimeId(d.syncedAt)} WIB.
          {d.requestedDays !== d.windowDays ? ` Rentang ${d.requestedDays} hari dipetakan ke jendela ${d.windowDays} hari karena audiens disinkron per jendela 28 dan 90 hari.` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-4 text-base">Usia penonton</h3>
          {d.ageGroups.length ? (
            <BarList
              label="Persentase penonton per kelompok usia"
              items={d.ageGroups.map((a) => ({ key: a.key, label: `${a.label} th`, pct: a.pct, sub: `Laki-laki ${a.male}%, perempuan ${a.female}%, lainnya ${a.other}%` }))}
              labelWidth="sm:w-16"
              highlightTop
            />
          ) : <p className="text-sm text-sea-muted">Tidak tersedia.</p>}
          {d.coveragePct !== null && d.coveragePct < 99 ? (
            <p className="mt-3 text-xs text-sea-muted">Total {formatPct(d.coveragePct)} karena sampling atau ambang privasi YouTube.</p>
          ) : null}
        </Card>
        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <h3 className="mb-4 text-base">Gender</h3>
            {d.gender.length ? <BarList label="Persentase penonton per gender" items={d.gender.map((g) => ({ key: g.key, label: g.label, pct: g.pct }))} labelWidth="sm:w-24" /> : <p className="text-sm text-sea-muted">Tidak tersedia.</p>}
            <p className="mt-3 text-xs text-sea-muted">Kategori &quot;Lainnya&quot; ditampilkan terpisah, tidak dihapus.</p>
          </Card>
          <Card className="p-4 sm:p-5">
            <h3 className="mb-4 text-base">Perangkat</h3>
            {d.devices.length ? <BarList label="Persentase views per perangkat" items={d.devices.map((x) => ({ key: x.key, label: x.label, pct: x.pct }))} labelWidth="sm:w-24" /> : <p className="text-sm text-sea-muted">Tidak tersedia.</p>}
          </Card>
        </div>
      </div>

      <section aria-labelledby="negara-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 id="negara-h" className="text-base">10 negara teratas</h3>
          <div role="group" aria-label="Urutkan negara" className="inline-flex rounded-control border border-sea-line bg-sea-surface p-1">
            {([["views", "Views"], ["watch", "Watch time"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={cn("h-10 rounded-[8px] px-3 text-sm font-semibold", sort === k ? "bg-sea-primary text-sea-on-primary" : "hover:bg-sea-tint")}>{l}</button>
            ))}
          </div>
        </div>
        {countries.length ? (
          <Card as="div" className="relative overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm tabular" data-testid="country-table">
              <caption className="sr-only">Negara teratas berdasarkan {sort === "views" ? "views" : "watch time"}</caption>
              <thead>
                <tr className="border-b border-sea-line text-left">
                  <th scope="col" className="px-3 py-2.5 font-semibold">Negara</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Views</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">% views</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Watch time</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c) => (
                  <tr key={c.code} className="border-b border-sea-line last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium">{c.name}</th>
                    <td className="px-3 py-2 text-right">{formatInt(c.views)}</td>
                    <td className="px-3 py-2 text-right">{formatPct(c.viewsPct)}</td>
                    <td className="px-3 py-2 text-right">{formatHours(c.watchTimeHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : <p className="text-sm text-sea-muted">Data negara tidak tersedia.</p>}
        <p className="mt-2 text-xs text-sea-muted">Persen dihitung dari total views channel pada jendela yang sama.</p>
      </section>
    </div>
  );
}

function Waktu({ channelId }: { channelId: string }) {
  const q = useWatchHeatmap(channelId);
  if (q.isLoading) return <PanelSkeleton />;
  if (q.isError)
    return <Notice tone="error" title="Data waktu tonton gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => q.refetch()}>Coba lagi</Button>}>Data Anda aman.</Notice>;
  const d = q.data!.data;
  if (d.daysWithData === 0)
    return <Empty title="Belum ada data waktu tonton.">Data muncul setelah channel selesai sinkronisasi dan memiliki beberapa hari tayangan.</Empty>;
  const best = d.best.views;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[22px] font-bold leading-snug sm:text-[26px]" data-testid="best-day">
          {best ? `Hari terbaik: ${best.label}` : "Belum ada hari yang menonjol."}
        </p>
        <p className="mt-1 text-sm text-sea-muted">
          {best
            ? `Berdasarkan rata-rata views per hari dalam minggu, ${d.window.days} hari terakhir.`
            : "Beberapa hari memiliki nilai yang sama, jadi tidak ada yang disorot."}
        </p>
      </div>
      <Notice tone="info" title="Data per jam tidak tersedia dari YouTube.">
        {d.note} Jam tayang terbaik belum dapat dihitung. Hari mengikuti tanggal laporan YouTube; zona waktu akun Anda: {d.timezone}.
      </Notice>
      {d.shortWindow ? (
        <Notice tone="attention" title="Data kurang dari 14 hari.">Rata-rata belum stabil. Hasilnya makin akurat seiring data bertambah.</Notice>
      ) : null}
      <Card className="p-4 sm:p-6">
        <h3 className="mb-4 text-base">Aktivitas penonton per hari dalam minggu</h3>
        <HeatStrip data={d} />
        <p className="mt-4 text-xs text-sea-muted">
          Rata-rata dari {formatDateId(d.window.from)} sampai {formatDateId(d.window.to)}; 3 hari terakhir tidak diikutkan karena belum final.
          Warna lebih pekat berarti rata-rata lebih tinggi; angka tertulis di bawah tiap hari.
        </p>
      </Card>
    </div>
  );
}

function Traffic({ channelId }: { channelId: string }) {
  const { from, to } = useRange();
  const q = useTraffic(channelId, from, to);
  if (q.isLoading) return <PanelSkeleton />;
  if (q.isError)
    return <Notice tone="error" title="Sumber traffic gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => q.refetch()}>Coba lagi</Button>}>Data Anda aman.</Notice>;
  const d = q.data!.data;
  if (!d.hasData)
    return <Empty title="Belum ada data sumber traffic pada rentang ini.">Coba rentang yang lebih panjang, atau tunggu sinkronisasi statistik video berikutnya.</Empty>;
  const top = d.sources.find((s) => s.source === d.top);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[22px] font-bold leading-snug sm:text-[26px]" data-testid="traffic-summary">
          {top ? `${top.label} menyumbang ${formatPct(top.pct, 0)} views.` : "Sumber traffic terbagi merata."}
        </p>
        <p className="mt-1 text-sm text-sea-muted">
          Dari {formatInt(d.totalViews)} views pada {formatDateId(d.period.from)} sampai {formatDateId(d.period.to)}.
        </p>
      </div>
      <Card className="p-4 sm:p-5">
        <h3 className="mb-4 text-base">Porsi views per sumber</h3>
        <BarList label="Persentase views per sumber traffic" items={d.sources.map((s) => ({ key: s.source, label: s.label, pct: s.pct, sub: `${formatInt(s.views)} views` }))} labelWidth="sm:w-44" highlightTop stackOnMobile />
        <p className="mt-3 text-sm text-sea-muted" data-testid="traffic-sum">Total {formatPct(d.pctSum)}.</p>
      </Card>
      {d.dominantVideos.length ? (
        <Notice tone="info" title="Satu video mendominasi sumber traffic">
          {d.dominantVideos.map((v) => `${v.title} menyumbang ${formatPct(v.pct)} dari ${v.label.toLowerCase()}.`).join(" ")}
        </Notice>
      ) : null}
      <Card as="div" className="relative overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm tabular" data-testid="traffic-table">
          <caption className="sr-only">Views per sumber traffic dibanding periode sebelumnya</caption>
          <thead>
            <tr className="border-b border-sea-line text-left">
              <th scope="col" className="px-3 py-2.5 font-semibold">Sumber</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Views</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Porsi</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Vs periode lalu</th>
            </tr>
          </thead>
          <tbody>
            {d.sources.map((s) => (
              <tr key={s.source} className="border-b border-sea-line last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-medium">{s.label}</th>
                <td className="px-3 py-2 text-right">{formatInt(s.views)}</td>
                <td className="px-3 py-2 text-right">{formatPct(s.pct)}</td>
                <td className="px-3 py-2 text-right"><DeltaBadge pct={s.deltaPct} className="justify-end" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-sea-muted">
        Dihitung dari {d.videosCovered} video yang statistik hariannya disinkron
        {d.coveragePct !== null ? ` (sekitar ${formatPct(d.coveragePct, 0)} dari seluruh views channel)` : ""}. Sumber yang tidak dikenali digabung ke &quot;Lainnya&quot;.
        Daftar kata kunci pencarian belum tersedia.
      </p>
    </div>
  );
}

export function AudienceView() {
  const sp = useSearchParams();
  const tab = (TABS.find((t) => t.key === sp.get("tab"))?.key ?? "demografi") as Tab;
  const { active, isLoading } = useActiveChannel();
  if (isLoading)
    return (
      <div className="space-y-4">
        <LoadingNote label="Memuat data audiens..." />
        <Skeleton className="h-[400px]" />
      </div>
    );
  if (!active)
    return (
      <Card className="mx-auto max-w-task p-8 text-center">
        <h1 className="text-[24px]">Belum ada channel</h1>
        <p className="mt-2 text-sea-muted">Hubungkan channel untuk melihat siapa penonton Anda dan dari mana mereka datang.</p>
        <Button asChild className="mt-6"><Link href="/channels">Pilih channel</Link></Button>
      </Card>
    );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px]">Audiens</h1>
        <p className="mt-1 text-sea-muted">Siapa penonton {active.title} dan dari mana mereka menemukan video Anda.</p>
      </div>
      {active.syncStatus === "syncing" ? <Notice tone="info" title="Sinkronisasi berjalan.">Data audiens diperbarui otomatis setelah selesai.</Notice> : null}
      <nav aria-label="Bagian audiens" className="flex gap-1 overflow-x-auto border-b border-sea-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/audience?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "flex h-12 shrink-0 items-center px-2.5 text-sm font-semibold sm:px-4 sm:text-base",
              tab === t.key ? "border-b-2 border-sea-primary text-sea-primary" : "text-sea-muted hover:text-sea-text",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab !== "waktu" ? <RangePicker /> : null}
      {tab === "demografi" ? <Demografi channelId={active.id} /> : tab === "waktu" ? <Waktu channelId={active.id} /> : <Traffic channelId={active.id} />}
    </div>
  );
}
