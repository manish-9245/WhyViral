// @ts-nocheck
// src/mastra/tools/scrape-youtube.ts — Mastra tool for YouTube Shorts (open-source, Crawlee)
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, getScraperProvider, isApifyConfigured, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const YT_ACTOR = "local/youtube-shorts";

export function normalizeYoutube(item: Record<string, unknown>): Video {
  const id = (item.videoId as string) || (item.id as string) || null;
  const title = (item.title as string) || (item.caption as string) || "";
  const caption = title;
  const views = Number(item.viewCount ?? 0);
  const likes = Number(item.likeCount ?? 0);
  const comments = Number(item.commentCount ?? 0);
  const shares = 0, saves = 0;
  const followers = 0;
  const engagementRate = views > 0 ? (likes + comments) / views : 0;
  const weightedEngagementRate = views > 0 ? (likes * 1 + comments * 0.5) / views : 0;
  return {
    platform: "youtube",
    id, caption,
    author: (item.channelTitle as string) || (item.author as string) || "unknown",
    language: (item.language as string) || "",
    followers, verified: false, isAd: false,
    url: (item.url as string) || (id ? `https://www.youtube.com/shorts/${id}` : ""),
    views, likes, comments, shares, saves, engagementRate, weightedEngagementRate, reachMultiple: null,
    likelyCommentBait: detectCommentBait(caption),
    createTime: (item.publishedAt as string) || null,
    videoUrl: (item.videoUrl as string) || (id ? `https://www.youtube.com/shorts/${id}` : ""),
    durationSeconds: (item.durationSeconds as number | null) ?? null,
  };
}

export function rankYoutube(videos: Video[], { rankBy = "engagement", viewFloor = 1000, count = 5, language = "en" } = {}): Video[] {
  void language;
  const eligible = videos.filter((v) => v.views >= viewFloor);
  const score = (v: Video) => v.weightedEngagementRate;
  const sorters: Record<string, (a: Video, b: Video) => number> = {
    engagement: (a, b) => score(b) - score(a),
    views: (a, b) => b.views - a.views,
    reach: (a, b) => b.views - a.views,
  };
  return eligible.sort(sorters[rankBy] || sorters.engagement).slice(0, count);
}

export async function scrapeYoutube(
  keyword: string | string[],
  opts: { count?: number; pool?: number; rankBy?: string; viewFloor?: number; language?: string } = {}
): Promise<{ videos: Video[]; raw: unknown[]; pool: Video[]; poolCount: number; rankBy: string }> {
  const { count = 5, pool, rankBy = "engagement", viewFloor = 1000, language = "en" } = opts;
  const provider = getScraperProvider();
  if (provider === "apify" && !isApifyConfigured()) throw new Error("APIFY_TOKEN missing — YouTube is Crawlee-only, set SCRAPER_PROVIDER=crawlee");
  console.log(`   🕷️  Provider: ${describeProvider()} — YouTube Shorts`);
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  const poolSize = pool || Math.max(count * 6, 20);
  const { items } = await runActor(YT_ACTOR, { keywords, keyword: keywords[0], count: poolSize });
  const allVideos = (items as Record<string, unknown>[]).map(normalizeYoutube).filter((v) => v.url && v.id);
  const winners = rankYoutube(allVideos, { rankBy, viewFloor, count, language });
  const winnerIds = new Set(winners.map((v) => v.id));
  const raw = items.filter((r) => winnerIds.has(String((r as Record<string, unknown>).videoId || (r as Record<string, unknown>).id)));
  console.log(`   Pulled ${allVideos.length} Shorts. Keeping top ${winners.length} by ${rankBy}.`);
  return { videos: winners, raw, pool: allVideos, poolCount: allVideos.length, rankBy };
}

export const scrapeYoutubeTool = createTool({
  id: "scrape-youtube",
  description: "Scrape YouTube Shorts via Data API or ytInitialData (Crawlee, ban-safe) and rank by engagement/views.",
  inputSchema: z.object({
    keywords: z.array(z.string()).min(1),
    count: z.number().default(5),
    pool: z.number().optional(),
    rankBy: z.enum(["engagement", "views", "reach"]).default("engagement"),
    viewFloor: z.number().default(1000),
    language: z.string().default("en"),
  }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number(), rankBy: z.string() }),
  execute: async ({ context }) => scrapeYoutube(context.keywords, context),
});
