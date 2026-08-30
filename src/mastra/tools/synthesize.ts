// @ts-nocheck
// src/mastra/tools/synthesize.ts — Mastra tool for pattern synthesis
// Ports src/synthesize.js: deterministic closed tallies + AI clustering.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Type } from "@google/genai";
import { makeClient, DEFAULT_MODEL } from "../lib/genai";
import type { Video, Analysis, Patterns } from "../../lib/types";

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

function tallyClosed(analyses: Analysis[], field: keyof Analysis, videos: Video[], labelPrefix = "V") {
  const buckets = new Map<string, { value: string; count: number; evidence: string[] }>();
  analyses.forEach((a, i) => {
    if (!a) return;
    const raw = String((a[field] as string) ?? "").trim();
    if (!raw || raw.toLowerCase() === "none") return;
    const key = raw.toLowerCase();
    if (!buckets.has(key)) buckets.set(key, { value: raw, count: 0, evidence: [] });
    const b = buckets.get(key)!; b.count += 1; b.evidence.push(`${labelPrefix}${i + 1}`);
  });
  return [...buckets.values()].sort((a, b) => b.count - a.count);
}
function tallyMultiClosed(analyses: Analysis[], field: keyof Analysis, labelPrefix = "V") {
  const buckets = new Map<string, { value: string; count: number; evidence: string[] }>();
  analyses.forEach((a, i) => {
    if (!a || !Array.isArray(a[field])) return;
    for (const raw of a[field] as string[]) {
      const key = String(raw || "").trim().toLowerCase();
      if (!key || key === "none") continue;
      if (!buckets.has(key)) buckets.set(key, { value: String(raw).trim(), count: 0, evidence: [] });
      const b = buckets.get(key)!; b.count += 1; if (!b.evidence.includes(`${labelPrefix}${i+1}`)) b.evidence.push(`${labelPrefix}${i+1}`);
    }
  });
  return [...buckets.values()].sort((a, b) => b.count - a.count);
}

const CLUSTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clusters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          description: { type: Type.STRING },
          members: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, verbatim: { type: Type.STRING } }, required: ["label","verbatim"] },
          },
        },
        required: ["theme","description","members"],
      },
    },
  },
  required: ["clusters"],
};

const OTHER_PATTERNS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clusters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          description: { type: Type.STRING },
          placement: { type: Type.STRING },
          members: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, verbatim: { type: Type.STRING } }, required: ["label","verbatim"] },
          },
        },
        required: ["theme","description","placement","members"],
      },
    },
  },
  required: ["clusters"],
};

async function clusterFreeForm(dimensionName: string, items: { label: string; verbatim: string }[], ai: ReturnType<typeof makeClient>, model: string) {
  const usable = items.filter((it) => it.verbatim && String(it.verbatim).trim().toLowerCase() !== "none");
  if (!usable.length) return [];
  const prompt = `You are grouping ${usable.length} short-form video ${dimensionName} entries into CLUSTERS BY MEANING. Two entries belong together only if a strategist would call them "same pattern".\nSTRICT: every entry exactly ONE cluster; singletons become their own cluster but are dropped as not-pattern.\nFor each cluster: theme (2-6 words), description, ALL members verbatim (exact copy), sorted largest first.\nEntries:\n${JSON.stringify(usable, null, 2)}`;
  const res = await generateWithRetry(ai, { model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: CLUSTER_SCHEMA } }) as { text: string };
  const parsed = JSON.parse(res.text);
  const clusters = (parsed.clusters || []).map((c: Record<string, unknown>) => ({ theme: c.theme, description: c.description, count: (c.members as unknown[] || []).length, members: c.members || [] }));
  clusters.sort((a: { count: number }, b: { count: number }) => b.count - a.count);
  return clusters.filter((c: { count: number }) => c.count >= 2);
}

async function findOtherPatterns(analyses: Analysis[], videos: Video[], ai: ReturnType<typeof makeClient>, model: string, labelPrefix = "V") {
  const payload = analyses.map((a, i) => {
    const v = videos[i] || {} as Video;
    return {
      label: `${labelPrefix}${i+1}`,
      author: `@${v.author}`,
      views: v.views,
      caption: (v.caption || "").slice(0,220),
      hook: a?.hook,
      hook_type: a?.hook_type,
      format: a?.format,
      visual_style: a?.visual_style,
      broll_ratio: a?.broll_ratio,
      tone: a?.tone,
      pacing: a?.pacing,
      recurring_text_overlay: a?.recurring_text_overlay,
      persuasion_tactics: a?.persuasion_tactics,
      target_audience: a?.target_audience,
      script: (a?.script || []).slice(0,8),
    };
  });
  const prompt = `You already have closed taxonomies for hook/format/tone/visual_style/broll/pacing/angle/persuasion.\nFind OTHER PATTERNS that REPEAT across these winning videos that we did NOT categorize.\nExamples: creator archetype, filming setting, framing tricks, character types, product-placement style, opening/closing rituals, music genre, background elements, color palettes, transition tricks.\nDO NOT return baseline generic patterns ("creator on camera talking about product" etc.) — only genuinely informative.\nFor each pattern specify placement: "hook"|"body"|"cta"|"throughout". Return 2-6 patterns with theme, description, placement, members (verbatim quote per video). If nothing recurs ≥2, return [].\nPer-video data:\n${JSON.stringify(payload, null, 2)}`;
  const res = await generateWithRetry(ai, { model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: OTHER_PATTERNS_SCHEMA } }) as { text: string };
  const parsed = JSON.parse(res.text);
  const clusters = (parsed.clusters || []).map((c: Record<string, unknown>) => ({ theme: c.theme, description: c.description, placement: (c.placement as string) || "throughout", count: (c.members as unknown[] || []).length, members: c.members || [] }));
  clusters.sort((a: { count: number }, b: { count: number }) => b.count - a.count);
  return clusters.filter((c: { count: number }) => c.count >= 2);
}

export async function synthesize(keyword: string, videos: Video[], analyses: Analysis[], ai: ReturnType<typeof makeClient>, model: string, opts: { labelPrefix?: string } = {}): Promise<Patterns> {
  const labelPrefix = opts.labelPrefix || "V";
  console.log("   Counting closed taxonomies (deterministic, no AI)...");
  const closed = {
    format: tallyClosed(analyses, "format", videos, labelPrefix),
    hook_type: tallyClosed(analyses, "hook_type", videos, labelPrefix),
    tone: tallyClosed(analyses, "tone", videos, labelPrefix),
    visual_style: tallyClosed(analyses, "visual_style", videos, labelPrefix),
    broll_ratio: tallyClosed(analyses, "broll_ratio", videos, labelPrefix),
    pacing: tallyClosed(analyses, "pacing", videos, labelPrefix),
    angle: tallyClosed(analyses, "angle", videos, labelPrefix),
    persuasion_tactics: tallyMultiClosed(analyses, "persuasion_tactics", labelPrefix),
  };
  const hookVisualItems = analyses.map((a, i) => ({ label: `${labelPrefix}${i+1}`, verbatim: a?.hook?.visual }));
  const hookSpokenItems = analyses.map((a, i) => ({ label: `${labelPrefix}${i+1}`, verbatim: a?.hook?.spoken }));
  const hookTextItems = analyses.map((a, i) => ({ label: `${labelPrefix}${i+1}`, verbatim: a?.hook?.on_screen_text }));
  console.log("   Clustering hook visuals...");
  const hookVisual = await clusterFreeForm("hook visual (first 3 seconds)", hookVisualItems, ai, model);
  console.log("   Clustering hook spoken lines...");
  const hookSpoken = await clusterFreeForm("hook spoken line (first 3 seconds)", hookSpokenItems, ai, model);
  console.log("   Clustering hook on-screen text...");
  const hookText = await clusterFreeForm("hook on-screen text (first 3 seconds)", hookTextItems, ai, model);
  console.log("   Finding OTHER patterns...");
  const otherPatterns = await findOtherPatterns(analyses, videos, ai, model, labelPrefix);
  return { keyword, total_videos_analyzed: videos.length, closed, hookVisual, hookSpoken, hookText, otherPatterns };
}

export const synthesizeTool = createTool({
  id: "synthesize-patterns",
  description: "Turn per-video analyses into pattern tables: deterministic closed counts + AI clustering for hooks and emergent patterns.",
  inputSchema: z.object({
    keyword: z.string(),
    videos: z.array(z.any()),
    analyses: z.array(z.any()),
    model: z.string().default(DEFAULT_MODEL),
    labelPrefix: z.string().default("V"),
  }),
  outputSchema: z.object({ patterns: z.any() }),
  execute: async ({ context }) => {
    const ai = makeClient();
    const patterns = await synthesize(context.keyword, context.videos as Video[], context.analyses as Analysis[], ai, context.model, { labelPrefix: context.labelPrefix });
    return { patterns };
  },
});
