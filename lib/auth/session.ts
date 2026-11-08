import { auth } from "./index";
import { prisma } from "@/lib/db/prisma";

/** userId dari sesi; null bila tidak login atau user sudah dihapus. */
export async function getSessionUserId(): Promise<string | null> {
  const s = await auth();
  const id = (s?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return exists ? id : null;
}
