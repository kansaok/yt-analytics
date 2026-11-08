import type { Metric } from "@/lib/client/store";

export const METRIC_LABEL: Record<Metric, string> = {
  views: "Views",
  subscribersNet: "Subscriber baru (net)",
  watchTimeHours: "Watch time (jam)",
};
