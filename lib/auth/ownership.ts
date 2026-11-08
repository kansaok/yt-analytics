import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/errors";

const uuid = z.string().uuid();

/**
 * Isolasi data (prd/05 Keamanan): channel harus milik user.
 * Milik user lain => 403 FORBIDDEN, tidak ada => 404. Dipanggil di setiap handler ber-channel.
 */
export async function requireChannelOwnership(userId: string, channelId: string) {
  if (!uuid.safeParse(channelId).success)
    throw new ApiError("CHANNEL_NOT_FOUND", "Channel tidak ditemukan.", { channelId });
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!ch) throw new ApiError("CHANNEL_NOT_FOUND", "Channel tidak ditemukan.", { channelId });
  if (ch.userId !== userId) throw new ApiError("FORBIDDEN", "Channel ini bukan milik akun Anda.");
  return ch;
}

export async function requireVideoOwnership(userId: string, videoId: string) {
  if (!uuid.safeParse(videoId).success) throw new ApiError("VIDEO_NOT_FOUND", "Video tidak ditemukan.", { videoId });
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: { channel: true } });
  if (!v) throw new ApiError("VIDEO_NOT_FOUND", "Video tidak ditemukan.", { videoId });
  if (v.channel.userId !== userId) throw new ApiError("FORBIDDEN", "Video ini bukan milik channel Anda.");
  return v;
}
