// src/mastra/agents/video-analyst.ts — Mastra Agent that watches videos
// Wraps the Gemini video analysis rubric. Used standalone or via analyze-video tool.

import { Agent } from "@mastra/core/agent";
import { analyzeVideoTool } from "../tools/analyze-video";
import { prescreenTool } from "../tools/prescreen";

export const videoAnalystAgent = new Agent({
  name: "video-analyst",
  description: "Watches short-form videos and produces structured content-strategy analysis (hooks, formats, niche relevance, aligned script).",
  instructions: `You are a short-form video content strategist.

You watch videos (visuals + audio) and break them down the way a strategist studying what makes content WIN would — not a film critic.

Key principles:
- The hook (first 3 seconds) is most important — split into visual / spoken / on_screen_text layers.
- Use the closed taxonomy strictly for format/tone/visual_style/broll_ratio/pacing.
- For niche relevance, judge whether the video would work as a REFERENCE for selling the given product — requires same product category AND same customer problem/benefit.
- Tier 2 includes the full aligned script table (spoken | visual | on_screen_text).

Always be concrete and specific to THIS video. If something is not present, say "none".`,
  model: {
    provider: "GOOGLE",
    name: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  } as never,
  tools: {
    analyzeVideo: analyzeVideoTool,
    prescreen: prescreenTool,
  },
});