export type YtChannel = {
  youtubeChannelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number;
  uploadsPlaylistId: string | null;
};

export type YtVideo = {
  youtubeVideoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  privacyStatus: string;
  tags: string[];
};

export type ChannelDayRow = {
  date: string;
  views: number;
  subsGained: number;
  subsLost: number;
  watchTimeMinutes: number;
};

export type VideoDayRow = {
  date: string;
  views: number;
  likes: number;
  comments: number;
  watchTimeMinutes: number;
  avgViewDurationSeconds: number;
  retentionAvgPct: number | null;
};

export type ReachRow = { impressions: number; ctr: number };
export type TrafficBucket = "search" | "suggested" | "browse" | "external" | "other";
export type RetentionPoint = { ratio: number; watchRatio: number };

export type AudienceData = {
  /** viewerPercentage per (ageGroup, gender); jumlah seluruh baris = 100 bila tidak ada ambang privasi. */
  ageGender: { ageGroup: string; gender: string; pct: number }[];
  countries: { country: string; views: number; watchMinutes: number }[];
  devices: { device: string; views: number; watchMinutes: number }[];
};

export interface YouTubeGateway {
  listMyChannels(): Promise<YtChannel[]>;
  getChannel(youtubeChannelId: string): Promise<YtChannel | null>;
  listUploadIds(uploadsPlaylistId: string): Promise<string[]>;
  getVideos(ids: string[]): Promise<YtVideo[]>;
  channelDaily(youtubeChannelId: string, from: string, to: string): Promise<ChannelDayRow[]>;
  videoDaily(youtubeChannelId: string, youtubeVideoId: string, from: string, to: string): Promise<VideoDayRow[]>;
  /** null = metrik impresi/CTR tidak tersedia dari API untuk channel ini. */
  videoReachDaily(
    youtubeChannelId: string,
    youtubeVideoId: string,
    from: string,
    to: string,
  ): Promise<Map<string, ReachRow> | null>;
  videoTrafficDaily(
    youtubeChannelId: string,
    youtubeVideoId: string,
    from: string,
    to: string,
  ): Promise<Map<string, Partial<Record<TrafficBucket, number>>>>;
  videoRetention(youtubeChannelId: string, youtubeVideoId: string): Promise<RetentionPoint[]>;
  /** Agregat audiens untuk satu jendela tanggal. Dimensi yang ditolak/disembunyikan (privasi) menghasilkan array kosong. */
  audience(youtubeChannelId: string, from: string, to: string): Promise<AudienceData>;
}
