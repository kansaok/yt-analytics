import { withApi, json } from "@/lib/api/handler";
import { listChannels } from "@/lib/channels/service";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ userId }) => json(await listChannels(userId)));
