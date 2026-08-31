import { existsSync, readFileSync } from "node:fs";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ReportClient } from "@/components/report/ReportClient";
import type { ArchiveReport } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, FileJson, Settings } from "lucide-react";
import { PlatformBadge, PlatformIcon } from "@/components/PlatformIcon";

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
        {/* Nav — lab header */}
        <header className="bg-white border-b border-line" style={{ paddingTop: "var(--safe-top)" }}>
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-[10px] bg-ink grid place-items-center text-amber text-[11px] font-bold font-mono shadow-pin group-hover:shadow-[0_4px_12px_rgba(10,10,11,0.12)] transition-shadow">WV</div>
              <div className="hidden sm:block leading-none">
                <div className="font-mono text-[12px] font-bold tracking-[0.14em] text-ink">WHYVIRAL <span className="font-normal text-stone/50 text-[10px] tracking-[0.08em]">/ ARCHIVE</span></div>
                <div className="font-mono text-[10px] tracking-[0.08em] text-stone/60">Wall — {platform}</div>
              </div>
              <div className="sm:hidden font-mono text-[12px] font-bold tracking-[0.1em] text-ink">WHYVIRAL</div>
            </Link>
            <nav className="flex items-center gap-1.5" aria-label="Primary">
              <Link href="/" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">Console</Link>
              <Link href="/history" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">History</Link>
              <Link href="/settings" aria-label="Settings" className="h-8 w-8 grid place-items-center rounded-full bg-white border border-line text-stone hover:border-stone/30 hover:text-ink transition-colors"><Settings className="h-4 w-4" aria-hidden="true" /></Link>
            </nav>
          </div>
        </header>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex justify-center"><PlatformBadge platform={platform} size={64} /></div>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.03em] text-ink capitalize flex items-center justify-center gap-2" style={{fontFamily:"var(--font-sora)"}}><PlatformIcon platform={platform} size={18} />{platform} wall — empty</h1>
          <p className="mt-2 font-mono text-[13px] leading-6 text-stone">No report found for this platform. Run an intake from the console.</p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-amber text-ink font-mono text-[13px] font-bold px-6 hover:bg-amber/90 active:scale-[0.98] shadow-pin-amber transition-all cursor-pointer">
            ← Go to console
          </Link>
        </div>
      </div>
    );
  }

  const videoMap: Record<string, { url: string; metric: string }> = {};
  report.videos.forEach((v, i) => {
    const metric = v.platform === "meta" ? `${v.daysRunning} days` : `${v.views.toLocaleString('en-US')} views`;
    videoMap[`V${i + 1}`] = { url: v.url, metric: `@${v.author} · ${metric}` };
  });

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Nav — lab header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 border-b border-line" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-[10px] bg-ink grid place-items-center text-amber text-[11px] font-bold font-mono shadow-pin group-hover:shadow-[0_4px_12px_rgba(10,10,11,0.12)] transition-shadow shrink-0">WV</div>
              <div className="hidden sm:block leading-none">
                <div className="font-mono text-[12px] font-bold tracking-[0.14em] text-ink">WHYVIRAL <span className="font-normal text-stone/50 text-[10px] tracking-[0.08em]">/ WALL</span></div>
                <div className="font-mono text-[10px] tracking-[0.08em] text-stone/60 flex items-center gap-1.5"><PlatformIcon platform={platform} size={10} />{platform}</div>
              </div>
              <div className="sm:hidden font-mono text-[12px] font-bold tracking-[0.1em] text-ink">WHYVIRAL</div>
            </Link>
          <nav className="flex items-center gap-1.5" aria-label="Primary">
            <Link href="/" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">Console</Link>
            <Link href="/history" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">History</Link>
            <Link href="/settings" aria-label="Settings" className="h-8 w-8 grid place-items-center rounded-full bg-white border border-line text-stone hover:border-stone/30 hover:text-ink transition-colors"><Settings className="h-4 w-4" aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 font-mono text-[12px] font-medium text-stone hover:bg-paper hover:text-ink hover:border-stone/20 active:scale-[0.98] transition-all cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Console
          </Link>
          <a href={`/output/report-${platform}.json`} target="_blank" rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink text-white px-3.5 font-mono text-[12px] font-medium hover:bg-ink/90 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
            Raw JSON <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <span className="ml-auto font-mono text-[11px] text-stone/50 hidden sm:inline">© Manish Tiwari</span>
        </div>

        <ReportHeader report={report} />

        <ReportClient report={report} videoMap={videoMap} />

        <div className="rounded-[16px] border border-dashed border-line bg-paper/50 px-5 py-4 font-mono text-[11px] tracking-[0.06em] text-stone text-center">
          {report.videos.length} winners · <span className="font-medium text-ink">output/report-{platform}.json</span> · private · local — <span className="text-stone/60">wipe output/ to erase</span>
        </div>
      </main>
    </div>
  );
}
