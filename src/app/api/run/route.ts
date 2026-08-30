// src/app/api/run/route.ts — Next.js API route that streams Mastra workflow execution
// Mastra workflow = scrape → analyze → synthesize; streamed as NDJSON so the UI can tail logs.

import { NextRequest } from "next/server";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { scrapeTikTok, rankVideos } from "@/mastra/tools/scrape-tiktok";
import { scrapeInstagram } from "@/mastra/tools/scrape-instagram";
import { scrapeMeta, scrapeMetaBrands } from "@/mastra/tools/scrape-meta";
import { discoverInstagram, confirmDiscovery } from "@/mastra/tools/discover-instagram";
import { deriveBrands, deriveKeywords } from "@/mastra/tools/derive";
import { prescreenCaptions } from "@/mastra/tools/prescreen";
import { analyzeVideo } from "@/mastra/tools/analyze-video";
import { synthesize } from "@/mastra/tools/synthesize";
import { makeClient, isVertex } from "@/mastra/lib/genai";
import { loadCache, saveCache, cacheValid, tierOf } from "@/mastra/lib/cache";
import { trackEvent } from "@/mastra/lib/telemetry";
import { loadState, saveState, newState, nextStage, type RunState, type Stage, STAGES } from "@/mastra/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600; // run can take up to 1h (Vercel limit 300s on hobby; self-hosted no limit)

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`timed out after ${Math.round(ms/1000)}s`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

// Translate raw provider errors into customer-facing copy with retry advice.
function friendlyError(err: unknown, stage: "scrape" | "watch" | "synth" | "prescreen" | "discover"): { message: string; advice: string; severity: "warn" | "block" } {
  const raw = String((err as Error)?.message || err || "");
  const lower = raw.toLowerCase();
  if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
    return {
      message: "AI is rate-limited right now.",
      advice: "Free tier caps at 20 requests/day on gemini-3.5-flash. Wait ~1 min, or switch to a paid key in Settings. Re-running will reuse cached videos — no extra cost.",
      severity: "warn",
    };
  }
  if (lower.includes("api key") || lower.includes("401") || lower.includes("403") || lower.includes("permission")) {
    return {
      message: "API key missing or invalid.",
      advice: "Open Settings and paste a fresh APIFY_TOKEN + GEMINI_API_KEY, then Check Connections.",
      severity: "block",
    };
  }
  if (lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("network")) {
    return { message: "Network unreachable.", advice: "Check your connection — WhyViral runs locally and needs outbound HTTPS to Apify + Google.", severity: "block" };
  }
  if (lower.includes("timed out")) {
    return { message: `${stage} took too long.`, advice: "A video stalled — likely a large file. Try a smaller target count, or re-run to skip cached ones.", severity: "warn" };
  }
  return { message: `${stage} failed.`, advice: raw.length < 240 ? raw : raw.slice(0, 200) + "…", severity: "warn" };
}

// ── Pipeline stage helpers ─────────────────────────────────────────────────────

function getLangName(language: string): string {
  const langMap: Record<string, string> = { en: "english", id: "indonesian", es: "spanish", pt: "portuguese", fr: "french", de: "german", hi: "hindi" };
  return langMap[language] || language;
}

function checkLanguage(a: import("@/lib/types").Analysis, targetLangName: string): boolean {
  if (!targetLangName || targetLangName === "any") return true;
  const spoken = String((a as unknown as Record<string, string>)?.spoken_language || "").trim().toLowerCase();
  if (!spoken || spoken === "none") return true;
  return spoken.startsWith(targetLangName) || targetLangName.startsWith(spoken);
}

function checkNiche(a: import("@/lib/types").Analysis, nicheFilter: string): boolean {
  if (nicheFilter === "off") return true;
  const m = String((a as unknown as Record<string, string>)?.niche_match || "").trim().toLowerCase();
  if (!m) return true;
  return nicheFilter === "loose" ? m !== "off" : m === "core";
}

async function runScrape(
  platform: string,
  runKw: string[],
  body: Record<string, unknown>,
  opts: { count: number; pool: number; rankBy: string; viewFloor: number; minLikes: number; language: string; country: string; fullEffort: boolean }
): Promise<[import("@/lib/types").Video[], Record<string, unknown> | undefined]> {
  const { count, pool, rankBy, viewFloor, minLikes, language, country, fullEffort } = opts;
  if (platform === "instagram") {
    let igSources: Record<string, unknown> = { keywords: runKw };
    if ((Array.isArray(body.igHashtags) && body.igHashtags.length) || (Array.isArray(body.igAccounts) && body.igAccounts.length)) igSources = { hashtags: body.igHashtags, accounts: body.igAccounts };
    else if (body.igDiscover) igSources = await discoverInstagram(runKw, makeClient(), process.env.GEMINI_MODEL || "gemini-3.5-flash");
    if (!(await confirmDiscovery(igSources as never))) throw new Error("Scrape cancelled.");
    const res = await scrapeInstagram(igSources as never, { count, pool, newerThan: process.env.IG_NEWER_THAN || "90 days" });
    return [res.pool, igSources];
  } else if (platform === "meta") {
    const metaCountries = (process.env.META_COUNTRY || country).split(",").map((c) => c.trim()).filter(Boolean);
    let brands: string[] = (body.metaBrands as string[]) || [];
    if (!brands.length && fullEffort) brands = await deriveBrands(body.niche as string || runKw.join(", "), makeClient(), process.env.GEMINI_MODEL || "gemini-3.5-flash");
    if (brands.length && runKw.length) {
      const [kwRes, brandRes] = await Promise.all([scrapeMeta(runKw, { count, pool, country: metaCountries }), scrapeMetaBrands(brands, { count, country: metaCountries[0] || "ALL" })]);
      return [[...kwRes.pool, ...brandRes.pool], undefined];
    } else if (brands.length) {
      const r = await scrapeMetaBrands(brands, { count, country: metaCountries[0] || "ALL" });
      return [r.pool, undefined];
    } else {
      const r = await scrapeMeta(runKw, { count, pool, country: metaCountries });
      return [r.pool, undefined];
    }
  } else {
    const regions = (body.regions as string[]) || (fullEffort ? ["US", "GB", "AU", "IN", "CA"] : [country]);
    const r = await scrapeTikTok(runKw, { count, pool, rankBy, viewFloor, minLikes, language, country, regions });
    return [r.pool, undefined];
  }
}

async function buildCandidates(platform: string, fullPool: import("@/lib/types").Video[], opts: { rankBy: string; viewFloor: number; language: string; metaDaysFloor: number }): Promise<import("@/lib/types").Video[]> {
  if (platform === "meta") return (await import("@/mastra/tools/scrape-meta")).rankAds(fullPool, { daysFloor: opts.metaDaysFloor, count: Number.MAX_SAFE_INTEGER });
  return rankVideos(fullPool, { rankBy: opts.rankBy, viewFloor: opts.viewFloor, count: Number.MAX_SAFE_INTEGER, language: opts.language });
}

async function runWatch(opts: {
  platform: string; screened: import("@/lib/types").Video[]; count: number;
  cache: Record<string, unknown>; nicheFilter: string; nicheLabel: string;
  ai: ReturnType<typeof import("@/mastra/lib/genai").makeClient>; model: string;
  passesLanguage: (a: import("@/lib/types").Analysis) => boolean;
  passesNiche: (a: import("@/lib/types").Analysis) => boolean;
  adaptableFloor: number; metaDaysFloor: number;
  cacheValid: (e: unknown) => boolean;
  send: (o: unknown) => void; log: (m: string) => void;
  fullEffort: boolean; concurrency: number;
}): Promise<{ okVideos: import("@/lib/types").Video[]; okAnalyses: import("@/lib/types").Analysis[]; adaptableVideos: import("@/lib/types").Video[]; adaptableAnalyses: import("@/lib/types").Analysis[]; totalCacheHits: number }> {
  const { platform, screened, count, cache, nicheFilter, nicheLabel, ai, model, passesLanguage, passesNiche, adaptableFloor, metaDaysFloor, cacheValid, send, log, concurrency } = opts;
  const okVideos: import("@/lib/types").Video[] = [];
  const okAnalyses: import("@/lib/types").Analysis[] = [];
  const adaptableVideos: import("@/lib/types").Video[] = [];
  const adaptableAnalyses: import("@/lib/types").Analysis[] = [];
  const considerAdaptable = (v: import("@/lib/types").Video, a: import("@/lib/types").Analysis) => {
    if (String((a as unknown as Record<string, string>)?.niche_match || "").toLowerCase() !== "adjacent") return false;
    if (platform === "meta") { if ((v.daysRunning ?? 0) < metaDaysFloor) return false; }
    else if (v.views < adaptableFloor) return false;
    adaptableVideos.push(v); adaptableAnalyses.push(a); return true;
  };
  const effortCap = Math.max(count * 6, 60);
  let totalCacheHits = 0;
  for (let w = 0; w < screened.length; w += concurrency) {
    if (okVideos.length >= count) { log(`\n🧮 Reached ${count} core — done Tier 1.`); break; }
    if (w >= effortCap) { log(`\n🧮 Sifted ${w} candidates — filling from adaptable.`); break; }
    const wave = screened.slice(w, w + concurrency);
    log(`\n🎬 Analyzing ${wave.length} in parallel (${okVideos.length}/${count} core)...`);
    const results = await Promise.all(wave.map(async (v) => {
      const cached = cache[v.id as string];
      if (cacheValid(cached) && (nicheFilter === "off" || (cached as unknown as Record<string, string>)?.niche_for === nicheLabel)) return { v, analysis: cached as unknown as import("@/lib/types").Analysis, fromCache: true as const };
      try {
        const analysis = await withTimeout(analyzeVideo(v, ai, model, { tier: 1, niche: nicheLabel }), Number(process.env.ANALYZE_TIMEOUT_MS) || 180_000);
        const cachedHasScript = cacheValid(cached) && Array.isArray((cached as unknown as Record<string, unknown>).script) && ((cached as unknown as Record<string, unknown>).script as unknown[]).length;
        if (cachedHasScript) {
          (analysis as unknown as Record<string, unknown>).script = (cached as unknown as Record<string, unknown>).script;
          (analysis as unknown as Record<string, unknown>).duration_seconds = (cached as unknown as Record<string, unknown>).duration_seconds;
          (analysis as unknown as Record<string, unknown>).analysis_tier = "2";
        }
        return { v, analysis, fromCache: false as const };
      } catch (e) {
        const fe = friendlyError(e, "watch");
        log(`   ⚠️ ${fe.message} — ${fe.advice}`);
        send({ type: "warn", stage: "watch", severity: fe.severity, message: fe.message, advice: fe.advice });
        return { v, error: fe.message };
      }
    }));
    let newlyAnalyzed = 0;
    for (const r of results as Array<{ v: import("@/lib/types").Video; analysis?: import("@/lib/types").Analysis; fromCache?: boolean }>) {
      if (r.analysis && !r.fromCache) { (cache as Record<string, unknown>)[r.v.id as string] = r.analysis; newlyAnalyzed++; }
      if (r.fromCache) totalCacheHits++;
    }
    if (newlyAnalyzed) saveCache(cache);
    for (const r of results as Array<{ v: import("@/lib/types").Video; analysis?: import("@/lib/types").Analysis; fromCache?: boolean; error?: string }>) {
      if (okVideos.length >= count) break;
      if (r.error) { log(`   ✗ skipped @${r.v.author} (${r.error})`); continue; }
      const { v, analysis } = r as { v: import("@/lib/types").Video; analysis: import("@/lib/types").Analysis };
      if (!passesLanguage(analysis)) { log(`   🌐 dropped @${v.author} (${(analysis as unknown as Record<string, string>).spoken_language})`); continue; }
      if (!passesNiche(analysis)) { const kept = considerAdaptable(v, analysis); log(`   🎯 dropped @${v.author} (${(analysis as unknown as Record<string, string>).primary_topic || (analysis as unknown as Record<string, string>).niche_match})${kept ? " → adaptable" : ""}`); continue; }
      log(`   ✔ ${r.fromCache ? "cached" : "analyzed"} @${v.author} → slot ${okVideos.length + 1}/${count}`);
      okVideos.push(v); okAnalyses.push(analysis);
    }
  }
  log(`\n✅ Tier 1 done: ${okVideos.length}/${count}`);
  return { okVideos, okAnalyses, adaptableVideos, adaptableAnalyses, totalCacheHits };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const keywords: string[] = body.keywords?.length ? body.keywords : ["magnesium gummies"];
  const platformFlag: string = (body.platform || "tiktok").toLowerCase();
  const count: number = Number(body.count) || Number(process.env.VIDEO_COUNT) || 5;
  const resumeMode: boolean = !!body.resume;
  const clearBeforeRun: boolean = !!body.clearState;
  const runStage: Stage | null = STAGES.includes(body.stage as Stage) ? (body.stage as Stage) : null;
  const platforms = platformFlag === "all" ? ["tiktok","instagram","meta"] as const : [platformFlag as "tiktok"|"instagram"|"meta"];

  const rankBy = process.env.RANK_BY || "engagement";
  const viewFloor = Number(process.env.VIEW_FLOOR) || 100_000;
  const minLikes = Number(process.env.MIN_LIKES) || 0;
  const language = process.env.LANGUAGE || "en";
  const country = process.env.COUNTRY || "US";
  const nicheFilter = (process.env.NICHE_FILTER || "strict").toLowerCase();
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const ai = makeClient();
  const deepCount = process.env.DEEP_COUNT !== undefined ? Number(process.env.DEEP_COUNT) : 8;
  const metaDaysFloor = Number(process.env.META_DAYS_FLOOR) || 30;
  const minSynth = Number(process.env.SYNTH_MIN) || 5;
  const adaptableFloor = Number(process.env.ADAPTABLE_VIEW_FLOOR) || viewFloor;
  const isTestMode = !!body.testMode;
  const pool = Number(process.env.SCRAPE_POOL) || (isTestMode ? 60 : Math.min(1500, Math.max(count * 12, 300)));
  const fullEffort = !isTestMode && count >= 30;
  const CONCURRENCY = Number(process.env.ANALYZE_CONCURRENCY) || (isVertex() ? 6 : 3);

  mkdirSync("output", { recursive: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const log = (msg: string) => send({ type: "log", message: msg });

      // Mirror logs to output/last-run.log
      const logStream = createWriteStream("output/last-run.log", { flags: "w" });
      const origLog = console.log.bind(console);
      const origErr = console.error.bind(console);
      const patchedLog = (...a: unknown[]) => { origLog(...a); log(a.join(" ")); logStream.write(String(a.join(" ")) + "\n"); };
      const patchedErr = (...a: unknown[]) => { origErr(...a); logStream.write(String(a.join(" ")) + "\n"); };
      console.log = patchedLog as never;
      console.error = patchedErr as never;

      const reports: string[] = [];
      const cache = loadCache();

      try {
        for (const platform of platforms) {
          // Compute runKeywords (with auto-widening for full runs)
          let runKeywords = [...keywords];
          const willKeywordSearch = platform === "tiktok" || (platform === "instagram" && !(Array.isArray(body.igHashtags) && body.igHashtags.length) && !(Array.isArray(body.igAccounts) && body.igAccounts.length));
          if (fullEffort && willKeywordSearch) {
            const want = Math.max(4, Math.min(12, Math.ceil(count / 12)));
            log(`🧠 Widening search: deriving ${want} extra terms...`);
            const extra = await deriveKeywords(runKeywords, body.niche || keywords.join(", "), ai, model, want);
            if (extra.length) {
              const seen = new Set(runKeywords.map((k) => k.toLowerCase()));
              for (const k of extra) if (!seen.has(k)) { runKeywords.push(k); seen.add(k); }
              log(`   Now searching ${runKeywords.length} terms: ${runKeywords.join(", ")}`);
            }
          }

          // ── Pipeline state management ────────────────────────────────────
          const existingState = clearBeforeRun ? null : loadState(platform);
          const config = { count, pool, rankBy, language, country, nicheLabel: nicheFilter === "off" ? "" : (body.niche || process.env.NICHE || keywords.join(", ")), keywords: runKeywords };

          let state: RunState;
          if (runStage) {
            // Stage-specific run: start fresh state (or load existing for context)
            state = existingState && existingState.keyword === keywords.join(", ") ? existingState : newState(platform, config);
            state = { ...state, lastCompleted: null, failedAt: null, failureReason: null, scrape: null, prescreen: null, watch: null, deep: null, synth: null };
            log(`\n${"═".repeat(48)}\n▶ ${platform.toUpperCase()} — running stage: ${runStage}\n${"═".repeat(48)}`);
          } else if (resumeMode && existingState && existingState.keyword === keywords.join(", ")) {
            // Resume: continue from where it stopped
            state = existingState;
            const resumeFrom = nextStage(state);
            state.failedAt = null;
            state.failureReason = null;
            log(`\n${"═".repeat(48)}\n▶ ${platform.toUpperCase()} — resuming from: ${resumeFrom}\n${"═".repeat(48)}`);
          } else {
            // Full run: fresh state
            state = newState(platform, config);
            log(`\n${"═".repeat(48)}\n▶ ${platform.toUpperCase()} leg\n${"═".repeat(48)}`);
          }
          saveState(state);

          const emitState = () => {
            send({ type: "state", platform, lastCompleted: state.lastCompleted, failedAt: state.failedAt });
          };

          const complete = (stage: Stage) => {
            state.lastCompleted = stage;
            state.failedAt = null;
            state.failureReason = null;
            saveState(state);
            emitState();
          };

          const fail = (stage: Stage, reason: string) => {
            state.failedAt = stage;
            state.failureReason = reason.slice(0, 240);
            saveState(state);
            emitState();
          };

          await trackEvent("run_started", { platform });

          // ── Stage 1: Scrape ───────────────────────────────────────────────
          if (runStage && STAGES.indexOf(runStage) > 0) {
            log(`⏭  Skipping scrape (using cached: ${state.scrape?.poolSize ?? 0} videos)`);
          } else if (runStage === "scrape" || (!runStage && !state.scrape)) {
            try {
              const [fullPool, igSourcesOut] = await runScrape(platform, runKeywords, body, { count, pool, rankBy, viewFloor, minLikes, language, country, fullEffort });
              state.scrape = { videos: fullPool, poolSize: fullPool.length, igSources: igSourcesOut };
              complete("scrape");
            } catch (e) {
              const fe = friendlyError(e, "scrape");
              log(`❌ Scrape failed: ${fe.message} — ${fe.advice}`);
              send({ type: "warn", stage: "scrape", severity: fe.severity, message: fe.message, advice: fe.advice });
              fail("scrape", fe.message);
              await trackEvent("run_failed", { platform, errorStage: "scrape" });
              continue;
            }
          } else {
            log(`⏭  Scrape already complete (${state.scrape?.poolSize ?? 0} videos in state)`);
            complete("scrape");
          }

          const fullPool = state.scrape?.videos ?? [];
          const igSourcesOut = state.scrape?.igSources;
          const candidates = await buildCandidates(platform, fullPool, { rankBy, viewFloor, language, metaDaysFloor });
          if (!candidates.length) { log(platform === "meta" ? `No ads running ${metaDaysFloor}+ days.` : "No videos cleared filters."); await trackEvent("run_failed", { platform, errorStage: "no_qualified_candidates" }); continue; }
          log(`🏊 Candidate pool: ${candidates.length} (target ${count})`);

          const nicheLabel = nicheFilter === "off" ? "" : (body.niche || process.env.NICHE || runKeywords.join(", "));
          const targetLangName = getLangName(language);
          const passesLanguage = (a: import("@/lib/types").Analysis) => checkLanguage(a, targetLangName);
          const passesNiche = (a: import("@/lib/types").Analysis) => checkNiche(a, nicheFilter);

          // ── Stage 2: Prescreen ──────────────────────────────────────────
          if (runStage && STAGES.indexOf(runStage) > 1) {
            log(`⏭  Skipping prescreen`);
          } else if (runStage === "prescreen" || (!runStage && !state.prescreen)) {
            let screened = candidates;
            if (nicheFilter !== "off") {
              const unjudged = candidates.filter((v) => !(cacheValid(cache[v.id as string]) && ((cache[v.id as string] as unknown as Record<string,string>)?.niche_for === nicheLabel || nicheFilter === "off")));
              if (unjudged.length) {
                log(`📋 Pre-screening ${unjudged.length} captions...`);
                try {
                  const verdicts = await prescreenCaptions(unjudged, nicheLabel, ai, model, targetLangName);
                  const dropIds = new Set([...verdicts].filter(([, verd]) => verd === "unlikely").map(([id]) => id));
                  screened = candidates.filter((v) => !dropIds.has(v.id as string));
                  log(`   Dropped ${dropIds.size} off-category.`);
                } catch (e) { log(`   ⚠️ prescreen failed: ${(e as Error).message}`); send({ type: "warn", stage: "prescreen", severity: "warn", message: "Prescreen skipped — videos accepted by default.", advice: (e as Error).message }); }
              }
            }
            state.prescreen = { videoIds: screened.map((v) => v.id as string) };
            complete("prescreen");
          } else {
            log(`⏭  Prescreen already complete (${state.prescreen?.videoIds.length ?? 0} candidates)`);
            complete("prescreen");
          }

          const screenedIds = new Set(state.prescreen?.videoIds ?? candidates.map((v) => v.id as string));
          const screened = candidates.filter((v) => screenedIds.has(v.id as string));

          // ── Stage 3: Watch ──────────────────────────────────────────────
          if (runStage && STAGES.indexOf(runStage) > 2) {
            log(`⏭  Skipping watch`);
          } else {
            const { okVideos, okAnalyses, adaptableVideos, adaptableAnalyses, totalCacheHits } = await runWatch({
              platform, screened, count, cache, nicheFilter, nicheLabel, ai, model, passesLanguage, passesNiche, adaptableFloor, metaDaysFloor, cacheValid, send, log, fullEffort, concurrency: CONCURRENCY,
            });
            state.watch = { ok: okVideos.map((v, i) => ({ video: v, analysis: okAnalyses[i] })), adaptable: adaptableVideos.map((v, i) => ({ video: v, analysis: adaptableAnalyses[i] })) };
            complete("watch");
          }

          const okVideos = state.watch?.ok.map((x) => x.video) ?? [];
          const okAnalyses = state.watch?.ok.map((x) => x.analysis) ?? [];
          const adaptableVideos = state.watch?.adaptable.map((x) => x.video) ?? [];
          const adaptableAnalyses = state.watch?.adaptable.map((x) => x.analysis) ?? [];

          // ── Stage 4: Deep ───────────────────────────────────────────────
          if (runStage && STAGES.indexOf(runStage) > 3) {
            log(`⏭  Skipping deep pass`);
          } else if (runStage === "deep" || (!runStage && !state.deep)) {
            const tier2Ids: string[] = [];
            const deepTargets = okVideos.slice(0, Math.min(deepCount, okVideos.length));
            log(`\n🔬 Deep pass: top ${deepTargets.length} winners`);
            for (let i = 0; i < deepTargets.length; i++) {
              const v = deepTargets[i];
              const idx = okVideos.indexOf(v);
              if (tierOf(okAnalyses[idx]) === "2") { log(`✔ already deep @${v.author}`); tier2Ids.push(v.id as string); continue; }
              log(`🎬 [deep ${i+1}/${deepTargets.length}] @${v.author}...`);
              try {
                const deep = await withTimeout(analyzeVideo(v, ai, model, { tier: 2, niche: nicheLabel }), Number(process.env.ANALYZE_TIMEOUT_MS) || 180_000);
                (cache as Record<string, unknown>)[v.id as string] = deep;
                saveCache(cache);
                okAnalyses[idx] = deep;
                tier2Ids.push(v.id as string);
                log(`   done — ${deep.script?.length || 0} rows`);
              } catch (e) { const fe = friendlyError(e, "watch"); log(`   ⚠️ ${fe.message} — ${fe.advice}`); send({ type: "warn", stage: "deep", severity: "warn", message: fe.message, advice: fe.advice }); }
            }
            state.deep = { tier2Ids };
            complete("deep");
          } else {
            log(`⏭  Deep pass already complete (${state.deep?.tier2Ids.length ?? 0} winners)`);
            complete("deep");
          }

          // ── Stage 5: Synthesize ─────────────────────────────────────────
          const adaptableSlots = Math.max(0, count - okVideos.length);
          const adaptable = adaptableVideos.map((v, i) => ({ video: v, analysis: adaptableAnalyses[i] })).sort((a, b) => platform === "meta" ? (b.video.daysRunning ?? 0) - (a.video.daysRunning ?? 0) : b.video.views - a.video.views).slice(0, adaptableSlots);
          const allVids = [...okVideos, ...adaptable.map((x) => x.video)];
          const allAns = [...okAnalyses, ...adaptable.map((x) => x.analysis)];

          if (runStage === "synth" || (!runStage && !state.synth)) {
            let patterns: import("@/lib/types").Patterns | null = null;
            if (allVids.length >= minSynth) {
              log(`\n🧠 Synthesizing patterns across ${allVids.length} videos...`);
              patterns = await synthesize(keywords.join(", "), allVids, allAns, ai, model);
              const { writeFileSync } = await import("node:fs");
              writeFileSync(`output/patterns-${platform}.json`, JSON.stringify(patterns, null, 2));
            } else {
              log(`\n🧠 Only ${allVids.length} videos — skipping synthesis (needs ${minSynth}+)`);
            }
            state.synth = { patterns };
            complete("synth");
          } else {
            log(`⏭  Synthesis already complete`);
            complete("synth");
          }

          // ── Write report ────────────────────────────────────────────────
          const patterns = state.synth?.patterns;
          const reportJson = { keyword: keywords.join(", "), platform, videos: allVids, analyses: allAns, patterns, meta: { rankBy, date: new Date().toISOString().slice(0, 10), platform } };
          const { writeFileSync } = await import("node:fs");
          writeFileSync(`output/report-${platform}.json`, JSON.stringify(reportJson, null, 2));
          writeFileSync(`output/videos-${platform}.json`, JSON.stringify({ platform, keyword: keywords.join(", "), keywords: runKeywords, igSources: igSourcesOut, scrapedAt: new Date().toISOString(), rankBy, viewFloor, videos: allVids, raw: [], pool: fullPool }, null, 2));

          // ── Live cost ──────────────────────────────────────────────────
          const deepActuallyRan = (state.deep?.tier2Ids?.length ?? 0);
          const cacheHits = state.watch?.ok.filter((x) => false).length ?? 0; // approximate
          send({ type: "cost", platform, pool: fullPool.length, apifyUsd: Number((fullPool.length * 0.0026).toFixed(2)), tier1Calls: okVideos.length, tier1Inr: Math.round(okVideos.length * 2.5), tier2Calls: deepActuallyRan, tier2Inr: Math.round(deepActuallyRan * 10), synthRan: !!patterns, synthInr: patterns ? 18 : 0, cacheHits: 0 });

          await trackEvent("report_generated", { platform, referenceCount: allVids.length, patternsGenerated: patterns !== null, activation: allVids.length === count && patterns !== null });
          reports.push(`output/report-${platform}.json`);
          log(`\n✅ ${platform} done → output/report-${platform}.json`);
        }

        send({ type: "done", reports });
      } catch (e) {
        const fe = friendlyError(e, "watch");
        send({ type: "error", severity: fe.severity, message: fe.message, advice: fe.advice });
        send({ type: "log", message: `❌ ${fe.message} — ${fe.advice}` });
        send({ type: "done", reports: [] });
      } finally {
        console.log = origLog as never;
        console.error = origErr as never;
        logStream.end();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
}
