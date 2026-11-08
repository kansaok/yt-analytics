import type { Metadata } from "next";
import { Suspense } from "react";
import { VideosView } from "@/components/videos/videos-view";

export const metadata: Metadata = { title: "Video" };
export default function VideosPage() {
  return (
    <Suspense>
      <VideosView />
    </Suspense>
  );
}
