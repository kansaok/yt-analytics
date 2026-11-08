import type { Channel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { ApiError } from "@/lib/api/errors";
import { grantChannelsKey } from "@/lib/cache/keys";
import { invalidateChannel } from "@/lib/cache/dashboard-cache";
import { FIXTURE_SUBJECT_PREFIX, gatewayForToken } from "@/lib/auth/google-tokens";
import { decryptTokenPair } from "@/lib/crypto/tokens";
import { enqueueInitialSync, removeChannelJobs } from "@/lib/queue/queues";
import { getProgress } from "@/lib/sync/progress";
import { AuthRevokedError, QuotaExceededError } from "@/lib/youtube/quota";
import type { YtChannel } from "@/lib/youtube/types";

export type SyncStatus = "pending" | "syncing" | "synced" | "error" | "revoked";

export function syncStatusOf(c: Pick<Channel, "status" | "lastSyncAt">): SyncStatus {
  if (c.status === "REVOKED") return "revoked";
  if (c.status === "SYNCING") return "syncing";
  if (c.status === "ERROR") return "error";
  return c.lastSyncAt ? "synced" : "pending";
}

export async function serializeChannel(c: Channel, activeId: string | null) {
  return {
    id: c.id,
    youtubeChannelId: c.youtubeChannelId,
    title: c.title,
    handle: c.handle,
    thumbnailUrl: c.thumbnailUrl,
    subscriberCount: c.subscriberCache,
    isActive: c.id === activeId,
    syncStatus: syncStatusOf(c),
    syncError: c.syncError,
    needsReauth: c.status === "REVOKED",
    lastSyncedAt: c.lastSyncAt?.toISOString() ?? null,
    historySince: c.historySince?.toISOString().slice(0, 10) ?? null,
    progress: c.status === "SYNCING" ? await getProgress(c.id) : null,
  };
}

export async function listChannels(userId: string) {
  const [user, channels] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { defaultChannelId: true } }),
    prisma.channel.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    data: await Promise.all(channels.map((c) => serializeChannel(c, user.defaultChannelId))),
    meta: { limit: env().MAX_CHANNELS_PER_USER, activeChannelId: user.defaultChannelId },
  };
}

async function grantChannels(tokenId: string): Promise<YtChannel[]> {
  const token = await prisma.oAuthToken.findUniqueOrThrow({ where: { id: tokenId } });
  try {
    const hit = await redis().get(grantChannelsKey(tokenId));
    if (hit) return JSON.parse(hit);
  } catch {
    /* lanjut tanpa cache */
  }
  const gw = await gatewayForToken(token);
  const list = await gw.listMyChannels();
  try {
    await redis().set(grantChannelsKey(tokenId), JSON.stringify(list), "EX", 600);
  } catch {
    /* noop */
  }
  return list;
}

/** Channel dari semua grant Google user yang belum terhubung (untuk halaman Pilih Channel). */
export async function availableChannels(userId: string) {
  const tokens = await prisma.oAuthToken.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const connected = await prisma.channel.findMany({ where: { userId }, select: { youtubeChannelId: true, status: true } });
  const connectedIds = new Set(connected.filter((c) => c.status !== "REVOKED").map((c) => c.youtubeChannelId));
  const out: { grantId: string; channel: YtChannel; fixture: boolean }[] = [];
  const errors: { grantId: string; code: string }[] = [];
  for (const t of tokens) {
    try {
      for (const ch of await grantChannels(t.id))
        if (!connectedIds.has(ch.youtubeChannelId))
          out.push({ grantId: t.id, channel: ch, fixture: t.googleSubject.startsWith(FIXTURE_SUBJECT_PREFIX) });
    } catch (e) {
      errors.push({
        grantId: t.id,
        code: e instanceof AuthRevokedError ? "REVOKED" : e instanceof QuotaExceededError ? "QUOTA" : "UPSTREAM",
      });
    }
  }
  return { channels: out, errors, grants: tokens.length };
}

export async function connectChannel(userId: string, grantId: string, youtubeChannelId: string) {
  const token = await prisma.oAuthToken.findFirst({ where: { id: grantId, userId } });
  if (!token) throw new ApiError("FORBIDDEN", "Akses Google ini bukan milik akun Anda.");
  // Jangan percaya client: pastikan channel benar-benar ada di grant ini.
  const list = await grantChannels(grantId).catch((e) => {
    if (e instanceof AuthRevokedError)
      throw new ApiError("OAUTH_SCOPE_MISSING", "Akses YouTube terputus. Hubungkan ulang akun Google.");
    throw new ApiError("YOUTUBE_UPSTREAM_ERROR", "YouTube tidak merespons. Coba lagi.");
  });
  const yt = list.find((c) => c.youtubeChannelId === youtubeChannelId);
  if (!yt) throw new ApiError("FORBIDDEN", "Channel ini tidak dapat dikelola oleh akun Google tersebut.");

  const existing = await prisma.channel.findUnique({
    where: { userId_youtubeChannelId: { userId, youtubeChannelId } },
  });
  if (!existing) {
    const count = await prisma.channel.count({ where: { userId } });
    if (count >= env().MAX_CHANNELS_PER_USER)
      throw new ApiError(
        "CHANNEL_LIMIT_REACHED",
        `Batas ${env().MAX_CHANNELS_PER_USER} channel per akun sudah tercapai. Putuskan satu channel untuk menambah yang baru.`,
      );
  }
  const channel = existing
    ? await prisma.channel.update({
        where: { id: existing.id },
        data: { oauthTokenId: token.id, status: "SYNCING", syncError: null, revokedAt: null },
      })
    : await prisma.channel.create({
        data: {
          userId,
          oauthTokenId: token.id,
          youtubeChannelId,
          title: yt.title,
          handle: yt.handle,
          thumbnailUrl: yt.thumbnailUrl,
          subscriberCache: yt.subscriberCount,
          status: "SYNCING",
        },
      });
  await prisma.user.update({ where: { id: userId }, data: { defaultChannelId: channel.id } });
  await enqueueInitialSync(channel.id).catch(async (e) => {
    await prisma.channel.update({
      where: { id: channel.id },
      data: { status: "ERROR", syncError: "Antrean sinkronisasi tidak tersedia. Tekan Sinkron Sekarang." },
    });
    throw e;
  });
  return channel;
}

export async function selectChannel(userId: string, channelId: string) {
  await prisma.user.update({ where: { id: userId }, data: { defaultChannelId: channelId } });
  return { activeChannelId: channelId };
}

async function revokeAtGoogle(refreshToken: string) {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* token tetap dihapus lokal */
  }
}

/**
 * Putus channel: hapus channel + seluruh agregat/video (cascade), antrean sync, cache.
 * Token grant dihapus & di-revoke di Google bila tidak ada channel lain yang memakainya.
 */
export async function disconnectChannel(userId: string, channel: Channel) {
  await removeChannelJobs(channel.id).catch(() => undefined);
  await prisma.channel.delete({ where: { id: channel.id } });
  if (channel.oauthTokenId) {
    const remaining = await prisma.channel.count({ where: { oauthTokenId: channel.oauthTokenId } });
    if (remaining === 0) {
      const token = await prisma.oAuthToken.findUnique({ where: { id: channel.oauthTokenId } });
      // Grant data uji (mode pengembangan) dipertahankan agar channel uji bisa dihubungkan lagi.
      if (token && !token.googleSubject.startsWith(FIXTURE_SUBJECT_PREFIX)) {
        await revokeAtGoogle(decryptTokenPair(token).refreshToken);
        await prisma.oAuthToken.delete({ where: { id: token.id } });
      }
    }
  }
  await invalidateChannel(channel.id).catch(() => undefined);
  // Channel aktif dihapus => pindah ke channel lain atau kosong.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let activeChannelId = user.defaultChannelId;
  if (!activeChannelId || activeChannelId === channel.id) {
    const next = await prisma.channel.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    activeChannelId = next?.id ?? null;
    await prisma.user.update({ where: { id: userId }, data: { defaultChannelId: activeChannelId } });
  }
  return { deletedChannelId: channel.id, activeChannelId };
}

/** Hapus statistik dan metadata channel tujuh hari setelah akses Google dicabut (prd/05). */
export async function purgeExpiredRevokedChannels(now = new Date()) {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const channels = await prisma.channel.findMany({
    where: { status: "REVOKED", revokedAt: { lte: cutoff } },
    select: { id: true },
  });
  for (const channel of channels) {
    await removeChannelJobs(channel.id).catch(() => undefined);
    await prisma.channel.delete({ where: { id: channel.id } });
    await invalidateChannel(channel.id).catch(() => undefined);
  }
  return { deletedChannels: channels.length };
}

/** Hapus seluruh data akun dan cabut grant Google yang tersisa. */
export async function deleteUserData(userId: string) {
  const [channels, tokens] = await Promise.all([
    prisma.channel.findMany({ where: { userId }, select: { id: true } }),
    prisma.oAuthToken.findMany({ where: { userId } }),
  ]);
  await Promise.all(channels.map((channel) => removeChannelJobs(channel.id).catch(() => undefined)));
  await Promise.all(
    tokens
      .filter((token) => !token.googleSubject.startsWith(FIXTURE_SUBJECT_PREFIX))
      .map((token) => revokeAtGoogle(decryptTokenPair(token).refreshToken)),
  );
  await prisma.user.delete({ where: { id: userId } });
  await Promise.all(channels.map((channel) => invalidateChannel(channel.id).catch(() => undefined)));
  return { deletedUserId: userId, deletedChannels: channels.length };
}
