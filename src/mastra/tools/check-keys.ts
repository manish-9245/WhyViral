// src/mastra/tools/check-keys.ts — Mastra tool for key validation
// Ports src/check-keys.js into a tool callable by agents/workflows or API routes.

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ApifyClient } from "apify-client";
import { makeClient, isVertex } from "../lib/genai";
import { apifyTokens } from "../lib/apify";

export async function checkKeys() {
  const results: { service: string; ok: boolean; message: string }[] = [];
  const tokens = apifyTokens();
  if (!tokens.length) {
    results.push({ service: "apify", ok: false, message: "No APIFY_TOKEN in .env" });
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
