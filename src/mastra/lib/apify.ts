// src/mastra/lib/apify.ts — Apify key rotation (Mastra migration)
// Direct port of src/apify.js with identical semantics so existing .env keeps working.

import { ApifyClient } from "apify-client";

export function apifyTokens(): string[] {
  return String(process.env.APIFY_TOKEN || "")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

let idx = 0;

export function currentToken(): string {
  const tokens = apifyTokens();
  if (!tokens.length) return "";
  return tokens[Math.min(idx, tokens.length - 1)];
}

export function currentClient() {
  return new ApifyClient({ token: currentToken() });
}

export function tokenCount(): number {
  return apifyTokens().length;
}

export function isQuotaError(err: unknown): boolean {
  const msg = String(((err as Record<string, unknown>)?.message as string) || err || "").toLowerCase();
  return (
    msg.includes("monthly usage hard limit") ||
    msg.includes("usage hard limit") ||
    msg.includes("hard limit exceeded") ||
    msg.includes("monthly usage") ||
    msg.includes("quota") ||
    msg.includes("payment required") ||
    msg.includes("402") ||
    msg.includes("insufficient credit") ||
    (msg.includes("not enough") && msg.includes("credit"))
  );
}

export async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  callOpts: Record<string, unknown> = {}
): Promise<{ items: Record<string, unknown>[]; run: { defaultDatasetId: string } }> {
  const tokens = apifyTokens();
  if (!tokens.length) throw new Error("No APIFY_TOKEN found in your .env file.");

  let lastErr: unknown;
  while (idx < tokens.length) {
    const apify = new ApifyClient({ token: tokens[idx] });
    try {
      const run = await apify.actor(actorId).call(input, callOpts as never);
      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      return { items: items as Record<string, unknown>[], run };
    } catch (err) {
      lastErr = err;
      const hasNext = idx < tokens.length - 1;
      if (isQuotaError(err) && hasNext) {
        console.log(`   🔑 Apify key #${idx + 1} out of credit — switching to key #${idx + 2}...`);
        idx += 1;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
