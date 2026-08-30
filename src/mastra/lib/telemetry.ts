// src/mastra/lib/telemetry.ts — privacy-conscious telemetry (Mastra migration)
// Ports src/telemetry.js so Mastra workflows emit the same anonymous events.

import "dotenv/config";
import { appendFileSync, mkdirSync } from "node:fs";

const VERSION = "0.2.0-mastra";
const ALLOWED_EVENTS = new Set(["run_started", "report_generated", "run_completed", "run_failed"]);

const enabled = () => /^(1|true|yes)$/i.test(String(process.env.ARCHIVE_USAGE_TRACKING || ""));

function cleanText(value: unknown, max = 80): string {
  return String(value ?? "").replace(/[\r\n\t]/g, " ").trim().slice(0, max);
}

function safeEvent(event: string, details: Record<string, unknown> = {}) {
  return {
    event: ALLOWED_EVENTS.has(event) ? event : "unknown",
    timestamp: new Date().toISOString(),
    invite_id: cleanText(process.env.EARLY_ACCESS_ID || "anonymous"),
    archive_version: VERSION,
    platform: cleanText(details.platform || ""),
    reference_count: Number.isFinite(details.referenceCount) ? details.referenceCount : "",
    patterns_generated: details.patternsGenerated === true,
    activation: details.activation === true,
    reports_generated: Number.isFinite(details.reportsGenerated) ? details.reportsGenerated : "",
    error_stage: cleanText(details.errorStage || ""),
  };
}

function saveLocal(event: unknown) {
  try {
    mkdirSync("output", { recursive: true });
    appendFileSync("output/usage-events.jsonl", `${JSON.stringify(event)}\n`);
  } catch {}
}

export async function trackEvent(event: string, details: Record<string, unknown> = {}) {
  const payload = safeEvent(event, details);
  saveLocal(payload);
  const endpoint = String(process.env.ARCHIVE_TELEMETRY_URL || "").trim();
  if (!enabled() || !endpoint) return { sent: false, reason: "disabled" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, ingest_token: cleanText(process.env.ARCHIVE_TELEMETRY_TOKEN || "", 160) }),
      redirect: "follow",
      signal: controller.signal,
    });
    return { sent: response.ok, reason: response.ok ? "ok" : `http_${response.status}` };
  } catch {
    return { sent: false, reason: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
