import { cn } from "@/lib/cn";

/** Teks + indikator kecil untuk keadaan memuat (DESIGN.md: loading = teks plus progres lembut). */
export function LoadingNote({ label, className }: { label: string; className?: string }) {
  return (
    <p role="status" className={cn("flex items-center gap-2 text-sm text-sea-muted", className)}>
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 rounded-full border-2 border-sea-line border-t-sea-primary motion-safe:animate-spin"
      />
      {label}
    </p>
  );
}
