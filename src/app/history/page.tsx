"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ExternalLink, Settings } from "lucide-react";
import { PlatformBadge, PlatformIcon } from "@/components/PlatformIcon";

type Run = { file: string; platform: string; keyword: string; videos: number; date: string; rankBy: string };

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((j) => { setRuns(j.runs || []); setLoading(false); })
      .catch(() => { setRuns([]); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Nav — lab header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 border-b border-line" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-[10px] bg-ink grid place-items-center text-amber text-[11px] font-bold font-mono shadow-pin group-hover:shadow-[0_4px_12px_rgba(10,10,11,0.12)] transition-shadow">WV</div>
            <div className="hidden sm:block leading-none">
              <div className="font-mono text-[12px] font-bold tracking-[0.14em] text-ink">WHYVIRAL <span className="font-normal text-stone/50 text-[10px] tracking-[0.08em]">/ ARCHIVE</span></div>
              <div className="font-mono text-[10px] tracking-[0.08em] text-stone/60">History — local only</div>
            </div>
            <div className="sm:hidden font-mono text-[12px] font-bold tracking-[0.1em] text-ink">WHYVIRAL</div>
          </Link>
          <nav className="flex items-center gap-1.5" aria-label="Primary">
            <Link href="/" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">Console</Link>
            <Link href="/history" aria-current="page" className="h-8 px-4 inline-flex items-center justify-center rounded-full bg-ink text-white font-mono text-[12px] font-medium">History</Link>
            <Link href="/settings" aria-label="Settings" className="h-8 w-8 grid place-items-center rounded-full bg-white border border-line text-stone hover:border-stone/30 hover:text-ink transition-colors"><Settings className="h-4 w-4" aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="font-display text-[30px] font-bold tracking-[-0.04em] text-ink" style={{fontFamily:"var(--font-sora)"}}>History</h1>
            <p className="font-mono text-[13px] leading-5 text-stone mt-1">{runs.length} wall{runs.length !== 1 ? "s" : ""} · <span className="text-stone/60">private, in output/</span></p>
          </div>
          <Link href="/" className="h-10 px-5 rounded-full bg-amber text-ink font-mono text-[13px] font-bold inline-flex items-center gap-2 hover:bg-amber/90 active:scale-[0.98] shadow-pin-amber transition-all shrink-0 cursor-pointer">
            <Archive className="h-4 w-4" aria-hidden="true" /> New intake
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] rounded-[16px] bg-white border border-line animate-pulse" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed border-line bg-white p-10 sm:p-14 text-center shadow-sm">
            <div className="h-14 w-14 rounded-[16px] bg-paper border border-line grid place-items-center mx-auto"><Archive className="h-6 w-6 text-stone/40" aria-hidden="true" /></div>
            <div className="mt-4 font-display text-[18px] font-semibold tracking-[-0.02em] text-ink" style={{fontFamily:"var(--font-sora)"}}>No walls yet</div>
            <p className="mt-1 font-mono text-[12px] leading-5 text-stone max-w-[32ch] mx-auto">Run an intake from the console. Each wall is a pinned string board — local, private, file-based.</p>
            <Link href="/" className="mt-5 inline-flex h-10 px-5 rounded-full bg-ink text-white font-mono text-[12px] font-semibold items-center gap-2 hover:bg-ink/90 active:scale-[0.98] transition-all">
              Go to console →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((r) => (
              <Link key={r.file} href={`/report/${r.platform}`}
                className="flex items-center gap-4 rounded-[16px] border border-line bg-white px-5 py-4 hover:border-stone/20 hover:shadow-evidence active:scale-[0.99] transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
                <PlatformBadge platform={r.platform} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[13px] font-semibold tracking-[-0.01em] text-ink truncate">{r.keyword}</div>
                  <div className="font-mono text-[11px] font-medium text-stone mt-0.5 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />{r.videos} tapes · {r.date} · {r.platform}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex font-mono text-[11px] font-medium text-stone border border-line rounded-full px-2.5 py-1 capitalize items-center gap-1.5 bg-paper"><PlatformIcon platform={r.platform} size={11} />{r.platform}</span>
                  <span className="hidden sm:grid h-8 w-8 place-items-center rounded-full border border-line bg-white group-hover:border-amber/30 group-hover:bg-amber/10 text-stone group-hover:text-amber-700 transition-colors"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {runs.length > 0 && (
          <div className="mt-6 font-mono text-[11px] tracking-[0.06em] text-stone/50 text-center">
            Files live in <span className="font-medium text-stone">output/report-*.json</span> · private · local · <span className="text-stone">no cloud</span>
          </div>
        )}
      </main>
    </div>
  );
}
