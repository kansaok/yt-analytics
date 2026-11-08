import { withApi, json } from "@/lib/api/handler";
import { availableChannels } from "@/lib/channels/service";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ userId }) => json({ data: await availableChannels(userId) }));
