import { withApi, json } from "@/lib/api/handler";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { disconnectChannel, serializeChannel } from "@/lib/channels/service";
import { prisma } from "@/lib/db/prisma";

type P = { id: string };
export const dynamic = "force-dynamic";

export const GET = withApi<P>(async ({ userId, params }) => {
  const ch = await requireChannelOwnership(userId, params.id);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { defaultChannelId: true } });
  return json({ data: await serializeChannel(ch, user.defaultChannelId) });
});

export const DELETE = withApi<P>(async ({ userId, params }) => {
  const ch = await requireChannelOwnership(userId, params.id);
  return json({ data: await disconnectChannel(userId, ch) });
});
