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
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone/10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-ink grid place-items-center text-amber text-[10px] font-bold font-mono">WV</div>
            <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-ink hidden sm:block">WHYVIRAL</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50 transition-colors">Console</Link>
            <Link href="/history" className="h-8 px-3 flex items-center rounded-lg bg-stone-100 font-mono text-[11px]">History</Link>
            <Link href="/settings" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50 transition-colors">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">History</h1>
            <p className="font-mono text-[12px] text-stone/60 mt-1">{runs.length} wall{runs.length !== 1 ? "s" : ""} · local only</p>
          </div>
          <Link href="/" className="h-9 px-4 rounded-lg bg-amber text-ink font-mono text-[11px] font-semibold flex items-center gap-2 hover:bg-amber/90 transition-colors">
            <Archive className="h-3.5 w-3.5" /> New run
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white border border-stone/10 animate-pulse" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-stone/20 bg-white p-16 text-center">
            <Archive className="h-10 w-10 mx-auto text-stone/20" />
            <p className="mt-3 font-mono text-[13px] text-stone/60">No walls yet.</p>
            <p className="mt-1 font-mono text-[11px] text-stone/40">Run a search from the console to see walls here.</p>
            <Link href="/" className="mt-4 inline-flex h-9 px-5 rounded-lg bg-ink text-white font-mono text-[11px] font-medium items-center gap-2 hover:bg-ink/90 transition-colors">
              Go to console →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Link key={r.file} href={`/report/${r.platform}`}
                className="flex items-center gap-4 rounded-xl border border-stone/10 bg-white px-5 py-4 hover:border-stone/20 hover:shadow-sm transition-all group">
                <PlatformBadge platform={r.platform} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[13px] font-semibold text-ink truncate">{r.keyword}</div>
                  <div className="font-mono text-[11px] text-stone/50 mt-0.5">{r.videos} tapes · {r.date}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10px] text-stone/60 border border-stone/10 rounded-full px-2.5 py-1 capitalize flex items-center gap-1.5"><PlatformIcon platform={r.platform} size={11} />{r.platform}</span>
                  <ExternalLink className="h-4 w-4 text-stone/30 group-hover:text-amber-600 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {runs.length > 0 && (
          <div className="mt-6 font-mono text-[11px] text-stone/40 text-center">
            Files live in <span className="text-stone/60">output/report-*.json</span> · private, local, no cloud
          </div>
        )}
      </div>
    </div>
  );
}
