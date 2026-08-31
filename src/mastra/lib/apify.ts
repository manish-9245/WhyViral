// src/mastra/lib/apify.ts — Backwards-compat shim
// This file is kept so existing imports (`import { runActor } from "../lib/apify"`) keep working.
// Canonical implementation now lives in src/mastra/lib/scraper.ts (Crawlee open-source provider
// with Apify fallback). All logic is re-exported here.
//
// To go fully open-source: set SCRAPER_PROVIDER=crawlee in .env — then APIFY_TOKEN is optional.

export {
  apifyTokens,
  currentToken,
  currentClient,
  tokenCount,
  isQuotaError,
  runActor,
  getScraperProvider,
  isApifyConfigured,
  isCrawleeEnabled,
  describeProvider,
  estimateApifyCostUsd,
  isLocalProviderActive,
} from "./scraper";
