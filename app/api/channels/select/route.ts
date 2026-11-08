import { withApi, json } from "@/lib/api/handler";
import { selectBodySchema } from "@/lib/api/schemas";
import { requireChannelOwnership } from "@/lib/auth/ownership";
import { selectChannel } from "@/lib/channels/service";

export const POST = withApi(async ({ req, userId }) => {
  const { channelId } = selectBodySchema.parse(await req.json().catch(() => ({})));
  await requireChannelOwnership(userId, channelId);
  return json({ data: await selectChannel(userId, channelId) });
});
