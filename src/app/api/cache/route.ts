import { NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_PATH = "output/analyses.json";

export async function GET() {
  if (!existsSync(CACHE_PATH)) return NextResponse.json({ count:0, size:0, schema:"4", entries:[], mtime:null });
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    const j = JSON.parse(raw);
    const entries = Object.entries(j).map(([id, v]: [string, unknown]) => {
      const a = v as Record<string,unknown>;
      return { id, format: a.format as string || "—", niche_match: a.niche_match as string || "—", tier: (a.analysis_tier as string) || (Array.isArray(a.script) && (a.script as unknown[]).length ? "2" : "1"), lang: (a.spoken_language as string) || "—" };
    }).slice(0,50);
    const stat = statSync(CACHE_PATH);
    return NextResponse.json({ count: Object.keys(j).length, size: stat.size, mtime: stat.mtime.toISOString(), entries, schema:"4" });
  } catch (e) {
    return NextResponse.json({ error:String(e) }, { status:500 });
  }
}

export async function DELETE() {
  if (existsSync(CACHE_PATH)) {
    writeFileSync(CACHE_PATH, JSON.stringify({}, null, 2));
    return NextResponse.json({ ok:true, cleared:true });
  }
  return NextResponse.json({ ok:true, cleared:false });
}
