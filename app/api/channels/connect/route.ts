import { withApi, json } from "@/lib/api/handler";
import { connectBodySchema } from "@/lib/api/schemas";
import { connectChannel, serializeChannel } from "@/lib/channels/service";

export const POST = withApi(
  async ({ req, userId }) => {
    const body = connectBodySchema.parse(await req.json().catch(() => ({})));
    const ch = await connectChannel(userId, body.grantId, body.youtubeChannelId);
    return json({ data: await serializeChannel(ch, ch.id) }, { status: 201 });
  },
  { rateLimit: 10 },
);
