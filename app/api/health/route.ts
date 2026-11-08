import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** Endpoint publik minimal untuk monitor uptime; tidak memaparkan konfigurasi atau data pengguna. */
export async function GET() {
  const [database, cache] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis().ping(),
  ]);
  const healthy = database.status === "fulfilled" && cache.status === "fulfilled";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded" },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
