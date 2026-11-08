import type { TrafficBucket, YtChannel, YtVideo } from "./types";

/** ISO-8601 durasi (PT1H2M3S) ke detik. */
export function parseIsoDuration(iso: string | null | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, mi, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

/** Taksonomi insightTrafficSourceType YouTube => 5 kelompok PRD. */
export function trafficBucket(type: string): TrafficBucket {
  switch (type) {
    case "YT_SEARCH":
      return "search";
    case "RELATED_VIDEO":
    case "END_SCREEN":
    case "ANNOTATION":
      return "suggested";
    case "SUBSCRIBER":
    case "YT_CHANNEL":
    case "NOTIFICATION":
    case "YT_OTHER_PAGE":
    case "SHORTS":
    case "YT_PLAYLIST_PAGE":
    case "PLAYLIST":
    case "HASHTAGS":
    case "SOUND_PAGE":
    case "VIDEO_REMIXES":
    case "PRODUCT_PAGE":
      return "browse";
    case "EXT_URL":
    case "NO_LINK_EMBEDDED":
    case "NO_LINK_OTHER":
      return "external";
    default:
      return "other";
  }
}

export function mapChannel(item: any): YtChannel {
  const thumbs = item?.snippet?.thumbnails ?? {};
  return {
    youtubeChannelId: item.id,
    title: item?.snippet?.title ?? "(tanpa nama)",
    handle: item?.snippet?.customUrl ?? null,
    thumbnailUrl: thumbs.medium?.url ?? thumbs.default?.url ?? null,
    subscriberCount: Number(item?.statistics?.subscriberCount ?? 0),
    uploadsPlaylistId: item?.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

export function mapVideo(item: any): YtVideo {
  const thumbs = item?.snippet?.thumbnails ?? {};
  return {
    youtubeVideoId: item.id,
    title: item?.snippet?.title ?? "(tanpa judul)",
    publishedAt: item?.snippet?.publishedAt ?? new Date(0).toISOString(),
    durationSeconds: parseIsoDuration(item?.contentDetails?.duration),
    thumbnailUrl: thumbs.medium?.url ?? thumbs.default?.url ?? null,
    privacyStatus: item?.status?.privacyStatus ?? "public",
    tags: item?.snippet?.tags ?? [],
  };
}

/** Ubah respons reports.query (columnHeaders + rows) menjadi array objek per nama kolom. */
export function rowsToObjects(res: {
  columnHeaders?: { name?: string | null }[] | null;
  rows?: unknown[][] | null;
}): Record<string, string | number>[] {
  const names = (res.columnHeaders ?? []).map((h) => h.name ?? "");
  return (res.rows ?? []).map((r) => Object.fromEntries(names.map((n, i) => [n, r[i] as string | number])));
}
