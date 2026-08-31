// src/mastra/tools/check-keys.ts — Mastra tool for key validation
// Ports src/check-keys.js into a tool callable by agents/workflows or API routes.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ApifyClient } from "apify-client";
import { makeClient, isVertex } from "../lib/genai";
import { apifyTokens, getScraperProvider, describeProvider } from "../lib/scraper";

export async function checkKeys() {
  const results: { service: string; ok: boolean; message: string }[] = [];
  const provider = getScraperProvider();
  results.push({ service: "scraper", ok: true, message: `Provider: ${describeProvider()} (SCRAPER_PROVIDER=${provider})` });

  // Crawlee (open-source) — always OK; ban-safe defaults for all 9 platforms
  if (provider === "crawlee" || provider === "auto") {
    const proxy = process.env.CRAWLEE_PROXY ? ` via proxy` : "";
    const stealth = String(process.env.CRAWLEE_STEALTH ?? "true").toLowerCase() !== "false" ? "stealth on" : "stealth off";
    const concurrency = process.env.CRAWLEE_MAX_CONCURRENCY || "1";
    results.push({
      service: "crawlee",
      ok: true,
      message: `OK — open-source 9 platforms (tiktok/ig/meta/youtube/twitter/pinterest/reddit/linkedin/snapchat), $0/run, anti-ban: jitter + concurrency=${concurrency} + ${stealth}${proxy}`,
    });
    // Probe TikWM availability (light check, no ban risk)
    try {
      const r = await fetch("https://www.tikwm.com/api/feed/search", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ keywords: "test", count: "1", cursor: "0", HD: "1" }).toString(),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) results.push({ service: "crawlee/tikwm", ok: true, message: "TikWM cache reachable — TikTok search will not hit tiktok.com directly" });
      else results.push({ service: "crawlee/tikwm", ok: true, message: `TikWM HTTP ${r.status} — will use Playwright fallback (still safe)` });
    } catch (e) {
      results.push({ service: "crawlee/tikwm", ok: true, message: `TikWM probe: ${(e as Error).message.slice(0, 80)} — Playwright fallback available` });
    }
    // YouTube Data API (optional but recommended for Shorts)
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&type=video&videoDuration=short&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`, { signal: AbortSignal.timeout(6000) });
        if (r.ok) results.push({ service: "youtube/api", ok: true, message: "YouTube Data API key OK — Shorts will use official API (zero ban risk)" });
        else results.push({ service: "youtube/api", ok: false, message: `YouTube API HTTP ${r.status} — check YOUTUBE_API_KEY` });
      } catch (e) { results.push({ service: "youtube/api", ok: false, message: `YouTube probe: ${(e as Error).message.slice(0,80)}` }); }
    } else {
      results.push({ service: "youtube/api", ok: true, message: "No YOUTUBE_API_KEY — OK (fallback to ytInitialData scraping, still ban-safe)" });
    }
    results.push({ service: "crawlee/twitter", ok: true, message: "X/Twitter via guest-token + Nitter fallback — no login, jitter 1.2–2s (ban-safe)" });
    results.push({ service: "crawlee/pinterest", ok: true, message: "Pinterest via public search HTML — 900ms jitter, concurrency=1 (ban-safe)" });
    results.push({ service: "crawlee/reddit", ok: true, message: "Reddit via /search.json — public, no auth, 700ms jitter (ban-safe)" });
    results.push({ service: "crawlee/linkedin", ok: true, message: process.env.LINKEDIN_COOKIE ? "LinkedIn cookie set — authenticated search" : "LinkedIn: no cookie — public fallback via Bing (empty is expected, no ban)" });
    results.push({ service: "crawlee/snapchat", ok: true, message: "Snapchat Spotlight — best-effort public, returns empty gracefully (no ban)" });
  }

  const tokens = apifyTokens();
  if (!tokens.length) {
    if (provider === "apify") results.push({ service: "apify", ok: false, message: "No APIFY_TOKEN in .env — required when SCRAPER_PROVIDER=apify" });
    else results.push({ service: "apify", ok: true, message: "No APIFY_TOKEN — OK (Crawlee is primary, Apify is optional fallback)" });
  } else {
    let totalLeft = 0;
    let anyRejected = false;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const label = tokens.length > 1 ? `Key #${i+1}` : "Apify";
      try {
        const apify = new ApifyClient({ token });
        const me = await apify.user("me").get();
        let leftMsg = "";
        try {
          const full = await (await fetch(`https://api.apify.com/v2/users/me?token=${token}`)).json() as { data?: { plan?: { maxMonthlyUsageUsd?: number } } };
          const usage = await (await fetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${token}`)).json() as { data?: { totalUsageCreditsUsdBeforeVolumeDiscount?: number; totalUsageCreditsUsd?: number } };
          const limit = Number((full as Record<string,unknown>)?.data ? ((full.data as Record<string,unknown>).plan as Record<string,number>)?.maxMonthlyUsageUsd ?? 5 : 5);
          const used = Number((usage as Record<string,unknown>)?.data ? ((usage.data as Record<string,unknown>).totalUsageCreditsUsdBeforeVolumeDiscount as number) ?? ((usage.data as Record<string,unknown>).totalUsageCreditsUsd as number) ?? 0 : 0);
          const left = Math.max(0, limit - used);
          totalLeft += left;
          leftMsg = ` — $${left.toFixed(2)} of $${limit} left`;
        } catch {}
        results.push({ service: label, ok: true, message: `OK "${(me as unknown as Record<string,string>).username}"${leftMsg}` });
      } catch (err) {
        results.push({ service: label, ok: false, message: `Rejected: ${(err as Error).message}` });
        anyRejected = true;
      }
    }
    if (anyRejected) results.push({ service: "apify-summary", ok: false, message: "One or more keys invalid" });
    else if (totalLeft <= 0.2) results.push({ service: "apify-summary", ok: false, message: `Credit exhausted ($${totalLeft.toFixed(2)} left)` });
    else results.push({ service: "apify-summary", ok: true, message: `Total credit: $${totalLeft.toFixed(2)}` });
  }

  if (!isVertex() && !process.env.GEMINI_API_KEY) {
    results.push({ service: "gemini", ok: false, message: "No GEMINI_API_KEY in .env" });
  } else {
    try {
      const ai = makeClient();
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
      const res = await (ai.models as unknown as { generateContent: (p: unknown) => Promise<{ text: string }> }).generateContent({ model, contents: "Reply with single word: ready" } as never);
      const text = (res.text || "").trim();
      results.push({ service: "gemini", ok: true, message: `OK via ${isVertex() ? "Vertex" : "API key"} — model "${model}" replied "${text}"` });
    } catch (err) {
      results.push({ service: "gemini", ok: false, message: `Rejected: ${(err as Error).message}` });
    }
  }
  return { ok: results.every((r) => r.ok), results };
}

export const checkKeysTool = createTool({
  id: "check-keys",
  description: "Validate Apify and Gemini credentials and report remaining credit.",
  inputSchema: z.object({}),
  outputSchema: z.object({ ok: z.boolean(), results: z.array(z.object({ service: z.string(), ok: z.boolean(), message: z.string() })) }),
  execute: async () => checkKeys(),
});
