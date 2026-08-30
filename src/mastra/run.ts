#!/usr/bin/env node
// src/mastra/run.ts — CLI entrypoint that runs the Mastra archive workflow
// Usage: tsx src/mastra/run.ts "keyword" --platform=tiktok --count=5
// Keeps parity with archive flags but goes through the typed workflow.

import "dotenv/config";
import { runArchiveWorkflow } from "./workflows/archive-workflow";

const args = process.argv.slice(2);
const flagValue = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
};
const hasFlag = (name: string) => args.includes(`--${name}`);
const keywords = args.filter((a) => !a.startsWith("--"));
const keywordList = keywords.length ? keywords : ["magnesium gummies"];
const platform = (flagValue("platform") || "tiktok").toLowerCase() as "tiktok" | "instagram" | "meta";
const count = hasFlag("test") ? 3 : Number(process.env.VIDEO_COUNT) || 5;

const input = {
  keywords: keywordList,
  platform,
  count,
  pool: Number(process.env.SCRAPE_POOL) || undefined,
  rankBy: process.env.RANK_BY || "engagement",
  viewFloor: Number(process.env.VIEW_FLOOR) || 100_000,
  minLikes: Number(process.env.MIN_LIKES) || 0,
  language: process.env.LANGUAGE || "en",
  country: process.env.COUNTRY || "US",
  niche: flagValue("niche") || process.env.NICHE || keywordList.join(", "),
  nicheFilter: (flagValue("niche-filter") || process.env.NICHE_FILTER || "strict").toLowerCase(),
  metaDaysFloor: Number(process.env.META_DAYS_FLOOR) || 30,
  minSynth: Number(process.env.SYNTH_MIN) || 5,
  deepCount: Number(process.env.DEEP_COUNT) || 8,
  reuse: hasFlag("reuse"),
  igHashtags: flagValue("ig-hashtags") ? flagValue("ig-hashtags").split(",").map((s) => s.trim().replace(/^#/, "")) : [],
  igAccounts: flagValue("ig-accounts") ? flagValue("ig-accounts").split(",").map((s) => s.trim().replace(/^@/, "")) : [],
  metaBrands: flagValue("brands") ? flagValue("brands").split(",").map((s) => s.trim()) : [],
  testMode: hasFlag("test"),
  igDiscover: hasFlag("ig-discover"),
} as never;

console.log(`\n▶ Mastra workflow: ${platform} — "${keywordList.join(", ")}" (target ${count})`);
const result = await runArchiveWorkflow(input);
console.log(`\n✅ Done → ${result.reportPath}`);
