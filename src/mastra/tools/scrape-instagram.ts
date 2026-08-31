// @ts-nocheck
// src/mastra/tools/scrape-instagram.ts — Mastra tool for Instagram reels

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, getScraperProvider, isApifyConfigured, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const HASHTAG_ACTOR = "apify/instagram-hashtag-scraper";
const REEL_ACTOR = "apify/instagram-reel-scraper";
const IG_SEARCH_REELS_ACTOR = "patient_discovery/instagram-search-reels";

export function normalizeReel(item: Record<string, unknown>): Video {
  const shortCode = (item.shortCode as string) || (item.shortcode as string) || (item.code as string) || null;
  const id = shortCode || (item.id as string) || null;
  const caption = (item.caption as string) || (item.text as string) || "";
  const views = (item.videoPlayCount as number) ?? (item.playCount as number) ?? (item.videoViewCount as number) ?? (item.viewCount as number) ?? 0;
  const likes = (item.likesCount as number) ?? (item.likes as number) ?? 0;
  const comments = (item.commentsCount as number) ?? (item.comments as number) ?? 0;
  const shares = (item.sharesCount as number) ?? (item.reshareCount as number) ?? 0;
  const saves = 0;
  const followers = (item.ownerFollowersCount as number) ?? (item.followersCount as number) ?? 0;
  const engagementRate = views > 0 ? (likes + comments + shares + saves) / views : 0;
  const weightedEngagementRate = views > 0 ? (shares * 4 + saves * 3 + likes * 1 + comments * 0.5) / views : 0;
  const reachMultiple = followers > 0 ? views / followers : null;
  return {
    platform: "instagram",
    id, caption,
    author: (item.ownerUsername as string) || (item.username as string) || ((item.owner as Record<string,string>)?.username) || "unknown",
    language: "",
    followers,
    verified: (item.ownerIsVerified as boolean) ?? (item.isVerified as boolean) ?? false,
    isAd: (item.isSponsored as boolean) ?? false,
    url: (item.url as string) || (shortCode ? `https://www.instagram.com/reel/${shortCode}/` : ""),
    views, likes, comments, shares, saves, engagementRate, weightedEngagementRate, reachMultiple,
    likelyCommentBait: detectCommentBait(caption),
    createTime: (item.timestamp as string) || (item.takenAt as string) || null,
    videoUrl: (item.videoUrl as string) || (item.video_url as string) || ((item.videoUrls as string[])?.[0]) || "",
  };
}

export function normalizeReelFromSearch(item: Record<string, unknown>): Video {
  const code = (item.code as string) || null;
  const id = item.id ? String(item.id) : code;
  const caption = ((item.caption as Record<string,string>)?.text) || "";
  const views = (item.ig_play_count as number) ?? (item.play_count as number) ?? (item.video_view_count as number) ?? 0;
  const likes = (item.like_count as number) ?? 0;
  const comments = (item.comment_count as number) ?? 0;
  const shares = (item.share_count as number) ?? 0;
  const saves = 0;
  const followers = ((item.user as Record<string, number>)?.follower_count as number) ?? 0;
  const engagementRate = views > 0 ? (likes + comments + shares + saves) / views : 0;
  const weightedEngagementRate = views > 0 ? (shares * 4 + saves * 3 + likes * 1 + comments * 0.5) / views : 0;
  const reachMultiple = followers > 0 ? views / followers : null;
  return {
    platform: "instagram",
    id: id as string,
    caption,
    author: ((item.user as Record<string,string>)?.username as string) || "unknown",
    language: "",
    followers,
    verified: Boolean((item.user as Record<string, unknown>)?.is_verified),
    isAd: Boolean(item.is_paid_partnership),
    url: code ? `https://www.instagram.com/reel/${code}/` : ((item.url as string) || ""),
    views, likes, comments, shares, saves, engagementRate, weightedEngagementRate, reachMultiple,
    likelyCommentBait: detectCommentBait(caption),
    createTime: (item.taken_at_date as string) || (item.taken_at_ts as string) || (item.taken_at as string) || null,
    videoUrl: (item.video_url as string) || ((item.video_versions as Record<string,string>[] )?.[0]?.url) || "",
  };
}

function isReelItem(item: Record<string, unknown>): boolean {
  if (item.videoUrl || item.video_url) return true;
  const type = String(item.type || item.productType || "").toLowerCase();
  return type.includes("video") || type.includes("clips") || type.includes("reel");
}

export async function scrapeInstagram(
  sources: { keywords?: string[]; hashtags?: string[]; accounts?: string[] },
  { count = 5, pool, newerThan = "90 days" }: { count?: number; pool?: number; newerThan?: string } = {}
): Promise<{ pool: Video[]; poolCount: number; raw: unknown[] }> {
  const provider = getScraperProvider();
  if (provider === "apify" && !isApifyConfigured()) throw new Error("APIFY_TOKEN missing — set it in .env or use SCRAPER_PROVIDER=crawlee (open-source, no token).");
  if (provider !== "apify" && !isApifyConfigured()) console.log(`   🕷️  Using ${describeProvider()} — IG fetch stays under 30 req/min (anti-ban)`);
  else console.log(`   🕷️  Provider: ${describeProvider()}`);
  const keywords = (sources.keywords || []).filter(Boolean);
  const hashtags = (sources.hashtags || []).filter(Boolean);
  const accounts = (sources.accounts || []).filter(Boolean);
  if (!keywords.length && !hashtags.length && !accounts.length) throw new Error("Instagram scrape needs at least one keyword, hashtag, or account.");
  const poolSize = pool || Math.max(count * 6, 20);
  const hashtagBudget = accounts.length ? Math.ceil(poolSize / 2) : poolSize;
  const accountBudget = hashtags.length ? Math.floor(poolSize / 2) : poolSize;
  const runs: Promise<{ type: string; items: unknown[] }>[] = [];
  if (keywords.length) {
    const perKeyword = Math.max(12, Math.ceil(poolSize / keywords.length));
    const maxPages = Math.max(2, Math.ceil(perKeyword / 12));
    console.log(`\n🔎 Instagram search for ${keywords.map((k) => `"${k}"`).join(", ")} (~${maxPages} pages/keyword)...`);
    for (const kw of keywords) {
      runs.push(
        runActor(IG_SEARCH_REELS_ACTOR, { query: kw, maxPages })
          .then(({ items }) => ({ type: "norm", items: (items as Record<string,unknown>[]).map(normalizeReelFromSearch) }))
          .catch((err: Error) => { console.log(`   ⚠️ keyword scrape failed for "${kw}": ${err.message}`); return { type: "norm", items: [] }; })
      );
    }
  }
  if (hashtags.length) {
    const perHashtag = Math.max(2, Math.ceil(hashtagBudget / hashtags.length));
    console.log(`\n🔎 Instagram hashtags ${hashtags.map((h) => "#" + h).join(", ")} (~${perHashtag}/hashtag)...`);
    runs.push(
      runActor(HASHTAG_ACTOR, { hashtags, resultsType: "reels", resultsLimit: perHashtag })
        .then(({ items }) => ({ type: "raw", items }))
        .catch((err: Error) => { console.log(`   ⚠️ hashtag scrape failed: ${err.message}`); return { type: "raw", items: [] }; })
    );
  }
  if (accounts.length) {
    const perAccount = Math.max(2, Math.ceil(accountBudget / accounts.length));
    console.log(`🔎 Instagram accounts ${accounts.map((a) => "@" + a).join(", ")} (~${perAccount}/account)...`);
    runs.push(
      runActor(REEL_ACTOR, { username: accounts, resultsLimit: perAccount, onlyPostsNewerThan: newerThan })
        .then(({ items }) => ({ type: "raw", items }))
        .catch((err: Error) => { console.log(`   ⚠️ account scrape failed: ${err.message}`); return { type: "raw", items: [] }; })
    );
  }
  const batches = await Promise.all(runs);
  const seen = new Set<string>();
  const allVideos: Video[] = [];
  let rawCount = 0;
  for (const b of batches) {
    rawCount += b.items.length;
    const vids = b.type === "norm" ? (b.items as Video[]) : (b.items as Record<string, unknown>[]).filter(isReelItem).map(normalizeReel);
    for (const v of vids) { if (v.url && v.id && !seen.has(v.id as string)) { seen.add(v.id as string); allVideos.push(v); } }
  }
  console.log(`   Pulled ${rawCount} items → ${allVideos.length} unique reels.`);
  return { pool: allVideos, poolCount: allVideos.length, raw: [] };
}

export const scrapeInstagramTool = createTool({
  id: "scrape-instagram",
  description: "Scrape Instagram reels via keyword/hashtag/account search and return a deduplicated pool.",
  inputSchema: z.object({
    keywords: z.array(z.string()).optional(),
    hashtags: z.array(z.string()).optional(),
    accounts: z.array(z.string()).optional(),
    count: z.number().default(5),
    pool: z.number().optional(),
    newerThan: z.string().default("90 days"),
  }),
  outputSchema: z.object({ pool: z.array(z.any()), poolCount: z.number() }),
  execute: async ({ context }) => scrapeInstagram({ keywords: context.keywords, hashtags: context.hashtags, accounts: context.accounts }, { count: context.count, pool: context.pool, newerThan: context.newerThan }),
});
