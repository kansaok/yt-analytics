import { withApi, json } from "@/lib/api/handler";
import { deleteUserData } from "@/lib/channels/service";

export const dynamic = "force-dynamic";

/** Permintaan penghapusan akun/data untuk kepatuhan OAuth Google. */
export const DELETE = withApi(async ({ userId }) => {
  const result = await deleteUserData(userId);
  return json({ data: result });
}, { rateLimit: 10 });
