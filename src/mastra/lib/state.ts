// src/mastra/lib/state.ts — per-pipeline run state for granular resume.
// Persists per-stage outputs to output/state-{platform}.json so a failed
// run can pick up at the exact stage that broke.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Analysis, Patterns, Video } from "../../lib/types";

export type Stage = "scrape" | "prescreen" | "watch" | "deep" | "synth";
export const STAGES: Stage[] = ["scrape", "prescreen", "watch", "deep", "synth"];

export interface RunState {
  version: 1;
  platform: string;
  keyword: string;
  startedAt: string;
  updatedAt: string;
  lastCompleted: Stage | null;
  failedAt: Stage | null;
  failureReason: string | null;
  // Stage outputs (only set once that stage completes)
  scrape: { videos: Video[]; poolSize: number; igSources?: unknown } | null;
  prescreen: { videoIds: string[] } | null;
  watch: { ok: Array<{ video: Video; analysis: Analysis }>; adaptable: Array<{ video: Video; analysis: Analysis }> } | null;
  deep: { tier2Ids: string[] } | null;
  synth: { patterns: Patterns | null } | null;
  // Config snapshot — what the run was started with
  config: { count: number; pool: number; rankBy: string; language: string; country: string; nicheLabel: string; keywords: string[] };
}

const SCHEMA = 1;

function statePath(platform: string) {
  return `output/state-${platform}.json`;
}

export function loadState(platform: string): RunState | null {
  const p = statePath(platform);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    if (j.version !== SCHEMA) return null;
    return j as RunState;
  } catch {
    return null;
  }
}

export function saveState(state: RunState) {
  state.updatedAt = new Date().toISOString();
  writeFileSync(statePath(state.platform), JSON.stringify(state, null, 2));
}

export function newState(platform: string, config: RunState["config"]): RunState {
  return {
    version: SCHEMA,
    platform,
    keyword: config.keywords.join(", "),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastCompleted: null,
    failedAt: null,
    failureReason: null,
    scrape: null,
    prescreen: null,
    watch: null,
    deep: null,
    synth: null,
    config,
  };
}

export function clearState(platform: string) {
  const p = statePath(platform);
  if (existsSync(p)) {
    try { writeFileSync(p, ""); } catch {}
  }
}

// Summarize state for the UI — small payload.
export type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";
export function stageStatuses(state: RunState | null): Record<Stage, StageStatus> {
  const empty: Record<Stage, StageStatus> = { scrape: "pending", prescreen: "pending", watch: "pending", deep: "pending", synth: "pending" };
  if (!state) return empty;
  const order = STAGES;
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    const completed = state.lastCompleted && order.indexOf(state.lastCompleted) >= i;
    const failedHere = state.failedAt === s;
    if (failedHere) empty[s] = "failed";
    else if (completed) empty[s] = "done";
    else empty[s] = "pending";
  }
  // Mark stages beyond the last completed as pending (already default)
  return empty;
}

// First stage to actually run when resuming (or starting fresh).
export function nextStage(state: RunState | null, requested?: Stage): Stage {
  if (!requested) {
    if (!state || !state.lastCompleted) return "scrape";
    const idx = STAGES.indexOf(state.lastCompleted);
    return STAGES[Math.min(idx + 1, STAGES.length - 1)];
  }
  return requested;
}
