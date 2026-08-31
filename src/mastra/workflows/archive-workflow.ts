// @ts-nocheck
// src/mastra/workflows/archive-workflow.ts — Main Archive pipeline as Mastra Workflow (Node runtime)
// Simplified to avoid breaking changes across @mastra/core versions.
// The canonical execution is runArchiveWorkflow() which directly invokes step executors.
// The exported `archiveWorkflow` is a minimal Mastra workflow wrapper for `mastra dev` UI.

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { makeClient, isVertex, DEFAULT_MODEL } from "../lib/genai";
import { loadCache, saveCache, cacheValid, tierOf } from "../lib/cache";
import { trackEvent } from "../lib/telemetry";
import { scrapeTikTok, rankVideos } from "../tools/scrape-tiktok";
import { scrapeInstagram } from "../tools/scrape-instagram";
import { scrapeMeta, scrapeMetaBrands, rankAds } from "../tools/scrape-meta";
import { scrapeYoutube } from "../tools/scrape-youtube";
import { scrapeTwitter } from "../tools/scrape-twitter";
import { scrapePinterest } from "../tools/scrape-pinterest";
import { scrapeReddit } from "../tools/scrape-reddit";
import { scrapeLinkedin } from "../tools/scrape-linkedin";
import { scrapeSnapchat } from "../tools/scrape-snapchat";
import { discoverInstagram, confirmDiscovery } from "../tools/discover-instagram";
import { deriveBrands, deriveKeywords } from "../tools/derive";
import { prescreenCaptions } from "../tools/prescreen";
import { analyzeVideo } from "../tools/analyze-video";
import { synthesize } from "../tools/synthesize";

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${Math.round(ms/1000)}s`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const archiveInputSchema = z.object({
  keywords: z.array(z.string()).min(1),
  platform: z.enum(["tiktok", "instagram", "meta", "youtube", "twitter", "pinterest", "reddit", "linkedin", "snapchat", "all"]).default("tiktok"),
  count: z.number().default(5),
  pool: z.number().optional(),
  rankBy: z.string().default("engagement"),
  viewFloor: z.number().default(100_000),
  minLikes: z.number().default(0),
  language: z.string().default("en"),
  country: z.string().default("US"),
  regions: z.array(z.string()).optional(),
  niche: z.string().optional(),
  nicheFilter: z.string().default("strict"),
  adaptableFloor: z.number().optional(),
  metaDaysFloor: z.number().default(30),
  minSynth: z.number().default(5),
  deepCount: z.number().default(8),
  reuse: z.boolean().default(false),
  igHashtags: z.array(z.string()).default([]),
  igAccounts: z.array(z.string()).default([]),
  metaBrands: z.array(z.string()).default([]),
  testMode: z.boolean().default(false),
  igDiscover: z.boolean().default(false),
});
export type ArchiveInput = z.infer<typeof archiveInputSchema>;

// --- Step executors (re-usable both by workflow and by runArchiveWorkflow) ---
export const scrapeStep = createStep({
  id: "scrape",
  description: "Scrape (or reuse) for platform",
  inputSchema: archiveInputSchema,
  outputSchema: z.object({ pool: z.array(z.any()), candidates: z.array(z.any()), igSources: z.any().optional(), keywords: z.array(z.string()), keywordLabel: z.string() }),
  execute: async ({ inputData }) => {
    const { keywords: rawKeywords, platform, count, pool, rankBy, viewFloor, minLikes, language, country, regions, igHashtags, igAccounts, metaBrands, igDiscover, niche, testMode } = inputData;
    const keywords = [...rawKeywords];
    const keywordLabel = keywords.join(", ");
    const videosPath = `output/videos-${platform}.json`;
    const fullEffort = !testMode && count >= 30;
    const model = DEFAULT_MODEL;
    const ai = makeClient();
    if (inputData.reuse && existsSync(videosPath)) {
      const data = JSON.parse(readFileSync(videosPath, "utf8"));
      const storedPool = (data.pool || data.raw || []).map((v) => v).filter((v) => v.url);
      console.log(`♻️ Reusing last ${platform} scrape: pool ${storedPool.length}`);
      let candidates;
      if (platform === "meta") candidates = rankAds(storedPool, { daysFloor: inputData.metaDaysFloor, count: Number.MAX_SAFE_INTEGER });
      else if (platform === "youtube") { const { rankYoutube } = await import("../tools/scrape-youtube"); candidates = rankYoutube(storedPool, { rankBy, viewFloor: Math.min(viewFloor,5000), count: Number.MAX_SAFE_INTEGER, language }); }
      else candidates = rankVideos(storedPool, { rankBy, viewFloor, count: Number.MAX_SAFE_INTEGER, language });
      return { pool: storedPool, candidates, igSources: data.igSources, keywords: data.keywords || keywords, keywordLabel: data.keyword || keywordLabel };
    }
    const willKeywordSearch = platform === "tiktok" || platform === "youtube" || platform === "twitter" || platform === "pinterest" || platform === "reddit" || (platform === "instagram" && !igHashtags.length && !igAccounts.length && !igDiscover);
    if (fullEffort && willKeywordSearch) {
      const want = Math.max(4, Math.min(12, Math.ceil(count / 12)));
      console.log(`🧠 Widening search: deriving ${want} extra terms...`);
      const extra = await deriveKeywords(keywords, niche || keywordLabel, ai, model, want);
      if (extra.length) { const seen = new Set(keywords.map((k) => k.toLowerCase())); for (const k of extra) if (!seen.has(k)) { keywords.push(k); seen.add(k); } }
    }
    let res = null;
    let igSources;
    if (platform === "instagram") {
      if (igHashtags.length || igAccounts.length) igSources = { hashtags: igHashtags, accounts: igAccounts };
      else if (igDiscover) { console.log(`🧭 Discovering Instagram sources for "${keywordLabel}"...`); igSources = await discoverInstagram(keywords, ai, model); }
      else igSources = { keywords };
      if (!(await confirmDiscovery(igSources))) throw new Error("Instagram scrape cancelled");
      const r = await scrapeInstagram(igSources, { count, pool, newerThan: process.env.IG_NEWER_THAN || "90 days" });
      const ranked = rankVideos(r.pool, { rankBy, viewFloor, count, language });
      res = { pool: r.pool, raw: [], videos: ranked };
    } else if (platform === "meta") {
      const metaCountries = (process.env.META_COUNTRY || country).split(",").map((c) => c.trim()).filter(Boolean);
      let brands = metaBrands;
      if (!brands.length && fullEffort) { console.log("🧠 Deriving Meta brands..."); brands = await deriveBrands(niche || keywordLabel, ai, model); }
      const brandOpts = { count, country: metaCountries[0] || "ALL", perBrandCount: Number(process.env.META_PER_BRAND_COUNT) || 60, idSpendUsd: Number(process.env.META_ID_SPEND) || 0.05, pageSpendUsd: Number(process.env.META_PAGE_SPEND) || 0.4 };
      if (brands.length && keywords.length) {
        const [kwRes, brandRes] = await Promise.all([scrapeMeta(keywords, { count, pool, country: metaCountries }), scrapeMetaBrands(brands, brandOpts)]);
        res = { pool: [...kwRes.pool, ...brandRes.pool], raw: [...(kwRes.raw || []), ...(brandRes.raw || [])] };
      } else if (brands.length) res = await scrapeMetaBrands(brands, brandOpts);
      else res = await scrapeMeta(keywords, { count, pool, country: metaCountries });
    } else if (platform === "youtube") {
      res = await scrapeYoutube(keywords, { count, pool, rankBy, viewFloor: Math.min(viewFloor,5000), language });
    } else if (platform === "twitter") {
      res = await scrapeTwitter(keywords, { count, pool, rankBy, viewFloor: 0 });
    } else if (platform === "pinterest") {
      res = await scrapePinterest(keywords, { count, pool, rankBy });
    } else if (platform === "reddit") {
      res = await scrapeReddit(keywords, { count, pool, rankBy });
    } else if (platform === "linkedin") {
      res = await scrapeLinkedin(keywords, { count, pool });
    } else if (platform === "snapchat") {
      res = await scrapeSnapchat(keywords, { count, pool });
    } else {
      const effectiveRegions = regions?.length ? regions : fullEffort ? ["US","GB","AU","IN","CA"] : [country];
      res = await scrapeTikTok(keywords, { count, pool, rankBy, viewFloor, minLikes, language, country, regions: effectiveRegions });
    }
    const poolData = res.pool;
    let candidates;
    if (platform === "meta") candidates = rankAds(poolData, { daysFloor: inputData.metaDaysFloor, count: Number.MAX_SAFE_INTEGER });
    else if (platform === "youtube") { const { rankYoutube } = await import("../tools/scrape-youtube"); candidates = rankYoutube(poolData, { rankBy, viewFloor: Math.min(viewFloor,5000), count: Number.MAX_SAFE_INTEGER, language }); }
    else candidates = rankVideos(poolData, { rankBy, viewFloor, count: Number.MAX_SAFE_INTEGER, language });
    mkdirSync("output", { recursive: true });
    writeFileSync(videosPath, JSON.stringify({ platform, keyword: keywords.join(", "), keywords, igSources, scrapedAt: new Date().toISOString(), rankBy, viewFloor, videos: res.videos || [], raw: res.raw || [], pool: poolData }, null, 2));
    if (!candidates.length) throw new Error(platform === "meta" ? `No ads running ${inputData.metaDaysFloor}+ days` : "No videos cleared filters");
    return { pool: poolData, candidates, igSources, keywords, keywordLabel: keywords.join(", ") };
  },
});

export const analyzeStep = createStep({
  id: "analyze",
  description: "Tier1 + Tier2 with caching",
  inputSchema: z.object({ scrape: z.any(), params: archiveInputSchema }),
  outputSchema: z.object({ videos: z.array(z.any()), analyses: z.array(z.any()), adaptable: z.array(z.any()), keywordLabel: z.string() }),
  execute: async ({ inputData }) => {
    const { scrape, params } = inputData;
    const { count, nicheFilter, language, viewFloor, metaDaysFloor } = params;
    const platform = params.platform;
    const keywordLabel = scrape.keywordLabel;
    const candidates = scrape.candidates;
    const nicheLabel = nicheFilter === "off" ? "" : (params.niche || process.env.NICHE || keywordLabel);
    const targetLang = (language || "any").toLowerCase();
    const langMap = { en:"english", id:"indonesian", es:"spanish", pt:"portuguese", fr:"french", de:"german", hi:"hindi" };
    const targetLangName = langMap[targetLang] || targetLang;
    const passesLanguage = (a) => {
      if (targetLang === "any") return true;
      const spoken = String(a?.spoken_language || "").trim().toLowerCase();
      if (!spoken || spoken === "none") return true;
      return spoken.startsWith(targetLangName) || targetLangName.startsWith(spoken);
    };
    const passesNiche = (a) => {
      if (nicheFilter === "off") return true;
      const m = String(a?.niche_match || "").trim().toLowerCase();
      if (!m) return true;
      return nicheFilter === "loose" ? m !== "off" : m === "core";
    };
    const cache = loadCache();
    const cacheValidLocal = (id) => cacheValid(cache[id]) && (nicheFilter === "off" || cache[id]?.niche_for === nicheLabel);
    const adaptableFloor = params.adaptableFloor ?? viewFloor;
    const deepCount = params.deepCount ?? 8;
    const model = DEFAULT_MODEL;
    const ai = makeClient();
    console.log(`🏊 Candidate pool: ${candidates.length} (target ${count})`);
    let screened = candidates;
    if (nicheFilter !== "off") {
      const unjudged = candidates.filter((v) => !cacheValidLocal(v.id));
      if (unjudged.length) {
        console.log(`📋 Pre-screening ${unjudged.length} captions...`);
        try {
          const verdicts = await prescreenCaptions(unjudged, nicheLabel, ai, model, targetLangName);
          const dropIds = new Set([...verdicts].filter(([, verd]) => verd === "unlikely").map(([id]) => id));
          screened = candidates.filter((v) => !dropIds.has(v.id));
          console.log(`   Dropped ${dropIds.size} off-category.`);
        } catch (err) { console.log(`   ⚠️ prescreen failed: ${err.message}`); }
      }
    }
    const okVideos = []; const okAnalyses = []; const adaptableVideos = []; const adaptableAnalyses = [];
    const considerAdaptable = (v, a) => {
      if (String(a?.niche_match || "").toLowerCase() !== "adjacent") return false;
      if (platform === "meta") { if ((v.daysRunning ?? 0) < metaDaysFloor) return false; }
      else if (v.views < adaptableFloor) return false;
      adaptableVideos.push(v); adaptableAnalyses.push(a); return true;
    };
    const CONCURRENCY = Number(process.env.ANALYZE_CONCURRENCY) || (isVertex() ? 6 : 3);
    const effortCap = Math.max(count * 6, 60);
    for (let w = 0; w < screened.length; w += CONCURRENCY) {
      if (okVideos.length >= count) break;
      if (w >= effortCap) { console.log(`🧮 Sifted ${w} candidates — filling from adaptable`); break; }
      const wave = screened.slice(w, w + CONCURRENCY);
      console.log(`🎬 Analyzing ${wave.length} in parallel (${okVideos.length}/${count} core)...`);
      const results = await Promise.all(wave.map(async (v) => {
        const cached = cache[v.id];
        if (cacheValid(cached) && (nicheFilter === "off" || cached?.niche_for === nicheLabel)) return { v, analysis: cached, fromCache: true };
        try {
          const analysis = await withTimeout(analyzeVideo(v, ai, model, { tier: 1, niche: nicheLabel }), Number(process.env.ANALYZE_TIMEOUT_MS) || 180_000);
          if (cacheValid(cached) && Array.isArray(cached.script) && cached.script.length) { analysis.script = cached.script; analysis.duration_seconds = cached.duration_seconds; analysis.analysis_tier = "2"; }
          return { v, analysis, fromCache: false };
        } catch (err) { return { v, error: err.message }; }
      }));
      let newlyAnalyzed = 0;
      for (const r of results) if (r.analysis && !r.fromCache) { cache[r.v.id] = r.analysis; newlyAnalyzed++; }
      if (newlyAnalyzed) saveCache(cache);
      for (const r of results) {
        if (okVideos.length >= count) break;
        if (r.error) continue;
        const { v, analysis } = r;
        if (!passesLanguage(analysis)) continue;
        if (!passesNiche(analysis)) { considerAdaptable(v, analysis); continue; }
        okVideos.push(v); okAnalyses.push(analysis);
      }
    }
    console.log(`✅ Tier 1 done: ${okVideos.length}/${count}`);
    const deepTargets = okVideos.slice(0, Math.min(deepCount, okVideos.length));
    console.log(`🔬 Deep pass: top ${deepTargets.length} winners`);
    for (let i = 0; i < deepTargets.length; i++) {
      const v = deepTargets[i]; const idx = okVideos.indexOf(v);
      if (tierOf(okAnalyses[idx]) === "2") { console.log(`✔ already deep @${v.author}`); continue; }
      console.log(`🎬 [deep ${i+1}/${deepTargets.length}] @${v.author}...`);
      try { const deep = await withTimeout(analyzeVideo(v, ai, model, { tier: 2, niche: nicheLabel }), Number(process.env.ANALYZE_TIMEOUT_MS) || 180_000); cache[v.id] = deep; saveCache(cache); okAnalyses[idx] = deep; } catch (err) { console.log(`   ⚠️ deep failed: ${err.message}`); }
    }
    const adaptableSlots = Math.max(0, count - okVideos.length);
    const adaptable = adaptableVideos.map((v, i) => ({ video: v, analysis: adaptableAnalyses[i] })).sort((a,b) => platform === "meta" ? (b.video.daysRunning ?? 0) - (a.video.daysRunning ?? 0) : b.video.views - a.video.views).slice(0, adaptableSlots);
    const allVids = [...okVideos, ...adaptable.map((x) => x.video)];
    const allAns = [...okAnalyses, ...adaptable.map((x) => x.analysis)];
    return { videos: allVids, analyses: allAns, adaptable: [], keywordLabel };
  },
});

export const synthesizeStep = createStep({
  id: "synthesize",
  description: "Synthesize patterns and persist",
  inputSchema: z.object({ analysis: z.any(), params: archiveInputSchema }),
  outputSchema: z.object({ reportPath: z.string(), patterns: z.any().nullable(), videos: z.array(z.any()), analyses: z.array(z.any()) }),
  execute: async ({ inputData }) => {
    const { analysis, params } = inputData;
    const { videos, analyses, keywordLabel } = analysis;
    const platform = params.platform;
    const minSynth = params.minSynth ?? 5;
    const ai = makeClient(); const model = DEFAULT_MODEL;
    let patterns = null;
    if (videos.length >= minSynth) { console.log(`🧠 Synthesizing patterns across ${videos.length} videos...`); patterns = await synthesize(keywordLabel, videos, analyses, ai, model); writeFileSync(`output/patterns-${platform}.json`, JSON.stringify(patterns, null, 2)); }
    else console.log(`🧠 Only ${videos.length} videos — skipping synthesis (needs ${minSynth}+)`);
    const reportJson = { keyword: keywordLabel, platform, videos, analyses, patterns, meta: { rankBy: params.rankBy, date: new Date().toISOString().slice(0,10), platform } };
    writeFileSync(`output/report-${platform}.json`, JSON.stringify(reportJson, null, 2));
    // Legacy HTML emitted by archive; JSON is primary (skip dynamic import to avoid bundling warning)
    // try { const { buildReport } = await import("../../report.js"); buildReport(keywordLabel, videos, analyses, patterns, { rankBy: params.rankBy, platform, date: new Date().toISOString().slice(0,10), outPath: `output/report-${platform}.html` }, [], null); } catch {}
    return { reportPath: `output/report-${platform}.json`, patterns, videos, analyses };
  },
});

// Minimal workflow wrapper for `mastra dev` UI — actual execution goes via runArchiveWorkflow()
export const archiveWorkflow = createWorkflow({
  id: "archive-workflow",
  description: "Full Archive pipeline: scrape → analyze → synthesize (see runArchiveWorkflow for manual orchestration)",
  inputSchema: archiveInputSchema,
  outputSchema: z.object({ reportPath: z.string(), patterns: z.any().nullable() }),
}).then(scrapeStep).commit();

export async function runArchiveWorkflow(input) {
  await trackEvent("run_started", { platform: input.platform });
  const scrapeResult = await scrapeStep.execute({ inputData: input, runId: "local", mastra: undefined });
  const analyzeResult = await analyzeStep.execute({ inputData: { scrape: scrapeResult, params: input }, runId: "local", mastra: undefined });
  const synthResult = await synthesizeStep.execute({ inputData: { analysis: analyzeResult, params: input }, runId: "local", mastra: undefined });
  await trackEvent("report_generated", { platform: input.platform, referenceCount: analyzeResult.videos.length, patternsGenerated: synthResult.patterns !== null, activation: analyzeResult.videos.length === input.count && synthResult.patterns !== null });
  return { reportPath: synthResult.reportPath };
}
