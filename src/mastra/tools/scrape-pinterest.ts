// @ts-nocheck
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const ACTOR = "local/pinterest";
export function normalizePinterest(item: Record<string, unknown>): Video {
  const id = String(item.id || item.videoId || "");
  const caption = (item.caption as string) || (item.title as string) || "";
  const views = Number(item.viewCount || 0);
  const likes = Number(item.likeCount || 0);
  return {
    platform: "pinterest",
    id, caption, author: (item.author as string) || "unknown", language: "", followers: 0, verified: false, isAd: false,
    url: (item.url as string) || (id ? `https://www.pinterest.com/pin/${id}/` : ""),
    views, likes, comments: 0, shares: 0, saves: Number(item.saveCount || 0),
    engagementRate: views ? (likes / views) : 0, weightedEngagementRate: views ? (likes / views) : 0, reachMultiple: null,
    likelyCommentBait: detectCommentBait(caption),
    createTime: null, videoUrl: (item.videoUrl as string) || "",
  };
}
export async function scrapePinterest(keyword: string | string[], opts: { count?: number; pool?: number; rankBy?: string } = {}): Promise<{ videos: Video[]; raw: unknown[]; pool: Video[]; poolCount: number; rankBy: string }> {
  const { count = 5, pool, rankBy = "engagement" } = opts;
  console.log(`   🕷️  Provider: ${describeProvider()} — Pinterest`);
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  const poolSize = pool || Math.max(count * 6, 20);
  const { items } = await runActor(ACTOR, { keywords, keyword: keywords[0], count: poolSize });
  const all = (items as Record<string, unknown>[]).map(normalizePinterest).filter((v) => v.url && v.id);
  const sorted = [...all].sort((a, b) => b.views - a.views).slice(0, count);
  console.log(`   Pulled ${all.length} Pinterest pins. Keeping top ${sorted.length}.`);
  return { videos: sorted, raw: items, pool: all, poolCount: all.length, rankBy };
}
export const scrapePinterestTool = createTool({
  id: "scrape-pinterest",
  description: "Scrape Pinterest Idea Pins (video) via public search (Crawlee, ban-safe).",
  inputSchema: z.object({ keywords: z.array(z.string()).min(1), count: z.number().default(5), pool: z.number().optional(), rankBy: z.string().default("engagement") }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number(), rankBy: z.string() }),
  execute: async ({ context }) => scrapePinterest(context.keywords, context),
});
