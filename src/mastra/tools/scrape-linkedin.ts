// @ts-nocheck
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const ACTOR = "local/linkedin";
export function normalizeLinkedin(item: Record<string, unknown>): Video {
  const id = String(item.id || item.videoId || "");
  const caption = (item.caption as string) || (item.title as string) || "";
  return {
    platform: "linkedin",
    id, caption, author: (item.author as string) || "unknown", language: "", followers: 0, verified: false, isAd: false,
    url: (item.url as string) || "", views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
    engagementRate: 0, weightedEngagementRate: 0, reachMultiple: null,
    likelyCommentBait: detectCommentBait(caption),
    createTime: null, videoUrl: (item.videoUrl as string) || "",
  };
}
export async function scrapeLinkedin(keyword: string | string[], opts: { count?: number; pool?: number } = {}) {
  const { count = 5, pool } = opts;
  console.log(`   🕷️  Provider: ${describeProvider()} — LinkedIn (best-effort, auth-walled)`);
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  const poolSize = pool || Math.max(count * 6, 20);
  const { items } = await runActor(ACTOR, { keywords, keyword: keywords[0], count: poolSize });
  const all = (items as Record<string, unknown>[]).map(normalizeLinkedin).filter((v) => v.url && v.id);
  console.log(`   Pulled ${all.length} LinkedIn posts (may be 0 without LINKEDIN_COOKIE — expected).`);
  return { videos: all.slice(0, count), raw: items, pool: all, poolCount: all.length, rankBy: "engagement" };
}
export const scrapeLinkedinTool = createTool({
  id: "scrape-linkedin",
  description: "Scrape LinkedIn videos (best-effort, needs LINKEDIN_COOKIE for full results, else Bing fallback).",
  inputSchema: z.object({ keywords: z.array(z.string()).min(1), count: z.number().default(5), pool: z.number().optional() }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number(), rankBy: z.string() }),
  execute: async ({ context }) => scrapeLinkedin(context.keywords, context),
});
