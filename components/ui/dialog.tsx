"use client";
import { useEffect, useRef } from "react";

/** Dialog konfirmasi native <dialog>: fokus terkunci, Escape menutup (R-32). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dlg-title"
      className="w-[calc(100%-32px)] max-w-md rounded-overlay border border-sea-line bg-sea-surface p-0 text-sea-text shadow-overlay backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 id="dlg-title" className="text-lg">
          {title}
        </h2>
        <div className="mt-2 text-sea-muted">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-control px-5 font-semibold hover:bg-sea-tint"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-12 rounded-control border-[1.5px] border-sea-danger px-5 font-semibold text-sea-danger hover:bg-sea-danger/10 disabled:opacity-50"
          >
            {busy ? "Memproses..." : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
