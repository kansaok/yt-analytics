import { withApi, json } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/** Membuat cookie double-submit CSRF untuk mutasi Route Handler. */
export const GET = withApi(async () => json({ data: { ready: true } }));
