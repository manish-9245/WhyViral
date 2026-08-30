import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dir = "output";
  if (!existsSync(dir)) return NextResponse.json({ runs: [] });
  const files = readdirSync(dir).filter(f => f.startsWith("report-") && f.endsWith(".json"));
  const runs = files.map(f => {
    const p = `${dir}/${f}`;
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      const stat = statSync(p);
      return {
        file: f,
        platform: j.platform || f.replace("report-","").replace(".json",""),
        keyword: j.keyword || "—",
        videos: (j.videos || []).length,
        date: j.meta?.date || new Date(stat.mtime).toISOString().slice(0,10),
        mtime: stat.mtime.toISOString(),
        rankBy: j.meta?.rankBy || "—",
        hasPatterns: !!j.patterns,
        size: stat.size,
      };
    } catch {
      const stat = statSync(p);
      return { file: f, platform: "unknown", keyword: "—", videos: 0, date: new Date(stat.mtime).toISOString().slice(0,10), mtime: stat.mtime.toISOString(), rankBy: "—", hasPatterns: false, size: stat.size };
    }
  }).sort((a,b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
  return NextResponse.json({ runs });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  if (!file || !file.startsWith("report-") || !file.endsWith(".json") || file.includes("..")) return NextResponse.json({ error: "invalid file" }, { status: 400 });
  const p = `output/${file}`;
  if (!existsSync(p)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { unlinkSync } = await import("node:fs");
  unlinkSync(p);
  // Also try to delete related videos/patterns files for same platform+keyword? Keep simple: just report.
  return NextResponse.json({ ok: true });
}
