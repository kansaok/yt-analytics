import { cn } from "@/lib/cn";
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-control bg-sea-tint motion-safe:animate-pulse", className)} />;
}
