import { existsSync, readFileSync } from "node:fs";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ReportClient } from "@/components/report/ReportClient";
import type { ArchiveReport } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, FileJson, Settings } from "lucide-react";

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
      const cache = existsSync("output/analyses.json") ? JSON.parse(readFileSync("output/analyses.json", "utf8")) : {};
      const analyses = (v.videos || []).map((vid: { id: string }) => cache[vid.id] || null);
      return {
        keyword: v.keyword || v.keywords?.join(", ") || platform,
        platform: platform as never,
        videos: v.videos || v.pool || [],
        analyses,
        patterns: null,
        adaptable: [],
        meta: { rankBy: v.rankBy || "engagement", date: new Date().toISOString().slice(0, 10), platform: platform as never },
      };
    } catch {}
  }
  return null;
}

export default async function ReportPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const allowed = ["tiktok", "instagram", "meta", "youtube", "twitter", "pinterest", "reddit", "linkedin", "snapchat"];
  if (!allowed.includes(platform)) return (
    <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
      <div className="text-center font-mono text-[13px] text-stone">Unknown platform "{platform}" — use {allowed.join(", ")}.</div>
    </div>
  );

  const report = loadReport(platform);

  if (!report) {
    return (
      <div className="min-h-screen bg-[#f8f7f4]">
        {/* Nav */}
        <header className="bg-white border-b border-stone/10 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-ink grid place-items-center text-amber text-[10px] font-bold font-mono">WV</div>
              <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-ink">WHYVIRAL</span>
            </div>
            <nav className="flex items-center gap-1">
              <Link href="/" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50">Console</Link>
              <Link href="/history" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50">History</Link>
              <Link href="/settings" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50"><Settings className="h-3.5 w-3.5" /></Link>
            </nav>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-stone-100 mx-auto mb-4 grid place-items-center font-mono text-[11px] text-stone/40 font-bold">
            {platform.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.03em] text-ink capitalize">{platform} wall — empty</h1>
          <p className="mt-2 font-mono text-[12px] text-stone/60">No report found for this platform. Run a search from the console.</p>
          <Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-amber text-ink font-mono text-[12px] font-semibold px-5 hover:bg-amber/90 transition-colors">
            ← Go to console
          </Link>
        </div>
      </div>
    );
  }

  const videoMap: Record<string, { url: string; metric: string }> = {};
  report.videos.forEach((v, i) => {
    const metric = v.platform === "meta" ? `${v.daysRunning} days` : `${v.views.toLocaleString()} views`;
    videoMap[`V${i + 1}`] = { url: v.url, metric: `@${v.author} · ${metric}` };
  });

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone/10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-ink grid place-items-center text-amber text-[10px] font-bold font-mono">WV</div>
            <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-ink">WHYVIRAL</span>
            <span className="font-mono text-[11px] text-stone/40 hidden sm:block">/</span>
            <span className="font-mono text-[11px] text-stone/60 capitalize hidden sm:block">{platform}</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50">Console</Link>
            <Link href="/history" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50">History</Link>
            <Link href="/settings" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50"><Settings className="h-3.5 w-3.5" /></Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone/20 bg-white px-3 font-mono text-[11px] text-stone hover:bg-stone-50 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Console
          </Link>
          <a href={`/output/report-${platform}.json`} target="_blank"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink text-white px-3 font-mono text-[11px] font-medium hover:bg-ink/90 transition-colors">
            Raw JSON <FileJson className="h-3 w-3" />
          </a>
          <span className="ml-auto font-mono text-[11px] text-stone/40">© Manish Tiwari</span>
        </div>

        <ReportHeader report={report} />

        <ReportClient report={report} videoMap={videoMap} />

        <div className="rounded-xl border border-stone/10 bg-white px-5 py-4 font-mono text-[11px] text-stone/60 text-center">
          {report.videos.length} winners · data lives in <span className="text-stone/80">output/report-{platform}.json</span> · private &amp; local
        </div>
      </div>
    </div>
  );
}
