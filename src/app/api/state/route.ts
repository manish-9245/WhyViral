// src/app/api/state/route.ts — Returns pipeline run state for the UI.
import { NextRequest } from "next/server";
import { loadState, stageStatuses, STAGES } from "@/mastra/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = (searchParams.get("platform") || "tiktok").toLowerCase();

  const state = loadState(platform);
  const statuses = state ? stageStatuses(state) : null;

  // Also surface existing report data for quick checks.
  let reportMeta = null;
  try {
    const { existsSync, readFileSync } = await import("node:fs");
    const reportPath = `output/report-${platform}.json`;
    if (existsSync(reportPath)) {
      const raw = JSON.parse(readFileSync(reportPath, "utf8"));
      reportMeta = { keyword: raw.keyword, videoCount: Array.isArray(raw.videos) ? raw.videos.length : 0, date: raw.meta?.date || null };
    }
  } catch {}

  return Response.json({
    platform,
    stages: STAGES,
    statuses,
    state: state ? { lastCompleted: state.lastCompleted, failedAt: state.failedAt, failureReason: state.failureReason, updatedAt: state.updatedAt } : null,
    reportMeta,
  });
}
