// @ts-nocheck
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const TW_ACTOR = "local/twitter";

export function normalizeTwitter(item: Record<string, unknown>): Video {
  const id = String(item.id || item.videoId || "");
  const caption = (item.caption as string) || (item.text as string) || "";
  const views = Number(item.viewCount || 0);
  const likes = Number(item.likeCount || item.favorite_count || 0);
  const comments = Number(item.replyCount || item.commentCount || 0);
  const shares = Number(item.retweetCount || 0);
  const saves = 0;
  const followers = Number(item.followers || 0);
  const engagementRate = views > 0 ? (likes + comments + shares) / views : (likes + comments + shares) > 0 ? 0.01 : 0;
  const weighted = shares * 4 + likes * 1 + comments * 0.5;
  const weightedEngagementRate = views > 0 ? weighted / views : weighted / 1000;
  return {
    platform: "twitter",
    id, caption,
    author: (item.username as string) || (item.author as string) || "unknown",
    language: "", followers, verified: Boolean(item.verified), isAd: false,
    url: (item.url as string) || (id ? `https://x.com/i/status/${id}` : ""),
    views, likes, comments, shares, saves, engagementRate, weightedEngagementRate, reachMultiple: followers ? views / followers : null,
    likelyCommentBait: detectCommentBait(caption),
    createTime: (item.createdAt as string) || null,
    videoUrl: (item.videoUrl as string) || "",
  };
}

export async function scrapeTwitter(keyword: string | string[], opts: { count?: number; pool?: number; rankBy?: string; viewFloor?: number } = {}): Promise<{ videos: Video[]; raw: unknown[]; pool: Video[]; poolCount: number; rankBy: string }> {
  const { count = 5, pool, rankBy = "engagement", viewFloor = 0 } = opts;
  console.log(`   🕷️  Provider: ${describeProvider()} — X/Twitter`);
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  const poolSize = pool || Math.max(count * 6, 20);
  const { items } = await runActor(TW_ACTOR, { keywords, keyword: keywords[0], count: poolSize });
  const all = (items as Record<string, unknown>[]).map(normalizeTwitter).filter((v) => v.url && v.id);
  const sorted = [...all].sort((a, b) => rankBy === "views" ? b.views - a.views : b.weightedEngagementRate - a.weightedEngagementRate).filter((v) => v.views >= viewFloor).slice(0, count);
  console.log(`   Pulled ${all.length} X videos. Keeping top ${sorted.length}.`);
  return { videos: sorted, raw: items.filter((r) => sorted.some((s) => s.id === String((r as Record<string, unknown>).id))), pool: all, poolCount: all.length, rankBy };
}

export const scrapeTwitterTool = createTool({
  id: "scrape-twitter",
  description: "Scrape X/Twitter videos via guest-token search (Crawlee, ban-safe).",
  inputSchema: z.object({ keywords: z.array(z.string()).min(1), count: z.number().default(5), pool: z.number().optional(), rankBy: z.enum(["engagement", "views"]).default("engagement"), viewFloor: z.number().default(0) }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number(), rankBy: z.string() }),
  execute: async ({ context }) => scrapeTwitter(context.keywords, context),
});
