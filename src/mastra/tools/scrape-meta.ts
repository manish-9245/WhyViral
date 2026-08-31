// @ts-nocheck
// src/mastra/tools/scrape-meta.ts — Mastra tool for Meta Ad Library

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runActor, getScraperProvider, isApifyConfigured, describeProvider } from "../lib/scraper";
import { detectCommentBait } from "./scrape-tiktok";
import type { Video } from "../../lib/types";

const META_ACTOR = "curious_coder/facebook-ads-library-scraper";

export function normalizeAd(item: Record<string, unknown>): Video {
  const id = (item.ad_archive_id as string) || (item.id as string) || (item.archive_id as string) || null;
  let caption = ((item.snapshot as Record<string, unknown>)?.body as string) || ((item.ad_creative_bodies as string[])?.[0]) || (item.body as string) || "";
  if (typeof caption === "object" && (caption as Record<string, string>)?.text) caption = (caption as Record<string,string>).text;
  const author = (item.page_name as string) || ((item.snapshot as Record<string,string>)?.page_name) || "Unknown Advertiser";
  const startDate = (item.start_date as number) || ((item.snapshot as Record<string,number>)?.start_date);
  const now = Math.floor(Date.now() / 1000);
  const daysRunning = startDate ? Math.floor((now - startDate) / 86400) : 0;
  const snapshot = item.snapshot as Record<string, unknown> | undefined;
  const videoUrl = ((snapshot?.videos as Record<string,string>[] )?.[0]?.video_hd_url) || ((snapshot?.videos as Record<string,string>[] )?.[0]?.video_sd_url) || (item.video_hd_url as string) || (item.video_sd_url as string) || ((item.video as Record<string,string>)?.hd_url) || ((item.video as Record<string,string>)?.sd_url) || (item.videoUrl as string) || "";
  const adId = (item.ad_archive_id as string) || id;
  const url = adId ? `https://www.facebook.com/ads/library/?id=${adId}` : "";
  return {
    platform: "meta",
    id, caption, author,
    language: "",
    followers: 0, verified: false, isAd: false,
    url,
    views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
    engagementRate: 0, weightedEngagementRate: 0, reachMultiple: null,
    likelyCommentBait: detectCommentBait(caption),
    createTime: item.start_date ? new Date((startDate as number) * 1000).toISOString() : null,
    videoUrl,
    daysRunning,
  };
}

function hasVideo(item: Record<string, unknown>): boolean {
  const snap = item.snapshot as Record<string, unknown> | undefined;
  const hasSnapshot = !!((snap?.videos as Record<string,string>[] )?.[0]?.video_hd_url || (snap?.videos as Record<string,string>[] )?.[0]?.video_sd_url);
  const hasRootLevel = !!(item.video_hd_url || item.video_sd_url);
  const hasVideo_ = !!((item.video as Record<string,string>)?.hd_url || (item.video as Record<string,string>)?.sd_url);
  return hasSnapshot || hasRootLevel || hasVideo_;
}

export function creativeKey(ad: Video): string {
  const copy = String(ad.caption || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
  return copy ? `${String(ad.author || "").toLowerCase()}::${copy}` : `id::${ad.id}`;
}

export function rankAds(
  ads: Video[],
  { daysFloor = 30, count = 5, maxPerPage = (Number(process.env.META_MAX_PER_PAGE) || Infinity) } = {}
): Video[] {
  const eligible = ads.filter((a) => (a.daysRunning ?? 0) >= daysFloor).sort((a, b) => (b.daysRunning ?? 0) - (a.daysRunning ?? 0));
  const groups = new Map<string, Video[]>();
  for (const a of eligible) { const ck = creativeKey(a); if (!groups.has(ck)) groups.set(ck, []); groups.get(ck)!.push(a); }
  const perPage = new Map<string, number>();
  const out: Video[] = [];
  for (const [, g] of groups) {
    const rep = g[0];
    (rep as Video & { variantCount: number }).variantCount = g.length;
    const page = String(rep.author || "").toLowerCase();
    if ((perPage.get(page) || 0) >= maxPerPage) continue;
    perPage.set(page, (perPage.get(page) || 0) + 1);
    out.push(rep);
    if (out.length >= count) break;
  }
  return out;
}

export async function scrapeMeta(
  keywords: string | string[],
  { count = 5, pool, country = "US" }: { count?: number; pool?: number; country?: string | string[] } = {}
) {
  const _provider = getScraperProvider();
  if (_provider === "apify" && !isApifyConfigured()) throw new Error("APIFY_TOKEN missing — set it in .env or use SCRAPER_PROVIDER=crawlee (open-source, no token).");
  if (_provider !== "apify" && !isApifyConfigured()) console.log(`   🕷️  Using ${describeProvider()} — Meta Ad Library is public data (safest, 800ms jitter between URLs)`);
  else console.log(`   🕷️  Provider: ${describeProvider()}`);
  const queries = Array.isArray(keywords) ? keywords : [keywords];
  const countries = Array.isArray(country) ? country : [country];
  const poolSize = pool || Math.max(count * 6, 20);
  const daysFloor = Number(process.env.META_DAYS_FLOOR) || 30;
  const urls = countries.flatMap((c) => queries.map((q) => ({ url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${c}&q=${encodeURIComponent(q)}&media_type=video&search_type=keyword_unordered` })));
  console.log(`\n🔎 Meta Ad Library for ${queries.length} keyword(s) across ${countries.join(", ")} (${urls.length} URLs)...`);
  const input = { urls, count: Math.max(poolSize, 10) };
  const maxSpend = Number(process.env.META_MAX_SPEND) || 2.0;
  const { items } = await runActor(META_ACTOR, input, { maxTotalChargeUsd: maxSpend } as never);
  const seen = new Set<string>();
  const allAds = (items as Record<string,unknown>[]).filter(hasVideo).map(normalizeAd).filter((a) => a.url && a.id && !seen.has(a.id as string) && seen.add(a.id as string));
  const winners = rankAds(allAds, { daysFloor, count });
  const winnerIds = new Set(winners.map((a) => a.id));
  const raw = (items as Record<string,unknown>[]).filter((r) => winnerIds.has(((r as Record<string,unknown>).id as string) || ((r as Record<string,unknown>).archive_id as string)));
  console.log(`   Pulled ${allAds.length} video ads. Keeping top ${winners.length}.`);
  return { videos: winners, raw, pool: allAds, poolCount: allAds.length, rankBy: "daysRunning" };
}

const SAFE_MODIFIERS = ["india","official","inc","skincare","cosmetics","beauty","store","shop","in","co"];

export async function resolvePageId(brandName: string, { country = "ALL", maxSpendUsd = 0.05, count = 20 } = {}) {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(brandName)}&media_type=all&search_type=keyword_unordered`;
  const { items } = await runActor(META_ACTOR, { urls: [{ url }], count } as never, { maxTotalChargeUsd: maxSpendUsd } as never);
  const norm = (s: string) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]/g, "");
  const target = norm(brandName);
  const candidates = new Map<string,string>();
  for (const it of items as Record<string,unknown>[]) {
    const pid = (it.page_id as string) || ((it.snapshot as Record<string,string>)?.page_id as string);
    const pname = (it.page_name as string) || ((it.snapshot as Record<string,string>)?.page_name as string);
    if (pid && pname) candidates.set(pid, pname);
  }
  let best: { pageId: string; pageName: string } | null = null;
  for (const [pid, pname] of candidates) if (norm(pname) === target) { best = { pageId: pid, pageName: pname }; break; }
  if (!best) {
    for (const [pid, pname] of candidates) {
      const npname = norm(pname);
      if (!npname.startsWith(target)) continue;
      const remainder = npname.slice(target.length);
      if (SAFE_MODIFIERS.some((m) => remainder === m)) { best = { pageId: pid, pageName: pname }; break; }
    }
  }
  return best;
}

async function scrapePageAds(pageId: string, { country = "ALL", count = 60, maxSpendUsd = 0.4 } = {}) {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&view_all_page_id=${pageId}&media_type=video`;
  const { items } = await runActor(META_ACTOR, { urls: [{ url }], count: Math.max(count, 10) } as never, { maxTotalChargeUsd: maxSpendUsd } as never);
  return (items as Record<string,unknown>[]).filter(hasVideo).map(normalizeAd);
}

export async function scrapeMetaBrands(brandNames: string[], { count = 100, country = "ALL", perBrandCount = 60, idSpendUsd = 0.05, pageSpendUsd = 0.4 } = {}) {
  const _p2 = getScraperProvider();
  if (_p2 === "apify" && !isApifyConfigured()) throw new Error("APIFY_TOKEN missing — set it in .env or use SCRAPER_PROVIDER=crawlee.");
  if (_p2 !== "apify" && !isApifyConfigured()) console.log(`   🕷️  Using ${describeProvider()} — brand lookup via public Meta search`);
  const daysFloor = Number(process.env.META_DAYS_FLOOR) || 30;
  console.log(`\n🔎 Brand-first Meta scrape: ${brandNames.length} brand(s)...`);
  let allAds: Video[] = [];
  for (const brand of brandNames) {
    let match;
    try { match = await resolvePageId(brand, { country, maxSpendUsd: idSpendUsd }); } catch (err) { console.log(`   ⚠️ ${brand}: lookup failed (${(err as Error).message})`); continue; }
    if (!match) { console.log(`   ✗ ${brand}: no confident page match`); continue; }
    let ads: Video[];
    try { ads = await scrapePageAds(match.pageId, { country, count: perBrandCount, maxSpendUsd: pageSpendUsd }); } catch (err) { console.log(`   ⚠️ ${brand}: pull failed (${(err as Error).message})`); continue; }
    console.log(`   ✔ ${brand} → "${match.pageName}": ${ads.length} ads.`);
    allAds = allAds.concat(ads);
  }
  const seen = new Set<string>();
  allAds = allAds.filter((a) => a.url && a.id && !seen.has(a.id as string) && seen.add(a.id as string));
  const winners = rankAds(allAds, { daysFloor, count });
  console.log(`\n   Total: ${allAds.length} ads → keeping ${winners.length}.`);
  return { videos: winners, raw: [], pool: allAds, poolCount: allAds.length, rankBy: "daysRunning" };
}

export const scrapeMetaTool = createTool({
  id: "scrape-meta",
  description: "Scrape Meta Ad Library by keyword and rank by daysRunning.",
  inputSchema: z.object({
    keywords: z.array(z.string()).min(1),
    count: z.number().default(5),
    pool: z.number().optional(),
    country: z.union([z.string(), z.array(z.string())]).default("US"),
  }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number(), rankBy: z.string() }),
  execute: async ({ context }) => scrapeMeta(context.keywords, { count: context.count, pool: context.pool, country: context.country as string }),
});

export const scrapeMetaBrandsTool = createTool({
  id: "scrape-meta-brands",
  description: "Resolve brand names to Facebook Page IDs and scrape each brand's video ads.",
  inputSchema: z.object({
    brandNames: z.array(z.string()).min(1),
    count: z.number().default(100),
    country: z.string().default("ALL"),
    perBrandCount: z.number().default(60),
  }),
  outputSchema: z.object({ videos: z.array(z.any()), pool: z.array(z.any()), poolCount: z.number() }),
  execute: async ({ context }) => scrapeMetaBrands(context.brandNames, { count: context.count, country: context.country, perBrandCount: context.perBrandCount }),
});
