import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "tiktok";
  const format = (searchParams.get("format") || "csv").toLowerCase();
  const p = `output/report-${platform}.json`;
  if (!existsSync(p)) return NextResponse.json({ error:"no report" }, { status:404 });
  const j = JSON.parse(readFileSync(p, "utf8")) as { keyword:string; platform:string; videos: Array<Record<string,unknown>>; analyses: Array<Record<string,unknown>>; patterns: unknown; meta: { rankBy:string; date:string } };

  if (format==="json") {
    return new NextResponse(JSON.stringify(j, null, 2), { headers: { "Content-Type":"application/json", "Content-Disposition":`attachment; filename="report-${platform}.json"` } });
  }
  if (format==="md" || format==="markdown") {
    let md = `# WhyViral — ${j.keyword} (${platform})\n\n`;
    md += `**${j.videos.length} winners** · ranked by ${j.meta.rankBy} · ${j.meta.date} · Built by Manish Tiwari\n\n`;
    md += `## Winners\n\n`;
    j.videos.forEach((v, i) => {
      const a = j.analyses[i] as Record<string,unknown>;
      const hook = (a.hook as Record<string,string>) || {};
      md += `### V${i+1} — @${v.author} · ${v.views ? `${v.views} views` : `${(v as Record<string,unknown>).daysRunning} days`}\n`;
      md += `- **Format:** ${a.format || "—"} · **Hook:** ${a.hook_type || "—"} · **Tone:** ${a.tone || "—"}\n`;
      md += `- **Hook spoken:** “${hook.spoken || "none"}”\n`;
      md += `- **Hook visual:** ${hook.visual || "none"}\n`;
      md += `- **On-screen:** “${hook.on_screen_text || "none"}”\n`;
      md += `- **Link:** ${v.url}\n\n`;
    });
    if (j.patterns) {
      md += `## Patterns\n\n${JSON.stringify(j.patterns, null, 2)}\n`;
    }
    return new NextResponse(md, { headers: { "Content-Type":"text/markdown; charset=utf-8", "Content-Disposition":`attachment; filename="report-${platform}.md"` } });
  }
  // csv default
  const rows: string[] = [];
  rows.push(["label","platform","author","views_or_days","url","format","hook_type","tone","hook_spoken","hook_visual","hook_text","why_it_works"].map(c=>`"${c}"`).join(","));
  j.videos.forEach((v, i) => {
    const a = j.analyses[i] as Record<string,unknown>;
    const hook = (a.hook as Record<string,string>) || {};
    const vals = [
      `V${i+1}`,
      String(v.platform||""),
      String(v.author||""),
      String((v.views as number) || (v as Record<string,unknown>).daysRunning || ""),
      String(v.url||""),
      String(a.format||""),
      String(a.hook_type||""),
      String(a.tone||""),
      String(hook.spoken||"").replace(/"/g,'""'),
      String(hook.visual||"").replace(/"/g,'""'),
      String(hook.on_screen_text||"").replace(/"/g,'""'),
      String(a.why_it_works||"").replace(/"/g,'""'),
    ];
    rows.push(vals.map(v=>`"${v}"`).join(","));
  });
  return new NextResponse(rows.join("\n"), { headers: { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":`attachment; filename="report-${platform}.csv"` } });
}
