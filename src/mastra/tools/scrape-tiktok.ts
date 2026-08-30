// @ts-nocheck
// src/mastra/tools/scrape-tiktok.ts — Mastra Tool wrapper for TikTok scraper
// Business logic is identical to src/scrape-tiktok.js; exposed as a typed Mastra tool.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, currentClient, apifyTokens } from "../lib/apify";
import type { Video } from "../../lib/types";

const APIFY_TIKTOK_ACTOR = "clockworks/tiktok-scraper";
const SCRAPTIK_ACTOR = "scraptik/tiktok-api";

const COMMENT_BAIT_PATTERNS = [
  /comment(?:ing)?\b(?![^.!?]{0,20}\bbelow your\b)/i,
  /drop a\b/i,
  /type (?:the )?(?:word|["'a-z]+)/i,
  /\bdm(?:'?ing)? me\b/i,
  /\bdm for\b/i,
  /\breply (?:with|["'a-z]+)/i,
  /i'?ll send (?:you|the)/i,
  /say (?:the word|["'][a-z]+["'])/i,
];

export function detectCommentBait(caption: string): boolean {
  return COMMENT_BAIT_PATTERNS.some((re) => re.test(caption || ""));
}

export function normalizeVideo(item: Record<string, unknown>): Video {
  const views = (item.playCount as number) ?? (item.views as number) ?? 0;
  const likes = (item.diggCount as number) ?? (item.likes as number) ?? 0;
  const comments = (item.commentCount as number) ?? (item.comments as number) ?? 0;
  const shares = (item.shareCount as number) ?? (item.shares as number) ?? 0;
  const saves = (item.collectCount as number) ?? (item.saves as number) ?? 0;
  const followers = ((item.authorMeta as Record<string, unknown>)?.fans as number) ?? 0;
  const caption = (item.text as string) || (item.desc as string) || (item.caption as string) || "";
  const engagementRate = views > 0 ? (likes + comments + shares + saves) / views : 0;
  const weightedEngagementRate = views > 0 ? (shares * 4 + saves * 3 + likes * 1 + comments * 0.5) / views : 0;
  const reachMultiple = followers > 0 ? views / followers : null;
  const likelyCommentBait = COMMENT_BAIT_PATTERNS.some((re) => re.test(caption));
  return {
    platform: "tiktok",
    id: (item.id as string) || (item.videoId as string) || null,
    caption,
    author:
      ((item.authorMeta as Record<string, unknown>)?.name as string) ||
      ((item.authorMeta as Record<string, unknown>)?.nickName as string) ||
      (item.author as string) || "unknown",
    language: (item.textLanguage as string) || null,
    followers,
    verified: ((item.authorMeta as Record<string, unknown>)?.verified as boolean) ?? false,
    isAd: (item.isAd as boolean) ?? false,
    url: (item.webVideoUrl as string) || (item.postPage as string) || (item.url as string) || "",
    views, likes, comments, shares, saves, engagementRate, weightedEngagementRate, reachMultiple, likelyCommentBait,
    createTime: (item.createTimeISO as string) || (item.createTime as string) || null,
    videoUrl: ((item.mediaUrls as string[])?.[0]) || ((item.videoMeta as Record<string,string>)?.downloadAddr) || (item.videoUrl as string) || "",
  };
}

export function normalizeVideoFromScraptik(a: Record<string, unknown>): Video {
  const stats = (a.statistics as Record<string, number>) || {};
  const views = stats.play_count ?? 0;
  const likes = stats.digg_count ?? 0;
  const comments = stats.comment_count ?? 0;
  const shares = stats.share_count ?? 0;
  const saves = stats.collect_count ?? 0;
  const author = a.author as Record<string, unknown> | undefined;
  const followers = (author?.follower_count as number) ?? 0;
  const caption = (a.desc as string) || "";
  const engagementRate = views > 0 ? (likes + comments + shares + saves) / views : 0;
  const weightedEngagementRate = views > 0 ? (shares * 4 + saves * 3 + likes * 1 + comments * 0.5) / views : 0;
  const reachMultiple = followers > 0 ? views / followers : null;
  const likelyCommentBait = COMMENT_BAIT_PATTERNS.some((re) => re.test(caption));
  const username = (author?.unique_id as string) || (author?.nickname as string) || "unknown";
  const id = a.aweme_id ? String(a.aweme_id) : null;
  const video = a.video as Record<string, unknown> | undefined;
  const playAddr = video?.play_addr as Record<string, unknown> | undefined;
  const downloadAddr = video?.download_addr as Record<string, unknown> | undefined;
  const videoUrl = ((playAddr?.url_list as string[])?.[0]) || ((downloadAddr?.url_list as string[])?.[0]) || "";
  return {
    platform: "tiktok",
    id, caption, author: username,
    language: (a.desc_language as string) || null,
    followers,
    verified: Boolean(author?.custom_verify || author?.enterprise_verify_reason),
    isAd: Boolean(a.is_ads),
    url: (a.share_url as string) || (id ? `https://www.tiktok.com/@${username}/video/${id}` : ""),
    views, likes, comments, shares, saves, engagementRate, weightedEngagementRate, reachMultiple, likelyCommentBait,
    createTime: a.create_time ? new Date((a.create_time as number) * 1000).toISOString() : null,
    videoUrl,
    durationSeconds: (video?.duration as number) ? Math.round((video.duration as number) / 1000) : null,
  };
}

export function rankVideos(
  videos: Video[],
  { rankBy = "engagement", viewFloor = 100_000, count = 5, language = "en" } = {}
): Video[] {
  const langOk = (v: Video) =>
    language === "any" || !v.language || v.language.toLowerCase().startsWith(language.toLowerCase());
  const eligible = videos.filter((v) => !v.isAd && v.views >= viewFloor && langOk(v));
  const score = (v: Video) => v.weightedEngagementRate * (v.likelyCommentBait ? 0.5 : 1);
  const sorters: Record<string, (a: Video, b: Video) => number> = {
    engagement: (a, b) => score(b) - score(a),
    reach: (a, b) => (b.reachMultiple ?? 0) - (a.reachMultiple ?? 0),
    views: (a, b) => b.views - a.views,
  };
  return eligible.sort(sorters[rankBy] || sorters.engagement).slice(0, count);
}

export async function scrapeTikTok(
  keyword: string | string[],
  opts: {
    count?: number; pool?: number; rankBy?: string; viewFloor?: number;
    minLikes?: number; language?: string; country?: string; legacy?: boolean; regions?: string[];
  } = {}
): Promise<{ videos: Video[]; raw: unknown[]; pool: Video[]; poolCount: number; rankBy: string }> {
  const { count = 5, pool, rankBy = "engagement", viewFloor = 100_000, minLikes = 0, language = "en", country = "US", legacy = false, regions } = opts;
  if (!apifyTokens().length) throw new Error("No APIFY_TOKEN found in your .env file.");
  const queries = Array.isArray(keyword) ? keyword : [keyword];
  const poolSize = pool || Math.max(count * 6, 20);
  const apify = currentClient();
  if (legacy) return scrapeTikTokLegacy(apify, queries, { count, poolSize, rankBy, viewFloor, minLikes, language, country });
  const PAGE_SIZE = 30;
  const MAX_PAGES = 20;
  const regionList = Array.isArray(regions) && regions.length ? regions : [country];
  const targetPerKeyword = Math.max(PAGE_SIZE, Math.ceil(poolSize / queries.length / regionList.length));
  console.log(`\n🔎 Searching TikTok (scraptik) for ${queries.length} keyword(s) across ${regionList.join(", ")} — up to ${targetPerKeyword}/term/region ...`);
  const seen = new Set<string>();
  const allVideos: Video[] = [];
  const rawAll: Record<string, unknown>[] = [];
  for (const region of regionList) {
    for (const q of queries) {
      let offset = 0;
      let gathered = 0;
      for (let page = 0; page < MAX_PAGES && gathered < targetPerKeyword; page++) {
        const { items } = await runActor(SCRAPTIK_ACTOR, {
          searchPosts_keyword: q,
          searchPosts_count: PAGE_SIZE,
          searchPosts_region: region,
          searchPosts_offset: offset,
          searchPosts_publishTime: 0,
          searchPosts_sortType: 0,
        });
        const awemes = (items as Record<string, unknown>[]).flatMap((it) => ((it.search_item_list as Record<string, unknown>[]) || []).map((s) => s.aweme_info as Record<string, unknown>)).filter(Boolean);
        if (!awemes.length) break;
        let added = 0;
        for (const a of awemes) {
          const v = normalizeVideoFromScraptik(a);
          if (v.url && v.id && !seen.has(v.id)) { seen.add(v.id); allVideos.push(v); rawAll.push(a); added++; }
        }
        gathered += awemes.length;
        offset += PAGE_SIZE;
        const hasMore = (items as Record<string, unknown>[]).some((it) => it.has_more === 1);
        if (!hasMore || added === 0) break;
      }
    }
  }
  const adsDropped = allVideos.filter((v) => v.isAd).length;
  const winners = rankVideos(allVideos, { rankBy, viewFloor, count, language });
  const winnerIds = new Set(winners.map((v) => v.id));
  const raw = rawAll.filter((a) => winnerIds.has(String(a.aweme_id)));
  console.log(`   Pulled ${allVideos.length} videos (dropped ${adsDropped} ads). Keeping top ${winners.length} by ${rankBy}.`);
  return { videos: winners, raw, pool: allVideos, poolCount: allVideos.length, rankBy };
}

async function scrapeTikTokLegacy(
  apify: ReturnType<typeof currentClient>,
  queries: string[],
  { count, poolSize, rankBy, viewFloor, minLikes, language, country }: Record<string, unknown>
): Promise<{ videos: Video[]; raw: unknown[]; pool: Video[]; poolCount: number; rankBy: string }> {
  const input: Record<string, unknown> = {
    searchQueries: queries,
    resultsPerPage: poolSize,
    searchSection: "/video",
    videoSearchSorting: "MOST_LIKED",
    shouldDownloadVideos: true,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    proxyConfiguration: { useApifyProxy: true, apifyProxyCountry: country },
  };
  if ((minLikes as number) > 0) input.leastDiggs = minLikes;
  console.log(`\n🔎 [legacy] Searching TikTok for ${queries.map((q) => `"${q}"`).join(", ")} — up to ${poolSize}/term...`);
  const { items } = await runActor(APIFY_TIKTOK_ACTOR, input);
  const seen = new Set<string>();
  const allVideos = (items as Record<string, unknown>[]).map(normalizeVideo).filter((v) => v.url && v.id && !seen.has(v.id as string) && seen.add(v.id as string));
  const adsDropped = allVideos.filter((v) => v.isAd).length;
  const winners = rankVideos(allVideos, { rankBy: rankBy as string, viewFloor: viewFloor as number, count: count as number, language: language as string });
  const winnerIds = new Set(winners.map((v) => v.id));
  const raw = items.filter((r) => winnerIds.has(((r as Record<string, unknown>).id as string) || ((r as Record<string, unknown>).videoId as string)));
  console.log(`   Pulled ${allVideos.length} videos (dropped ${adsDropped} ads). Keeping top ${winners.length}.`);
  return { videos: winners, raw, pool: allVideos, poolCount: allVideos.length, rankBy: rankBy as string };
}

export const scrapeTikTokTool = createTool({
  id: "scrape-tiktok",
  description: "Scrape TikTok for videos matching keywords, rank by engagement/ views / reach, and return winners + full pool.",
  inputSchema: z.object({
    keywords: z.array(z.string()).min(1),
    count: z.number().default(5),
    pool: z.number().optional(),
    rankBy: z.enum(["engagement", "reach", "views"]).default("engagement"),
    viewFloor: z.number().default(100_000),
    minLikes: z.number().default(0),
    language: z.string().default("en"),
    country: z.string().default("US"),
    regions: z.array(z.string()).optional(),
    legacy: z.boolean().default(false),
  }),
  outputSchema: z.object({
    videos: z.array(z.any()),
    pool: z.array(z.any()),
    poolCount: z.number(),
    rankBy: z.string(),
  }),
  execute: async ({ context }) => {
    const { keywords, ...opts } = context;
    return scrapeTikTok(keywords, opts);
  },
});
