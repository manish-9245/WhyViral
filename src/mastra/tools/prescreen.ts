// src/mastra/tools/prescreen.ts — caption pre-screen (Mastra tool)
// Ports src/prescreen.js — one batched text call to filter clearly off-brief captions.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Type } from "@google/genai";
import { makeClient, DEFAULT_MODEL } from "../lib/genai";
import type { Video } from "../../lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isTransient(err: unknown): boolean {
  const msg = String((err as Error)?.message || "").toLowerCase();
  const causeMsg = String(((err as Record<string, unknown>)?.cause as Record<string,unknown>)?.message || ((err as Record<string,unknown>)?.cause as Record<string,string>)?.code || "").toLowerCase();
  const combined = msg + " " + causeMsg;
  return combined.includes("503") || combined.includes("unavailable") || combined.includes("high demand") || combined.includes("fetch failed") || combined.includes("etimedout") || combined.includes("econnreset") || combined.includes("socket hang up") || combined.includes("network");
}
async function generateWithRetry(ai: ReturnType<typeof makeClient>, params: Record<string, unknown>, tries = 12) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try { return await (ai.models as unknown as { generateContent: (p: unknown) => Promise<{ text: string }> }).generateContent(params as never); } catch (err) { if (isTransient(err) && attempt < tries) { await sleep(Math.min(attempt * 5000, 30000)); continue; } throw err; }
  }
}
const PRESCREEN_SCHEMA = {
  type: Type.OBJECT,
  properties: { verdicts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { n: { type: Type.NUMBER }, verdict: { type: Type.STRING } }, required: ["n","verdict"] } } },
  required: ["verdicts"],
};

export async function prescreenCaptions(videos: Video[], niche: string, ai: ReturnType<typeof makeClient>, model: string, language = "any"): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const BATCH = 80;
  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH);
    const payload = batch.map((v, j) => ({ n: j, author: String(v.author || "").slice(0,40), caption: String(v.caption || "").slice(0,300) }));
    const languageRule = language && language !== "any" ? `- "unlikely" also applies if caption's MAIN text is clearly not ${language}.\n` : "";
    const prompt = `A strategist is collecting reference videos for content that SELLS this product: "${niche}".\nBelow are ${batch.length} captions. For each, verdict "unlikely" if CLEARLY different product category or not product content at all. Same-category different segment is NOT "unlikely". When in doubt "possible". Empty/vague → "possible".\n${languageRule}Return one verdict per caption using its "n".\nCaptions:\n${JSON.stringify(payload, null, 1)}`;
    const res = await generateWithRetry(ai, { model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: PRESCREEN_SCHEMA } }) as { text: string };
    const parsed = JSON.parse(res.text);
    for (const { n, verdict } of parsed.verdicts || []) { const v = batch[Number(n)]; if (!v) continue; result.set(v.id as string, String(verdict||"").trim().toLowerCase()==="unlikely"?"unlikely":"possible"); }
    for (const v of batch) if (!result.has(v.id as string)) result.set(v.id as string, "possible");
  }
  return result;
}

export const prescreenTool = createTool({
  id: "prescreen-captions",
  description: "Cheap batched caption screening to drop clearly off-brief videos before video analysis.",
  inputSchema: z.object({
    videos: z.array(z.any()),
    niche: z.string(),
    language: z.string().default("any"),
    model: z.string().default(DEFAULT_MODEL),
  }),
  outputSchema: z.object({ verdicts: z.record(z.string()) }),
  execute: async ({ context }) => {
    const ai = makeClient();
    const map = await prescreenCaptions(context.videos as Video[], context.niche, ai, context.model, context.language);
    return { verdicts: Object.fromEntries(map) };
  },
});
