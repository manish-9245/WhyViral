// src/mastra/lib/cache.ts — shared analysis cache (Mastra migration)
// Mirrors archive cache semantics: schema_version 4, tier tracking, file persistence.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Analysis } from "../../lib/types";

export const CACHE_PATH = "output/analyses.json";
export const CURRENT_SCHEMA = "4";

export function loadCache(): Record<string, Analysis & Record<string, unknown>> {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function saveCache(cache: Record<string, unknown>) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

export const cacheValid = (entry: unknown): boolean => {
  const e = entry as Record<string, unknown> | null;
  return !!e && (e.schema_version === CURRENT_SCHEMA || e.schema_version === "3");
};

export const tierOf = (entry: unknown): string | null => {
  const e = entry as Record<string, unknown> | null;
  if (!e) return null;
  if (e.analysis_tier) return String(e.analysis_tier);
  return Array.isArray(e.script) && (e.script as unknown[]).length ? "2" : "1";
};

export function migrateHonestReview(cache: Record<string, Analysis>): number {
  let migrated = 0;
  for (const id in cache) {
    if ((cache[id] as unknown as Record<string, unknown>)?.format === "honest-review") {
      (cache[id] as unknown as Record<string, unknown>).format = "yap";
      migrated++;
    }
  }
  if (migrated) saveCache(cache);
  return migrated;
}
