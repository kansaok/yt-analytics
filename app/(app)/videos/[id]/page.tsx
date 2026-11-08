import type { Metadata } from "next";
import { VideoDetailLazy } from "@/components/videos/video-detail-lazy";

export const metadata: Metadata = { title: "Detail video" };
export default function VideoDetailPage({ params }: { params: { id: string } }) {
  return <VideoDetailLazy id={params.id} />;
}
