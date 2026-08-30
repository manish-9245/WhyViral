// src/mastra/tools/derive.ts — deriveBrands + deriveKeywords as Mastra tools

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { makeClient, DEFAULT_MODEL } from "../lib/genai";

export async function deriveBrands(niche: string, ai: ReturnType<typeof makeClient>, model: string, n = 8): Promise<string[]> {
  const prompt = `List ${n} real, well-known brands that SELL and actively run Facebook/Instagram video ads for this exact product: "${niche}".\nRules:\n- Only brands that genuinely sell THIS product, not adjacent.\n- Prefer DTC brands that advertise heavily.\n- Return ONLY JSON array of brand-name strings.\nExample: ["Brand A","Brand B"]`;
  try {
    const res = await (ai.models as unknown as { generateContent: (p: unknown) => Promise<{ text: string }> }).generateContent({ model, contents: prompt } as never);
    const text = (res.text || "").trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === "string" && (x as string).trim()).map((x: string) => x.trim()).slice(0, n) : [];
  } catch { return []; }
}

export async function deriveKeywords(seedKeywords: string | string[], niche: string, ai: ReturnType<typeof makeClient>, model: string, n = 8): Promise<string[]> {
  const seeds = (Array.isArray(seedKeywords) ? seedKeywords : [seedKeywords]).filter(Boolean).join(", ");
  const nicheLine = niche && niche.trim() ? niche.trim() : seeds;
  const prompt = `I am scraping TikTok/Instagram for TOP videos about ONE product niche.\nSeed keyword(s): "${seeds}"\nNiche: "${nicheLine}"\nGive me ${n} ADDITIONAL search terms real people type for THIS SAME product niche.\nRules: stay strictly on niche, include popular brands, 1-3 words, lowercase, no hashtags, do NOT repeat seeds, ONLY JSON array.`;
  try {
    const res = await (ai.models as unknown as { generateContent: (p: unknown) => Promise<{ text: string }> }).generateContent({ model, contents: prompt } as never);
    const text = (res.text || "").trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    const seedSet = new Set((Array.isArray(seedKeywords) ? seedKeywords : [seedKeywords]).map((s) => String(s).trim().toLowerCase()));
    const seen = new Set<string>();
    return arr.filter((x: unknown) => typeof x === "string" && (x as string).trim()).map((x: string) => x.trim().toLowerCase()).filter((x: string) => !seedSet.has(x) && !seen.has(x) && seen.add(x)).slice(0, n);
  } catch { return []; }
}

export const deriveBrandsTool = createTool({
  id: "derive-brands",
  description: "Derive real brands for Meta brand-first scraping given a niche.",
  inputSchema: z.object({ niche: z.string(), count: z.number().default(8), model: z.string().default(DEFAULT_MODEL) }),
  outputSchema: z.object({ brands: z.array(z.string()) }),
  execute: async ({ context }) => { const ai = makeClient(); return { brands: await deriveBrands(context.niche, ai, context.model, context.count) }; },
});

export const deriveKeywordsTool = createTool({
  id: "derive-keywords",
  description: "Derive additional on-niche search terms to widen the scrape net.",
  inputSchema: z.object({ seedKeywords: z.array(z.string()), niche: z.string(), count: z.number().default(8), model: z.string().default(DEFAULT_MODEL) }),
  outputSchema: z.object({ keywords: z.array(z.string()) }),
  execute: async ({ context }) => { const ai = makeClient(); return { keywords: await deriveKeywords(context.seedKeywords, context.niche, ai, context.model, context.count) }; },
});
