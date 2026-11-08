import { cn } from "@/lib/cn";

// Badge hanya untuk status nyata (Shorts, Privat, Estimasi, Belum final). Radius tag 6px, bukan pill.
const tones = {
  neutral: "bg-sea-tint text-sea-text",
  accent: "border border-sea-accent text-sea-accent",
  success: "border border-sea-success text-sea-success",
  danger: "border border-sea-danger text-sea-danger",
  muted: "border border-sea-line text-sea-muted",
};
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-tag px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}
      {...p}
    />
  );
}
