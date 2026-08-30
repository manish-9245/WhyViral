import { existsSync, readFileSync } from "node:fs";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ReportClient } from "@/components/report/ReportClient";
import type { ArchiveReport } from "@/lib/types";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, FileJson, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

function loadReport(platform: string): ArchiveReport | null {
  const jsonPath = `output/report-${platform}.json`;
  if (existsSync(jsonPath)) {
    try { return JSON.parse(readFileSync(jsonPath, "utf8")); } catch {}
  }
  const vpath = `output/videos-${platform}.json`;
  if (existsSync(vpath)) {
    try {
      const v = JSON.parse(readFileSync(vpath, "utf8"));
      const patPath = `output/patterns-${platform}.json`;
      const patterns = existsSync(patPath) ? JSON.parse(readFileSync(patPath, "utf8")) : null;
      const cache = existsSync("output/analyses.json") ? JSON.parse(readFileSync("output/analyses.json", "utf8")) : {};
      const analyses = (v.videos || []).map((vid: { id: string }) => cache[vid.id] || null);
      return { keyword: v.keyword || v.keywords?.join(", ") || platform, platform: platform as never, videos: v.videos || v.pool || [], analyses, patterns, adaptable: [], meta: { rankBy: v.rankBy || "engagement", date: new Date().toISOString().slice(0,10), platform: platform as never } };
    } catch {}
  }
  return null;
}

export default async function ReportPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const allowed = ["tiktok","instagram","meta"];
  if (!allowed.includes(platform)) return <div className="py-12 text-center font-mono text-[13px]">Unknown platform “{platform}” — use tiktok, instagram, or meta.</div>;

  const report = loadReport(platform);

  if (!report) {
    return (
      <div className="space-y-6">
        <div className="rounded-[12px] border border-line bg-white overflow-hidden">
          <div className="h-9 flex items-center px-6 bg-ink text-paper font-mono text-[10px] tracking-[0.12em]">EVIDENCE ARCHIVE — {platform.toUpperCase()} · NO TAPES</div>
          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 font-mono text-[11px] tracking-[0.08em]">LAB No. 002 · Manish Tiwari</div>
            <h1 className="mt-4 font-display text-[28px] font-bold tracking-[-0.03em] capitalize" style={{fontFamily:"var(--font-sora)"}}>{platform} wall — empty</h1>
            <p className="mt-2 font-mono text-[12px] text-stone">No report found. Run from the bench.</p>
          </div>
        </div>
        <div className="rounded-[12px] border border-amber/20 bg-amber/[0.08] p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
          <span className="font-mono text-[12px] leading-5">No <span className="font-medium text-ink">output/report-{platform}.json</span> found. Run from the bench or via <span className="font-mono bg-white border border-line px-1.5 py-0.5 rounded">npm run all</span></span>
        </div>
        <div className="flex justify-center gap-2">
          <Link href="/" className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-ink text-paper px-4 font-mono text-[12px] font-medium">← Back to bench</Link>
        </div>
      </div>
    );
  }

  const videoMap: Record<string, { url: string; metric: string }> = {};
  report.videos.forEach((v, i) => {
    const metric = v.platform === "meta" ? `${v.daysRunning} days` : `${v.views} views`;
    videoMap[`V${i+1}`] = { url: v.url, metric: `@${v.author} · ${metric}` };
  });
  const hasHtmlFallback = existsSync(`output/report-${platform}.html`);

  return (
    <div className="space-y-8">
      <ReportHeader report={report} />

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 font-mono text-[11px] font-medium hover:bg-paper"><ArrowLeft className="h-3 w-3" /> Bench</Link>
        {hasHtmlFallback && <a href={`/output/report-${platform}.html`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 font-mono text-[11px]">Legacy HTML <FileText className="h-3 w-3" /></a>}
        <a href={`/output/report-${platform}.json`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink text-paper px-3 font-mono text-[11px] font-medium">Raw JSON <FileJson className="h-3 w-3" /></a>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-stone">© Manish Tiwari — every pin is a timestamped source</span>
      </div>

      <ReportClient report={report} videoMap={videoMap} />

      <div className="rounded-[12px] border border-line bg-paper p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="font-mono text-[11px] leading-4 text-stone">
          Platform <span className="font-medium text-ink">{platform}</span> · {report.videos.length} winners · {report.patterns ? "wall complete" : "needs 5+"} · <span className="hidden sm:inline">data </span><span className="font-mono bg-white border border-line px-1.5 py-0.5 rounded">output/report-{platform}.json</span>
        </div>
        <div className="font-mono text-[11px] tracking-[0.06em]">Built by <span className="font-semibold text-ink">Manish Tiwari</span> — for strategists, with proof</div>
      </div>
    </div>
  );
}
