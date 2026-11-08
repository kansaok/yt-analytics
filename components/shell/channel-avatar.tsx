/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";

/** Avatar channel asli dari YouTube; tanpa gambar => inisial (placeholder jujur, R-23). */
export function ChannelAvatar({ title, src, size = 32 }: { title: string; src: string | null; size?: number }) {
  if (src)
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full border border-sea-line" style={{ width: size, height: size }} />;
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-sea-tint font-semibold text-sea-primary")}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
