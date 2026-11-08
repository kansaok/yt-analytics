"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwise, GoogleLogo, LinkBreak, Plus } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client/api";
import { useChannels, useSelectChannel } from "@/lib/client/hooks";
import type { ChannelDto } from "@/lib/client/types";
import { formatCompact, formatDateTimeId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ChannelAvatar } from "@/components/shell/channel-avatar";

type Available = {
  data: {
    channels: { grantId: string; fixture: boolean; channel: { youtubeChannelId: string; title: string; handle: string | null; thumbnailUrl: string | null; subscriberCount: number } }[];
    errors: { grantId: string; code: string }[];
    grants: number;
  };
};

const ERR: Record<string, string> = {
  denied: "Akses YouTube diperlukan untuk menampilkan analitik. Coba lagi.",
  scope: "Izin baca YouTube atau YouTube Analytics tidak dicentang. Hubungkan ulang dan centang keduanya.",
  state: "Sesi penghubungan kedaluwarsa atau tidak valid. Mulai lagi dari tombol di bawah.",
  refresh: "Google tidak memberikan izin akses berkala. Cabut akses aplikasi di akun Google, lalu hubungkan ulang.",
  exchange: "Gagal menukar kode otorisasi Google. Coba lagi.",
};

function statusLine(c: ChannelDto) {
  if (c.syncStatus === "syncing") {
    const p = c.progress;
    if (p?.total) return `${p.step} ${p.done}/${p.total}...`;
    return p?.step ?? "Sinkronisasi berjalan...";
  }
  if (c.syncStatus === "revoked") return "Koneksi terputus. Hubungkan ulang.";
  if (c.syncError) return c.syncError;
  if (c.syncStatus === "pending") return "Menunggu sinkronisasi pertama.";
  return `Terakhir disinkron: ${formatDateTimeId(c.lastSyncedAt)} WIB`;
}

export function ChannelsView({ googleReady, error, added }: { googleReady: boolean; error?: string; added: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useChannels();
  const available = useQuery({ queryKey: ["available"], queryFn: () => api<Available>("/api/channels/available") });
  const select = useSelectChannel();
  const [toRemove, setToRemove] = useState<ChannelDto | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success" | "attention"; text: string } | null>(null);

  const connect = useMutation({
    mutationFn: (v: { grantId: string; youtubeChannelId: string }) =>
      api("/api/channels/connect", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["channels"] });
      await qc.invalidateQueries({ queryKey: ["available"] });
      router.push("/dashboard");
    },
    onError: (e: ApiClientError) => setMsg({ tone: "error", text: e.message }),
  });
  const sync = useMutation({
    mutationFn: (id: string) => api(`/api/channels/${id}/sync`, { method: "POST" }),
    onSuccess: () => {
      setMsg({ tone: "success", text: "Sinkronisasi dijadwalkan. Status diperbarui otomatis." });
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (e: ApiClientError) => setMsg({ tone: "attention", text: e.message }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/channels/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setToRemove(null);
      setMsg({ tone: "success", text: "Channel diputus. Statistik dan tokennya sudah dihapus." });
      await qc.invalidateQueries({ queryKey: ["channels"] });
      await qc.invalidateQueries({ queryKey: ["available"] });
    },
    onError: (e: ApiClientError) => setMsg({ tone: "error", text: e.message }),
  });

  const channels = data?.data ?? [];
  const limit = data?.meta.limit ?? 5;
  const full = channels.length >= limit;
  const avail = available.data?.data;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-[26px]">Channel</h1>
        <p className="mt-1 text-sea-muted">
          Hubungkan hingga {limit} channel. Data tiap channel terpisah; dashboard menampilkan channel yang aktif.
        </p>
      </div>

      <div className="space-y-3" aria-live="polite">
        {error ? <Notice tone="error" title="Channel belum terhubung.">{ERR[error] ?? ERR.exchange}</Notice> : null}
        {added && !error ? <Notice tone="success" title="Akun Google ditambahkan.">Pilih channel dari daftar di bawah.</Notice> : null}
        {msg ? <Notice tone={msg.tone} title={msg.text} /> : null}
      </div>

      <section aria-labelledby="terhubung">
        <h2 id="terhubung" className="text-lg">
          Channel terhubung <span className="tabular font-normal text-sea-muted">({channels.length}/{limit})</span>
        </h2>
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <LoadingNote label="Memuat daftar channel..." />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : isError ? (
            <Notice tone="error" title="Daftar channel gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Coba lagi</Button>}>
              Data Anda aman. Periksa koneksi lalu coba lagi.
            </Notice>
          ) : channels.length === 0 ? (
            <p className="rounded-card border border-dashed border-sea-line px-5 py-6 text-sea-muted">
              Belum ada channel terhubung. Pilih channel dari daftar di bawah untuk mulai melihat analitik.
            </p>
          ) : (
            <Card as="div">
              <ul className="divide-y divide-sea-line">
                {channels.map((c) => (
                  <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" data-testid="connected-channel">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ChannelAvatar title={c.title} src={c.thumbnailUrl} size={44} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          <span className="truncate">{c.title}</span>
                          {c.isActive ? <Badge>Aktif</Badge> : null}
                        </p>
                        <p className={c.syncStatus === "revoked" || c.syncError ? "text-sm text-sea-accent" : "text-sm text-sea-muted"}>
                          {statusLine(c)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {c.needsReauth ? (
                        googleReady ? (
                          <Button asChild size="sm">
                            <a href="/api/youtube/connect">Hubungkan ulang</a>
                          </Button>
                        ) : null
                      ) : !c.isActive ? (
                        <Button size="sm" variant="secondary" onClick={() => select.mutate(c.id)} disabled={select.isPending}>
                          Jadikan aktif
                        </Button>
                      ) : null}
                      {!c.needsReauth ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => sync.mutate(c.id)}
                          disabled={c.syncStatus === "syncing" || sync.isPending}
                          aria-label={`Sinkron sekarang: ${c.title}`}
                        >
                          <ArrowsClockwise size={18} aria-hidden="true" /> Sinkron
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setToRemove(c)} aria-label={`Putuskan ${c.title}`} className="text-sea-danger">
                        <LinkBreak size={18} aria-hidden="true" /> Putuskan
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </section>

      <section aria-labelledby="tambah">
        <h2 id="tambah" className="text-lg">Tambahkan channel</h2>
        <p className="mt-1 text-sea-muted">Channel yang bisa dikelola oleh akun Google yang sudah Anda izinkan.</p>
        <div className="mt-4 space-y-4">
          {full ? (
            <Notice tone="attention" title={`Batas ${limit} channel tercapai.`}>
              Putuskan salah satu channel di atas untuk menambah channel baru.
            </Notice>
          ) : null}
          {available.isLoading ? (
            <div className="space-y-3">
              <LoadingNote label="Mengambil channel dari akun Google..." />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : available.isError ? (
            <Notice tone="error" title="Daftar channel dari YouTube gagal dimuat." action={<Button size="sm" variant="secondary" onClick={() => available.refetch()}>Coba lagi</Button>}>
              YouTube mungkin sedang tidak merespons.
            </Notice>
          ) : avail && avail.channels.length > 0 ? (
            <Card as="div">
              <ul className="divide-y divide-sea-line">
                {avail.channels.map(({ grantId, channel: ch, fixture }) => (
                  <li key={`${grantId}-${ch.youtubeChannelId}`} className="flex items-center gap-3 p-4" data-testid="available-channel">
                    <ChannelAvatar title={ch.title} src={ch.thumbnailUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        <span className="truncate">{ch.title}</span>
                        {fixture ? <Badge tone="accent">Data uji</Badge> : null}
                      </p>
                      <p className="text-sm text-sea-muted">
                        {ch.handle ?? ch.youtubeChannelId} · <span className="tabular">{formatCompact(ch.subscriberCount)}</span> subscriber
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={full || connect.isPending}
                      onClick={() => connect.mutate({ grantId, youtubeChannelId: ch.youtubeChannelId })}
                      aria-label={`Hubungkan ${ch.title}`}
                    >
                      {connect.isPending && connect.variables?.youtubeChannelId === ch.youtubeChannelId ? "Menghubungkan..." : "Hubungkan"}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : avail && avail.grants > 0 && avail.errors.length === 0 ? (
            <p className="rounded-card border border-dashed border-sea-line px-5 py-6 text-sea-muted">
              {channels.length
                ? "Semua channel dari akun Google Anda sudah terhubung."
                : "Tidak ada channel ditemukan pada akun ini. Pastikan login dengan akun pemilik channel, atau buat channel di YouTube terlebih dahulu."}
            </p>
          ) : null}
          {avail?.errors.some((e) => e.code === "REVOKED") ? (
            <Notice tone="attention" title="Satu akses Google sudah dicabut.">Hubungkan ulang untuk melihat channel di akun tersebut.</Notice>
          ) : null}

          <div className="pt-2">
            {googleReady ? (
              <Button asChild variant="secondary">
                <a href="/api/youtube/connect">
                  <GoogleLogo size={20} aria-hidden="true" />
                  {avail?.grants ? "Hubungkan akun Google lain" : "Hubungkan YouTube"}
                </a>
              </Button>
            ) : (
              <p className="flex items-center gap-2 text-sm text-sea-muted">
                <Plus size={16} aria-hidden="true" /> Menambah akun Google lain butuh GOOGLE_CLIENT_ID di server.
              </p>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={!!toRemove}
        title={`Putuskan ${toRemove?.title ?? "channel"}?`}
        confirmLabel="Putuskan dan hapus data"
        busy={remove.isPending}
        onClose={() => setToRemove(null)}
        onConfirm={() => toRemove && remove.mutate(toRemove.id)}
      >
        Statistik harian, daftar video, dan antrean sinkronisasi channel ini akan dihapus permanen. Anda bisa menghubungkannya lagi nanti, dengan sinkronisasi 90 hari dari awal.
      </ConfirmDialog>
    </div>
  );
}
