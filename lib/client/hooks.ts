"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { ChannelDto, DemographicsDto, HeatmapDto, MetricsDto, TimeseriesDto, TrafficDto, VideoRowDto } from "./types";

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: () => api<{ data: ChannelDto[]; meta: { limit: number; activeChannelId: string | null } }>("/api/channels"),
    // Selama ada channel yang sinkron, polling progres tiap 3 detik.
    refetchInterval: (q) => (q.state.data?.data.some((c) => c.syncStatus === "syncing") ? 3000 : false),
  });
}

export function useActiveChannel() {
  const q = useChannels();
  const list = q.data?.data ?? [];
  const active = list.find((c) => c.isActive) ?? list[0] ?? null;
  return { ...q, channels: list, active };
}

export function useSelectChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) =>
      api("/api/channels/select", { method: "POST", body: JSON.stringify({ channelId }) }),
    onMutate: async (channelId) => {
      // Optimistis: switcher & data langsung berganti (data channel lain dari cache bila ada).
      await qc.cancelQueries({ queryKey: ["channels"] });
      qc.setQueryData<{ data: ChannelDto[]; meta: { limit: number; activeChannelId: string | null } }>(["channels"], (old) =>
        old ? { ...old, data: old.data.map((c) => ({ ...c, isActive: c.id === channelId })), meta: { ...old.meta, activeChannelId: channelId } } : old,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

const enabled = (id?: string | null) => !!id;

export function useMetrics(channelId: string | undefined, from: string, to: string, poll?: boolean) {
  return useQuery({
    queryKey: ["metrics", channelId, from, to],
    queryFn: () => api<{ data: MetricsDto }>(`/api/channels/${channelId}/metrics?from=${from}&to=${to}`),
    enabled: enabled(channelId),
    placeholderData: keepPreviousData,
    refetchInterval: poll ? 10_000 : false,
  });
}

export function useTimeseries(channelId: string | undefined, from: string, to: string, poll?: boolean) {
  return useQuery({
    queryKey: ["timeseries", channelId, from, to],
    queryFn: () => api<{ data: TimeseriesDto }>(`/api/channels/${channelId}/timeseries?from=${from}&to=${to}`),
    enabled: enabled(channelId),
    placeholderData: keepPreviousData,
    refetchInterval: poll ? 10_000 : false,
  });
}

export type VideoQuery = { sort: string; order: "asc" | "desc"; search: string; page: number; published?: string };

export function useVideos(channelId: string | undefined, from: string, to: string, q: VideoQuery) {
  const sp = new URLSearchParams({ from, to, sort: q.sort, order: q.order, page: String(q.page), limit: "50" });
  if (q.search) sp.set("search", q.search);
  if (q.published) sp.set("published", q.published);
  return useQuery({
    queryKey: ["videos", channelId, sp.toString()],
    queryFn: () =>
      api<{ data: VideoRowDto[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        `/api/channels/${channelId}/videos?${sp}`,
      ),
    enabled: enabled(channelId),
    placeholderData: keepPreviousData,
  });
}

export function useRanking(
  channelId: string | undefined,
  from: string,
  to: string,
  sort: string,
  order: "asc" | "desc",
  hideSmall: boolean,
  limit = 5,
) {
  const sp = new URLSearchParams({ from, to, sort, order, limit: String(limit), hideSmall: hideSmall ? "1" : "0" });
  return useQuery({
    queryKey: ["ranking", channelId, sp.toString()],
    queryFn: () =>
      api<{ data: { eligible: number; hideSmall: boolean; items: (VideoRowDto & { rank: number })[] } }>(
        `/api/channels/${channelId}/videos/ranking?${sp}`,
      ),
    enabled: enabled(channelId),
    placeholderData: keepPreviousData,
  });
}

export function useSyncNow(channelId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/channels/${channelId}/sync`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });
}

export function useDemographics(channelId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["demographics", channelId, from, to],
    queryFn: () => api<{ data: DemographicsDto }>(`/api/channels/${channelId}/audience-demographics?from=${from}&to=${to}`),
    enabled: enabled(channelId),
    placeholderData: keepPreviousData,
  });
}

export function useWatchHeatmap(channelId: string | undefined) {
  return useQuery({
    queryKey: ["watch-heatmap", channelId],
    queryFn: () => api<{ data: HeatmapDto }>(`/api/channels/${channelId}/watch-heatmap`),
    enabled: enabled(channelId),
  });
}

export function useTraffic(channelId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["traffic", channelId, from, to],
    queryFn: () => api<{ data: TrafficDto }>(`/api/channels/${channelId}/traffic-sources?from=${from}&to=${to}`),
    enabled: enabled(channelId),
    placeholderData: keepPreviousData,
  });
}
