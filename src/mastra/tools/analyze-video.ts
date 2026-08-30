// @ts-nocheck
// src/mastra/tools/analyze-video.ts — Mastra tool for Gemini video watching
// Ports src/analyze.js logic into a typed tool + shared helpers.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { GoogleGenAI, createUserContent, createPartFromUri, Type } from "@google/genai";
import { runActor, currentToken } from "../lib/apify";
import { isVertex, adcToken, makeClient, DEFAULT_MODEL } from "../lib/genai";
import type { Video, Analysis } from "../../lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RUBRIC_INTRO = `You are a short-form video content strategist. Watch this short-form video
(visuals AND audio) and break it down the way a strategist studying what makes content win would,
NOT the way a film critic would. Be concrete and specific to THIS video. If something is not
present, say "none". Fill in every field.

The hook (first 3 seconds) is by far the most important part of a short-form video. We
break it into 3 SEPARATE layers because each is authored independently by the creator:

- hook.visual: one-line, concrete description of what is ON SCREEN in the first 3 seconds
  (e.g. "extreme close-up of gel lathering on wet hand", "split-screen before/after face",
  "creator on camera holding the bottle to the lens", "text overlay on plain background, no face").
- hook.spoken: the EXACT words SPOKEN out loud in the first 3 seconds. If nothing is spoken,
  say "none". Do NOT include on-screen text here.
- hook.on_screen_text: the EXACT text shown ON SCREEN as an overlay in the first 3 seconds
  (all caps, punctuation, emojis kept). If there is no on-screen text, say "none". Do NOT
  include the caption below the video.

Other fields:
- hook_type: quick label for the hook technique. Choose the closest: "problem callout",
  "bold claim", "social proof", "pattern interrupt", "question", "before/after", "authority",
  "urgency", or a short custom label if none fit.
- format: the overall SHAPE of the video. Choose ONE from this taxonomy (or a short custom
  label if truly none fit): "before-after", "problem-solution", "listicle", "tutorial",
  "yap", "product-demo", "transformation", "comparison", "react-stitch",
  "storytime", "education", "myth-bust", "grwm-routine", "testimonial", "unboxing".
  "yap" = the creator is essentially just talking to camera about the product / topic —
  monologue-style, no comparative review, no ingredient breakdown, no tutorial. Pick "yap"
  whenever the video is mostly a talking-head with the creator's opinion or recommendation.
- visual_style: e.g. "talking head", "voiceover + b-roll", "text-on-screen montage", "skit",
  "green screen / stitch", "product demo", "GRWM".
- broll_ratio: how the video is composed throughout. Choose ONE: "mostly-talking-head",
  "balanced" (roughly 50/50), "mostly-broll" (voiceover with cutaways / product shots).
- tone: the creator's voice/register. Choose ONE (or a short custom label): "gen-z-casual",
  "warm-friendly", "professional-authoritative", "hyped-urgent", "calm-educational",
  "science-expert", "sarcastic-humor".
- pacing: overall cut/edit tempo. Choose ONE: "fast-cut", "medium", "slow".
- recurring_text_overlay: any distinctive text-overlay motif that appears MORE THAN ONCE
  throughout the video (not the hook overlay). Verbatim if possible, or "none".
- angle: the core content angle / narrative (e.g. "ingredient education", "myth busting",
  "honest review", "routine", "transformation", "curiosity gap").
- persuasion_tactics: which of these appear: social proof, scarcity, urgency, authority,
  emotional trigger, problem-solution, risk reversal, specificity, relatability.
- target_audience: who this speaks to (demographics + mindset + awareness level).`;

const RUBRIC_DEEP = `- duration_seconds: approximate total length of the video in whole seconds (integer as string).
- script: THE MOST IMPORTANT ADDITION. A row-by-row aligned breakdown of the ENTIRE video.
  One row per spoken line (or per silent beat if there is no speech for a while). Each row
  has three fields SHOWING WHAT HAPPENED AT THE SAME MOMENT:
    * spoken: the exact spoken line, verbatim. Use "none" if the beat is silent.
    * on_screen_text: the exact text overlay visible AT THIS MOMENT (verbatim, keep caps,
      punctuation, emojis). If the same overlay persists across multiple rows, REPEAT IT
      in every row where it is still visible — never say "same as above". "none" if absent.
    * visual: a concrete one-line description of what is on screen at this moment
      (framing, subject, product, action). No interpretation, no adjectives about
      "aesthetic". Just what a viewer sees.
  Rules for this table:
    * Do NOT invent lines. If audio is unclear, write "[unclear]" for that spoken cell.
    * Do NOT summarize. Every spoken line becomes its own row, verbatim.
    * If the video has no speech at all, produce one row per distinct visual beat (roughly
      every 2-4 seconds) with spoken="none".`;

const RUBRIC_TAIL = `- key_claims: the main claims or selling points made.
- cta: the call to action, if any.
- why_it_works: one or two sentences on the single biggest reason this video holds attention.
- spoken_language: the main language actually SPOKEN in the video, e.g. "English",
  "Indonesian". Judge by the audio itself, not by the caption or the on-screen text.
  Be strict: if speech is mixed, name the DOMINANT spoken language.
- schema_version: always the string "4".`;

const nicheRelevanceBlock = (niche: string) => `REFERENCE RELEVANCE (judge this carefully — listen to the full audio,
read all on-screen text, and look at what is physically shown):
This research is collecting reference videos for a creative strategist who is making content
to SELL this product: "${niche}".
- primary_topic: one line — what this video is ACTUALLY about and what it is selling, if
  anything (e.g. "selling an acne-clearing foam cleanser", "ranking face washes for dry skin",
  "face-washing technique education, no product sold", "sunscreen myths"). Judge by the
  video's content itself, never by hashtags.
- niche_match: exactly ONE of:
  * "core" — a strategist could adapt this video's approach almost directly: it sells,
    reviews, demos, ranks, or recommends the SAME product type aimed at the SAME customer
    problem / benefit as the product above. Both must match — the product category AND the
    positioning (the skin concern, the promised benefit, the buyer it speaks to).
  * "adjacent" — same product category but a DIFFERENT customer problem or benefit segment
    (e.g. an acne / oily-skin cleanser when the product sells hydration for dry skin), OR
    the category appears but nothing is being sold or recommended (pure technique/education,
    general routines).
  * "off" — a different product category or topic entirely.
Be strict on BOTH tests. A video can be excellent content and still be "adjacent" — the
question is only whether it helps sell THIS product, not whether it is good.`;

function buildPrompt(tier: number, niche: string): string {
  const parts = [RUBRIC_INTRO];
  if (niche) parts.push(nicheRelevanceBlock(niche));
  if (tier === 2) parts.push(RUBRIC_DEEP);
  parts.push(RUBRIC_TAIL);
  return parts.join("\n");
}

const TIER1_PROPERTIES = {
  hook: {
    type: Type.OBJECT,
    properties: {
      visual: { type: Type.STRING },
      spoken: { type: Type.STRING },
      on_screen_text: { type: Type.STRING },
    },
    required: ["visual", "spoken", "on_screen_text"],
  },
  hook_type: { type: Type.STRING },
  format: { type: Type.STRING },
  visual_style: { type: Type.STRING },
  broll_ratio: { type: Type.STRING },
  tone: { type: Type.STRING },
  pacing: { type: Type.STRING },
  recurring_text_overlay: { type: Type.STRING },
  angle: { type: Type.STRING },
  persuasion_tactics: { type: Type.ARRAY, items: { type: Type.STRING } },
  target_audience: { type: Type.STRING },
  primary_topic: { type: Type.STRING },
  niche_match: { type: Type.STRING },
  key_claims: { type: Type.ARRAY, items: { type: Type.STRING } },
  cta: { type: Type.STRING },
  why_it_works: { type: Type.STRING },
  spoken_language: { type: Type.STRING },
  schema_version: { type: Type.STRING },
};

const TIER1_REQUIRED = [
  "hook", "hook_type", "format", "visual_style", "broll_ratio", "tone", "pacing",
  "recurring_text_overlay", "angle", "persuasion_tactics", "target_audience",
  "primary_topic", "niche_match", "key_claims", "cta", "why_it_works", "spoken_language", "schema_version",
];

const TIER1_SCHEMA = { type: Type.OBJECT, properties: TIER1_PROPERTIES, required: TIER1_REQUIRED };
const TIER2_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ...TIER1_PROPERTIES,
    duration_seconds: { type: Type.STRING },
    script: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          spoken: { type: Type.STRING },
          on_screen_text: { type: Type.STRING },
          visual: { type: Type.STRING },
        },
        required: ["spoken", "on_screen_text", "visual"],
      },
    },
  },
  required: [...TIER1_REQUIRED, "duration_seconds", "script"],
};

async function downloadVideo(url: string, destPath: string): Promise<number> {
  let fetchUrl = url;
  if (url.includes("api.apify.com") && currentToken()) {
    fetchUrl += (url.includes("?") ? "&" : "?") + `token=${currentToken()}`;
  }
  const isIG = /cdninstagram|fbcdn|instagram\.com/i.test(fetchUrl);
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Referer: isIG ? "https://www.instagram.com/" : "https://www.tiktok.com/",
  };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(fetchUrl, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(destPath, buf);
      return buf.length;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error(`could not download video (${(lastErr as Error)?.message || "failed"})`);
}

function isTransient(err: unknown): boolean {
  const msg = String((err as Error)?.message || "").toLowerCase();
  const causeMsg = String(((err as Record<string, unknown>)?.cause as Record<string, unknown>)?.message || ((err as Record<string, unknown>)?.cause as Record<string,string>)?.code || "").toLowerCase();
  const combined = msg + " " + causeMsg;
  return combined.includes("503") || combined.includes("unavailable") || combined.includes("high demand") || combined.includes("fetch failed") || combined.includes("etimedout") || combined.includes("econnreset") || combined.includes("socket hang up") || combined.includes("network");
}

async function generateWithRetry(ai: GoogleGenAI, params: Record<string, unknown>, tries = 12) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await (ai.models as unknown as { generateContent: (p: unknown) => Promise<unknown> }).generateContent(params as never);
    } catch (err) {
      if (isTransient(err) && attempt < tries) {
        const wait = Math.min(attempt * 5000, 30000);
        const reason = String(((err as Record<string, unknown>)?.cause as Record<string,string>)?.code || (err as Error)?.message || "transient").slice(0, 60);
        console.log(`   (retry ${attempt}/${tries} in ${wait / 1000}s — ${reason})`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

async function resolveShopPlayUrl(pageUrl: string): Promise<string> {
  if (!currentToken() || !pageUrl) return "";
  const { items } = await runActor("happy_b/tiktok-video-scraper", { videoUrls: [pageUrl] } as Record<string, unknown>);
  const v = (items[0] as Record<string, string>) || {};
  return v.videoPlayUrl || v.videoDownloadNoWatermarkUrl || v.videoDownloadUrl || "";
}

export async function analyzeVideo(
  video: Video,
  ai: GoogleGenAI,
  model: string,
  { tier = 1, niche = "" }: { tier?: number; niche?: string } = {}
): Promise<Analysis> {
  mkdirSync("tmp", { recursive: true });
  const localPath = `tmp/${video.id || "video"}.mp4`;
  let bytes: number = 0;
  let downloaded = false;
  if (video.videoUrl) {
    try { bytes = await downloadVideo(video.videoUrl, localPath); downloaded = true; } catch { /* fallback */ }
  }
  if (!downloaded) {
    if (!/tiktok\.com/i.test(video.url || "")) throw new Error("no downloadable video (Instagram link expired or missing)");
    console.log("   normal download unavailable, trying Shop-video fallback...");
    const playUrl = await resolveShopPlayUrl(video.url);
    if (!playUrl) throw new Error("no downloadable video (including Shop fallback)");
    bytes = await downloadVideo(playUrl, localPath);
  }
  console.log(`   downloaded ${((bytes as number) / 1_000_000).toFixed(1)} MB`);

  let videoUri: string;
  let videoMime = "video/mp4";
  let gcsObject: string | null = null;
  let file: Record<string, unknown> | null = null;
  if (isVertex()) {
    const bucket = process.env.GCS_BUCKET;
    if (!bucket) throw new Error("Vertex mode needs GCS_BUCKET in .env");
    gcsObject = `videos/${video.id || Date.now()}.mp4`;
    const token = adcToken();
    let up: Response | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      up = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(gcsObject)}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": videoMime }, body: readFileSync(localPath) as unknown as BodyInit });
      if (up.ok) break;
      if (attempt === 3) throw new Error(`bucket upload failed (HTTP ${up.status})`);
      await sleep(attempt * 2000);
    }
    videoUri = `gs://${bucket}/${gcsObject}`;
  } else {
    const uploaded = await (ai.files as unknown as { upload: (p: unknown) => Promise<Record<string, unknown>> }).upload({ file: localPath, config: { mimeType: videoMime } });
    file = uploaded;
    while (file.state === "PROCESSING") {
      await sleep(2000);
      file = await (ai.files as unknown as { get: (p: unknown) => Promise<Record<string, unknown>> }).get({ name: file.name });
    }
    if (file.state === "FAILED") throw new Error("Gemini failed to process the video file");
    videoUri = file.uri as string;
    videoMime = file.mimeType as string;
  }

  const res = await generateWithRetry(ai, {
    model,
    contents: createUserContent([createPartFromUri(videoUri, videoMime), buildPrompt(tier, niche)]),
    config: { responseMimeType: "application/json", responseSchema: tier === 2 ? TIER2_SCHEMA : TIER1_SCHEMA },
  }) as { text: string };

  if (gcsObject) {
    try { await fetch(`https://storage.googleapis.com/storage/v1/b/${process.env.GCS_BUCKET}/o/${encodeURIComponent(gcsObject)}`, { method: "DELETE", headers: { Authorization: `Bearer ${adcToken()}` } }); } catch {}
  }
  if (file) { try { await (ai.files as unknown as { delete: (p: unknown) => Promise<void> }).delete({ name: file.name }); } catch {} }
  try { rmSync(localPath); } catch {}

  const analysis = JSON.parse(res.text) as Analysis;
  (analysis as unknown as Record<string,string>).analysis_tier = String(tier);
  if (niche) (analysis as unknown as Record<string,string>).niche_for = niche;
  return analysis;
}

export const analyzeVideoTool = createTool({
  id: "analyze-video",
  description: "Have Gemini watch a short-form video and return structured analysis (hook, format, tone, niche_match, script if tier2).",
  inputSchema: z.object({
    video: z.any(),
    tier: z.number().default(1),
    niche: z.string().default(""),
    model: z.string().default(DEFAULT_MODEL),
  }),
  outputSchema: z.object({ analysis: z.any() }),
  execute: async ({ context }) => {
    const ai = makeClient();
    const analysis = await analyzeVideo(context.video as Video, ai, context.model, { tier: context.tier, niche: context.niche });
    return { analysis };
  },
});
