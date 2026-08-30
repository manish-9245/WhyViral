import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV_PATH = ".env";
const ALLOWED_KEYS = new Set([
  "APIFY_TOKEN","GEMINI_API_KEY","GEMINI_MODEL","GOOGLE_GENAI_USE_VERTEXAI","GOOGLE_CLOUD_PROJECT","GOOGLE_CLOUD_LOCATION","GCS_BUCKET",
  "VIDEO_COUNT","VIEW_FLOOR","RANK_BY","LANGUAGE","COUNTRY","NICHE","NICHE_FILTER","DEEP_COUNT","SYNTH_MIN","META_DAYS_FLOOR","ANALYZE_CONCURRENCY"
]);

function parseEnv(): Record<string,string> {
  if (!existsSync(ENV_PATH)) return {};
  const lines = readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  const out: Record<string,string> = {};
  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const k = line.slice(0,idx).trim();
    const v = line.slice(idx+1).trim();
    if (k) out[k]=v;
  }
  return out;
}

function mask(v: string) {
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return v.slice(0,4) + "••••" + v.slice(-4);
}

export async function GET() {
  const env = parseEnv();
  // Return masked for sensitive, raw for others
  const masked: Record<string,string> = {};
  for (const k of ALLOWED_KEYS) {
    const v = env[k] || "";
    if (["APIFY_TOKEN","GEMINI_API_KEY"].includes(k) && v) masked[k]=mask(v);
    else masked[k]=v;
  }
  // Also return file existence
  const hasEnv = existsSync(ENV_PATH);
  const hasReports = existsSync("output/report-tiktok.json") || existsSync("output/report-instagram.json") || existsSync("output/report-meta.json");
  return NextResponse.json({ env: masked, hasEnv, hasReports, platform: process.platform, node: process.version });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}));
  const updates = body as Record<string,string>;
  const env = parseEnv();
  let changed = 0;
  for (const [k,v] of Object.entries(updates)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    // Don't overwrite masked values with bullets
    if (v.includes("•")) continue;
    env[k]=String(v).trim();
    changed++;
  }
  if (changed===0) return NextResponse.json({ ok:false, error:"no valid keys" }, { status:400 });
  // Write back preserving comments
  let original = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const lines = original.split(/\r?\n/);
  const keysToWrite = new Set(Object.keys(updates).filter(k=>ALLOWED_KEYS.has(k)));
  const outLines: string[] = [];
  const written = new Set<string>();
  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) { outLines.push(line); continue; }
    const k = line.slice(0,line.indexOf("=")).trim();
    if (keysToWrite.has(k)) {
      outLines.push(`${k}=${env[k]}`);
      written.add(k);
    } else {
      outLines.push(line);
    }
  }
  for (const k of keysToWrite) if (!written.has(k)) outLines.push(`${k}=${env[k]}`);
  writeFileSync(ENV_PATH, outLines.join("\n").replace(/\n+$/,"")+"\n", { mode:0o600 });
  return NextResponse.json({ ok:true, changed });
}
