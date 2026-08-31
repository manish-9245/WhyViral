// @ts-nocheck
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const ACTOR = "local/reddit";
export function normalizeReddit(item: Record<string, unknown>): Video {
  const id = String(item.id || item.videoId || "");
  const caption = (item.caption as string) || (item.title as string) || "";
  const likes = Number(item.likeCount || item.ups || 0);
  const comments = Number(item.commentCount || 0);
  const views = Number(item.viewCount || 0);
  return {
    platform: "reddit",
    id, caption, author: (item.author as string) || "unknown", language: "", followers: 0, verified: false, isAd: false,
    url: (item.url as string) || (id ? `https://www.reddit.com/comments/${id}` : ""),
    views, likes, comments, shares: 0, saves: 0,
    engagementRate: 0, weightedEngagementRate: likes / 1000, reachMultiple: null,
    likelyCommentBait: detectCommentBait(caption),
    createTime: item.createdUtc ? new Date(Number(item.createdUtc) * 1000).toISOString() : null,
    videoUrl: (item.videoUrl as string) || "",
  };
}
export async function scrapeReddit(keyword: string | string[], opts: { count?: number; pool?: number; rankBy?: string } = {}) {
  const { count = 5, pool, rankBy = "engagement" } = opts;
  console.log(`   🕷️  Provider: ${describeProvider()} — Reddit`);
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  const poolSize = pool || Math.max(count * 6, 20);
  const { items } = await runActor(ACTOR, { keywords, keyword: keywords[0], count: poolSize });
  const all = (items as Record<string, unknown>[]).map(normalizeReddit).filter((v) => v.url && v.id);
  const sorted = [...all].sort((a, b) => b.likes - a.likes).slice(0, count);
  console.log(`   Pulled ${all.length} Reddit videos. Keeping top ${sorted.length}.`);
  return { videos: sorted, raw: items, pool: all, poolCount: all.length, rankBy };
}
export const scrapeRedditTool = createTool({
  id: "scrape-reddit",
  description: "Scrape Reddit videos via public JSON search (Crawlee, ban-safe).",
  inputSchema: z.object({ keywords: z.array(z.string()).min(1), count: z.number().default(5), pool: z.number().optional(), rankBy: z.string().default("engagement") }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number(), rankBy: z.string() }),
  execute: async ({ context }) => scrapeReddit(context.keywords, context),
});
