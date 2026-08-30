// src/mastra/tools/discover-instagram.ts — Instagram hashtag/account discovery

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Type } from "@google/genai";
import { makeClient, DEFAULT_MODEL } from "../lib/genai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isTransient(err: unknown): boolean {
  const msg = String((err as Error)?.message || "").toLowerCase();
  const causeMsg = String(((err as Record<string, unknown>)?.cause as Record<string,unknown>)?.message || ((err as Record<string,unknown>)?.cause as Record<string,string>)?.code || "").toLowerCase();
  const combined = msg + " " + causeMsg;
  return combined.includes("503") || combined.includes("unavailable") || combined.includes("high demand") || combined.includes("fetch failed") || combined.includes("etimedout") || combined.includes("econnreset") || combined.includes("socket hang up") || combined.includes("network");
}
async function generateWithRetry(ai: ReturnType<typeof makeClient>, params: Record<string, unknown>, tries = 12) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try { return await (ai.models as unknown as { generateContent: (p: unknown) => Promise<{ text: string }> }).generateContent(params as never); } catch (err) { if (isTransient(err) && attempt < tries) { await sleep(Math.min(attempt*5000,30000)); continue; } throw err; }
  }
}
const DISCOVERY_SCHEMA = { type: Type.OBJECT, properties: { hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }, accounts: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["hashtags","accounts"] };

export async function discoverInstagram(keywords: string | string[], ai: ReturnType<typeof makeClient>, model: string): Promise<{ hashtags: string[]; accounts: string[] }> {
  const label = Array.isArray(keywords) ? keywords.join(", ") : keywords;
  const prompt = `Given niche keyword: "${label}"\nReturn 10 most active Instagram HASHTAGS (lowercase, no "#", no branded) and 5 most influential CREATOR ACCOUNTS (public, not brand, no "@").`;
  const res = await generateWithRetry(ai, { model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: DISCOVERY_SCHEMA } }) as { text: string };
  const parsed = JSON.parse(res.text);
  const clean = (arr: string[], ch: string) => (arr || []).map((s) => String(s).trim().replace(new RegExp(`^${ch}`), "")).filter(Boolean);
  return { hashtags: clean(parsed.hashtags, "#"), accounts: clean(parsed.accounts, "@") };
}

export async function confirmDiscovery(sources: { keywords?: string[]; hashtags?: string[]; accounts?: string[] }): Promise<boolean> {
  console.log(`\n🧭 Instagram sources:`);
  if (sources.keywords?.length) console.log(`   Keywords: ${sources.keywords.map((k) => `"${k}"`).join("  ")}`);
  if (sources.hashtags?.length || !sources.keywords?.length) console.log(`   Hashtags: ${sources.hashtags?.map((h) => "#" + h).join("  ") || "(none)"}`);
  if (sources.accounts?.length || !sources.keywords?.length) console.log(`   Accounts: ${sources.accounts?.map((a) => "@" + a).join("  ") || "(none)"}`);
  if (String(process.env.INTERACTIVE || "").toLowerCase() !== "true") return true;
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("   Scrape these? [y/n] ")).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

export const discoverInstagramTool = createTool({
  id: "discover-instagram",
  description: "Ask Gemini for relevant Instagram hashtags + creator accounts for a niche.",
  inputSchema: z.object({ keywords: z.array(z.string()).min(1), model: z.string().default(DEFAULT_MODEL) }),
  outputSchema: z.object({ hashtags: z.array(z.string()), accounts: z.array(z.string()) }),
  execute: async ({ context }) => { const ai = makeClient(); return discoverInstagram(context.keywords, ai, context.model); },
});
