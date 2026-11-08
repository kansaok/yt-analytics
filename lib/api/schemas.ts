import { z } from "zod";
import { rangeQuerySchema } from "@/lib/analytics/period";
import { RANK_BY, VIDEO_SORTS } from "@/lib/analytics/service";

export const searchParamsObject = (sp: URLSearchParams) => Object.fromEntries(sp.entries());

export const videosQuerySchema = rangeQuerySchema.and(
  z.object({
    sort: z.enum(VIDEO_SORTS).default("views"),
    order: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().max(200).optional(),
    published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
);

export const rankingQuerySchema = rangeQuerySchema.and(
  z.object({
    sort: z.enum(RANK_BY).default("views"),
    order: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(50).default(5),
    hideSmall: z.enum(["0", "1", "true", "false"]).optional(),
  }),
);

export const connectBodySchema = z.object({
  grantId: z.string().uuid(),
  youtubeChannelId: z.string().regex(/^UC[\w-]{20,28}$/, "ID channel YouTube tidak valid"),
});
export const selectBodySchema = z.object({ channelId: z.string().uuid() });
