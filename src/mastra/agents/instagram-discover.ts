// src/mastra/agents/instagram-discover.ts

import { Agent } from "@mastra/core/agent";
import { discoverInstagramTool } from "../tools/discover-instagram";
import { scrapeInstagramTool } from "../tools/scrape-instagram";

export const instagramDiscoverAgent = new Agent({
  name: "instagram-discover",
  description: "Converts a keyword into Instagram hashtags + creator accounts, then scrapes reels.",
  instructions: `You turn a niche keyword into Instagram sources.

- Call discover-instagram to get 10 hashtags + 5 accounts.
- Present them to the user for confirmation (if INTERACTIVE).
- Then scrape via scrape-instagram.

Instagram has no keyword search, so discovery is required before scraping.`,
  model: {
    provider: "GOOGLE",
    name: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  } as never,
  tools: {
    discover: discoverInstagramTool,
    scrapeInstagram: scrapeInstagramTool,
  },
});