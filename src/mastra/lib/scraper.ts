// src/mastra/lib/scraper.ts — Unified scraper provider
// Open-source replacement for Apify. Crawlee (https://crawlee.dev) is the OSS engine
// that powers Apify cloud — this module makes it the default while keeping Apify
// as an optional fallback during migration.
//
// Provider selection via env SCRAPER_PROVIDER:
//   - "crawlee" → always use local Crawlee/fetch scrapers (zero cost, self-hosted)
//   - "apify"   → always use hosted Apify Actors (requires APIFY_TOKEN)
//   - "auto"    → try Crawlee first, fall back to Apify on failure (default)
// Set SCRAPER_PROVIDER=crawlee to go fully open-source.
// Docs: docs/scraper-provider.md

import { ApifyClient } from "apify-client";

// ---------------------------------------------------------------------------
// Apify compatibility helpers (kept so existing .env keeps working)
// ---------------------------------------------------------------------------
export function apifyTokens(): string[] {
  return String(process.env.APIFY_TOKEN || "")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

let idx = 0;

export function currentToken(): string {
  const tokens = apifyTokens();
  if (!tokens.length) return "";
  return tokens[Math.min(idx, tokens.length - 1)];
}

export function currentClient() {
  return new ApifyClient({ token: currentToken() });
}

export function tokenCount(): number {
  return apifyTokens().length;
}

export function isQuotaError(err: unknown): boolean {
  const msg = String(((err as Record<string, unknown>)?.message as string) || err || "").toLowerCase();
  return (
    msg.includes("monthly usage hard limit") ||
    msg.includes("usage hard limit") ||
    msg.includes("hard limit exceeded") ||
    msg.includes("monthly usage") ||
    msg.includes("quota") ||
    msg.includes("payment required") ||
    msg.includes("402") ||
    msg.includes("insufficient credit") ||
    (msg.includes("not enough") && msg.includes("credit"))
  );
}

// ---------------------------------------------------------------------------
// Provider abstraction
// ---------------------------------------------------------------------------
export type ScraperProviderName = "apify" | "crawlee" | "auto";

export function getScraperProvider(): ScraperProviderName {
  const raw = String(process.env.SCRAPER_PROVIDER || "auto").toLowerCase().trim();
  if (raw === "apify" || raw === "crawlee" || raw === "auto") return raw as ScraperProviderName;
  return "auto";
}

export function isApifyConfigured(): boolean {
  return apifyTokens().length > 0;
}

export function isCrawleeEnabled(): boolean {
  return getScraperProvider() !== "apify";
}

export function describeProvider(): string {
  const p = getScraperProvider();
  if (p === "apify") return "apify (hosted)";
  if (p === "crawlee") return "crawlee (open-source, local)";
  return isApifyConfigured() ? "auto → crawlee (primary) + apify (fallback)" : "crawlee (open-source, local)";
}

// ---------------------------------------------------------------------------
// Apify runner (hosted) — unchanged semantics
// ---------------------------------------------------------------------------
async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  callOpts: Record<string, unknown> = {}
): Promise<{ items: Record<string, unknown>[]; run: { defaultDatasetId: string } }> {
  const tokens = apifyTokens();
  if (!tokens.length) throw new Error("No APIFY_TOKEN found in your .env file.");
  let lastErr: unknown;
  while (idx < tokens.length) {
    const apify = new ApifyClient({ token: tokens[idx] });
    try {
      const run = await apify.actor(actorId).call(input, callOpts as never);
      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      return { items: items as Record<string, unknown>[], run };
    } catch (err) {
      lastErr = err;
      const hasNext = idx < tokens.length - 1;
      if (isQuotaError(err) && hasNext) {
        console.log(`   🔑 Apify key #${idx + 1} out of credit — switching to key #${idx + 2}...`);
        idx += 1;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Crawlee runner (open-source, local) — maps Apify actor IDs to local crawlers
// ---------------------------------------------------------------------------
async function runCrawleeActor(
  actorId: string,
  input: Record<string, unknown>,
  _callOpts: Record<string, unknown> = {}
): Promise<{ items: Record<string, unknown>[]; run: { defaultDatasetId: string } }> {
  // Lazy import providers to keep startup fast and allow fetch-only fallback
  // when crawlee/playwright are not yet installed.
  const useVerbose = String(process.env.CRAWLEE_VERBOSE || "").toLowerCase() === "true";
  if (useVerbose) console.log(`   🕷️  Crawlee routing actor ${actorId}`);

  // TikTok
  if (actorId === "scraptik/tiktok-api" || actorId === "clockworks/tiktok-scraper") {
    const { runTikTokCrawlee } = await import("./providers/crawlee-tiktok");
    const items = await runTikTokCrawlee(actorId, input);
    return { items, run: { defaultDatasetId: `local-crawlee-${Date.now()}` } };
  }
  // Instagram
  if (
    actorId === "apify/instagram-hashtag-scraper" ||
    actorId === "apify/instagram-reel-scraper" ||
    actorId === "patient_discovery/instagram-search-reels"
  ) {
    const { runInstagramCrawlee } = await import("./providers/crawlee-instagram");
    const items = await runInstagramCrawlee(actorId, input);
    return { items, run: { defaultDatasetId: `local-crawlee-${Date.now()}` } };
  }
  // Meta Ad Library
  if (actorId === "curious_coder/facebook-ads-library-scraper") {
    const { runMetaCrawlee } = await import("./providers/crawlee-meta");
    const items = await runMetaCrawlee(actorId, input);
    return { items, run: { defaultDatasetId: `local-crawlee-${Date.now()}` } };
  }
  // TikTok video resolver (used in analyze-video fallback)
  if (actorId === "happy_b/tiktok-video-scraper") {
    const { runTikTokResolverCrawlee } = await import("./providers/crawlee-tiktok");
    const items = await runTikTokResolverCrawlee(actorId, input);
    return { items, run: { defaultDatasetId: `local-crawlee-${Date.now()}` } };
  }

  throw new Error(`Crawlee provider has no local implementation for actor "${actorId}" yet. Set SCRAPER_PROVIDER=apify for this actor or contribute a local crawler in src/mastra/lib/providers/.`);
}

// ---------------------------------------------------------------------------
// Unified entry point — used by all scrape tools
// ---------------------------------------------------------------------------
export async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  callOpts: Record<string, unknown> = {}
): Promise<{ items: Record<string, unknown>[]; run: { defaultDatasetId: string } }> {
  const provider = getScraperProvider();

  if (provider === "apify") {
    return runApifyActor(actorId, input, callOpts);
  }
  if (provider === "crawlee") {
    try {
      return await runCrawleeActor(actorId, input, callOpts);
    } catch (err) {
      // No fallback when explicitly set to crawlee — surface the error with guidance
      const msg = (err as Error)?.message || String(err);
      throw new Error(`[crawlee] ${msg} — check CRAWLEE_* env and that 'npm install' + 'npx playwright install' have been run. Set SCRAPER_PROVIDER=auto to fallback to Apify.`);
    }
  }
  // auto: try crawlee, fallback to apify
  try {
    return await runCrawleeActor(actorId, input, callOpts);
  } catch (crawleeErr) {
    if (!isApifyConfigured()) throw crawleeErr;
    console.log(`   ⚠️  Crawlee route failed for ${actorId} (${(crawleeErr as Error)?.message?.slice(0, 120)}) — falling back to Apify...`);
    return runApifyActor(actorId, input, callOpts);
  }
}

// ---------------------------------------------------------------------------
// Cost helper — Crawlee runs are free (self-hosted), Apify charges per run
// ---------------------------------------------------------------------------
export function estimateApifyCostUsd(poolSize: number): number {
  if (getScraperProvider() === "crawlee") return 0;
  // Apify pricing ~ $0.0026 per video scraped (legacy estimate); Crawlee is $0
  return Number((poolSize * 0.0026).toFixed(2));
}

export function isLocalProviderActive(): boolean {
  const p = getScraperProvider();
  return p === "crawlee" || (p === "auto" && true); // auto always tries crawlee first
}
