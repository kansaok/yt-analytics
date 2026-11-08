"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "@phosphor-icons/react";

/** Tooltip definisi metrik. Tombol fokusable agar bisa dibuka via keyboard. */
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sea-muted hover:text-sea-text hover:bg-sea-tint"
            onClick={(e) => e.stopPropagation()}
          >
            <Info size={16} aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-[280px] rounded-control border border-sea-line bg-sea-surface px-3 py-2 text-sm text-sea-text shadow-overlay"
          >
            {children}
            <Tooltip.Arrow className="fill-sea-surface" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
