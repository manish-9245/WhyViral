// src/mastra/index.ts — Mastra instance (Node runtime)
// Registers agents, workflows, and tools for `mastra dev` + programmatic use.

import { Mastra } from "@mastra/core";

import { videoAnalystAgent } from "./agents/video-analyst";
import { patternSynthesizerAgent } from "./agents/pattern-synthesizer";
import { instagramDiscoverAgent } from "./agents/instagram-discover";

import { archiveWorkflow } from "./workflows/archive-workflow";

export const mastra = new Mastra({
  // storage: using default in-memory (LibSQL version mismatch mitigated)
  agents: {
    videoAnalyst: videoAnalystAgent,
    patternSynthesizer: patternSynthesizerAgent,
    instagramDiscover: instagramDiscoverAgent,
  },
  workflows: {
    archiveWorkflow,
  },
  // Mastra telemetry opt-out (WhyViral has its own privacy-conscious telemetry)
  telemetry: { enabled: false },
});

export type MastraInstance = typeof mastra;
