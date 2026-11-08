"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { CaretDown, Check, Plus, Warning } from "@phosphor-icons/react";
import { useActiveChannel, useSelectChannel } from "@/lib/client/hooks";
import { ChannelAvatar } from "./channel-avatar";
import { cn } from "@/lib/cn";

const statusText: Record<string, string> = {
  synced: "Tersinkron",
  syncing: "Sinkronisasi berjalan",
  pending: "Menunggu sinkronisasi",
  error: "Sync bermasalah",
  revoked: "Perlu hubungkan ulang",
};

export function ChannelSwitcher() {
  const { channels, active, isLoading } = useActiveChannel();
  const select = useSelectChannel();
  if (isLoading) return <div className="h-11 w-48 rounded-control bg-sea-tint motion-safe:animate-pulse" aria-label="Memuat channel" />;
  if (!active)
    return (
      <Link href="/channels" className="inline-flex h-11 items-center gap-2 rounded-control px-3 font-semibold text-sea-primary hover:bg-sea-tint">
        <Plus size={18} aria-hidden="true" /> Hubungkan channel
      </Link>
    );
  return (
    <Menu.Root>
      <Menu.Trigger
        className="inline-flex h-11 max-w-[260px] items-center gap-2 rounded-control border border-sea-line bg-sea-surface px-2.5 hover:bg-sea-tint data-[state=open]:bg-sea-tint"
        aria-label={`Channel aktif: ${active.title}. Ganti channel`}
        data-testid="channel-switcher"
      >
        <ChannelAvatar title={active.title} src={active.thumbnailUrl} size={28} />
        <span className="truncate font-semibold">{active.title}</span>
        {active.syncStatus === "error" || active.syncStatus === "revoked" ? (
          <Warning size={16} className="shrink-0 text-sea-accent" aria-label={statusText[active.syncStatus]} />
        ) : null}
        <CaretDown size={16} className="shrink-0 text-sea-muted" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[300px] max-w-[calc(100vw-32px)] rounded-overlay border border-sea-line bg-sea-surface p-2 text-sea-text shadow-overlay"
        >
          <Menu.Label className="px-2 pb-1 pt-1 text-sm text-sea-muted">Channel Anda ({channels.length})</Menu.Label>
          {channels.map((c) => (
            <Menu.Item
              key={c.id}
              onSelect={() => !c.isActive && select.mutate(c.id)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-control px-2 py-1.5 outline-none data-[highlighted]:bg-sea-tint",
              )}
            >
              <ChannelAvatar title={c.title} src={c.thumbnailUrl} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.title}</span>
                <span className={cn("block text-xs", c.syncStatus === "error" || c.syncStatus === "revoked" ? "text-sea-accent" : "text-sea-muted")}>
                  {statusText[c.syncStatus]}
                </span>
              </span>
              {c.isActive ? <Check size={18} className="text-sea-primary" aria-label="aktif" /> : null}
            </Menu.Item>
          ))}
          <Menu.Separator className="my-1.5 h-px bg-sea-line" />
          <Menu.Item asChild>
            <Link href="/channels" className="flex min-h-12 items-center gap-3 rounded-control px-2 font-semibold text-sea-primary outline-none data-[highlighted]:bg-sea-tint">
              <Plus size={18} aria-hidden="true" /> Tambah atau kelola channel
            </Link>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
