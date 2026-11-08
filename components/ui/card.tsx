import { cn } from "@/lib/cn";

/** Kartu Laut: radius 14px, border 1px, tanpa bayangan. */
export function Card({ className, as: As = "section", ...p }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return <As className={cn("rounded-card border border-sea-line bg-sea-surface", className)} {...p} />;
}
