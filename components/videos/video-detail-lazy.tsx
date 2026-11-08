"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";

// Recharts dimuat terpisah agar JS awal route < 250 kB (prd/05 Performa).
export const VideoDetailLazy = dynamic(() => import("./video-detail").then((m) => m.VideoDetailView), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <LoadingNote label="Memuat detail video..." />
      <Skeleton className="h-24" />
      <Skeleton className="h-[260px]" />
    </div>
  ),
});
