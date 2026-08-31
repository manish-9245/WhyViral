// @ts-nocheck
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const ACTOR = "local/snapchat";
export function normalizeSnapchat(item: Record<string, unknown>): Video {
  const id = String(item.id || item.videoId || "");
  const caption = (item.caption as string) || (item.title as string) || "";
  return {
    platform: "snapchat",
    id, caption, author: "unknown", language: "", followers: 0, verified: false, isAd: false,
    url: (item.url as string) || "", views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
    engagementRate: 0, weightedEngagementRate: 0, reachMultiple: null,
    likelyCommentBait: detectCommentBait(caption),
    createTime: null, videoUrl: (item.videoUrl as string) || "",
  };
}
export async function scrapeSnapchat(keyword: string | string[], opts: { count?: number; pool?: number } = {}) {
  const { count = 5, pool } = opts;
  console.log(`   🕷️  Provider: ${describeProvider()} — Snapchat Spotlight (best-effort, heavily auth-walled)`);
  const keywords = Array.isArray(keyword) ? keyword : [keyword];
  const poolSize = pool || Math.max(count * 6, 20);
  const { items } = await runActor(ACTOR, { keywords, keyword: keywords[0], count: poolSize });
  const all = (items as Record<string, unknown>[]).map(normalizeSnapchat).filter((v) => v.url && v.id);
  console.log(`   Pulled ${all.length} Snapchat snaps (may be 0 — expected).`);
  return { videos: all.slice(0, count), raw: items, pool: all, poolCount: all.length, rankBy: "engagement" };
}
export const scrapeSnapchatTool = createTool({
  id: "scrape-snapchat",
  description: "Scrape Snapchat Spotlight (best-effort, heavily auth-walled, returns empty gracefully).",
  inputSchema: z.object({ keywords: z.array(z.string()).min(1), count: z.number().default(5), pool: z.number().optional() }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number(), rankBy: z.string() }),
  execute: async ({ context }) => scrapeSnapchat(context.keywords, context),
});
