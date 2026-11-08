import type { Metadata } from "next";
import { env } from "@/lib/env";
import { ChannelsView } from "@/components/channels/channels-view";

export const metadata: Metadata = { title: "Channel" };

export default function ChannelsPage({ searchParams }: { searchParams: { error?: string; added?: string } }) {
  return <ChannelsView googleReady={!!env().GOOGLE_CLIENT_ID} error={searchParams.error} added={!!searchParams.added} />;
}
