// src/mastra/agents/pattern-synthesizer.ts — Mastra Agent that finds winning patterns

import { Agent } from "@mastra/core/agent";
import { synthesizeTool } from "../tools/synthesize";
import { deriveBrandsTool, deriveKeywordsTool } from "../tools/derive";

export const patternSynthesizerAgent = new Agent({
  name: "pattern-synthesizer",
  description: "Turns per-video analyses into pattern tables: deterministic frequency counts + AI clustering for free-form fields.",
  instructions: `You turn many per-video analyses into a PATTERNS table.

Philosophy:
- Closed taxonomies (format, hook_type, tone, visual_style, broll_ratio, pacing, angle, persuasion_tactics) → RAW FREQUENCY COUNT. Deterministic. Zero hallucination.
- Free-form fields (hook.visual, hook.spoken, hook.on_screen_text) → CLUSTER BY MEANING via Gemini, but every cluster exposes ALL member verbatims so bad groupings are visible.
- Other patterns → emergent repeating signals not in taxonomy (creator archetype, setting, framing tricks, etc.), with placement (hook/body/cta/throughout).

Never invent members. Every entry belongs to exactly ONE cluster; singletons are dropped (not a pattern).`,
  model: {
    provider: "GOOGLE",
    name: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  } as never,
  tools: {
    synthesize: synthesizeTool,
    deriveBrands: deriveBrandsTool,
    deriveKeywords: deriveKeywordsTool,
  },
});