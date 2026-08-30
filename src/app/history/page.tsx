"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Clock, Eye } from "lucide-react";

type Run = { file:string; platform:string; keyword:string; videos:number; date:string; mtime:string; rankBy:string };

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history").then(r=>r.json()).then(j=>{ setRuns(j.runs || []); setLoading(false); }).catch(()=>{ setRuns([]); setLoading(false); });
  }, []);

  if (loading) return <div className="font-mono text-[13px] text-stone p-8">Loading history…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-[12px] border border-line bg-white overflow-hidden">
        <div className="h-9 flex items-center px-6 bg-ink text-paper font-mono text-[10px] tracking-[0.12em]">ARCHIVE — RUN HISTORY · {runs?.length || 0} WALLS</div>
        <div className="p-6">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]" style={{fontFamily:"var(--font-sora)"}}>History</h1>
          <p className="mt-1 font-mono text-[12px] text-stone">Every run is a wall in <span className="text-ink font-medium">output/report-*.json</span> — local, private, file-based.</p>
          {!runs || runs.length===0 ? (
            <div className="mt-6 rounded-[12px] border border-dashed border-line bg-paper p-8 text-center">
              <Archive className="h-6 w-6 mx-auto text-stone" />
              <div className="mt-2 font-mono text-[13px] font-medium">No walls yet</div>
              <div className="mt-1 font-mono text-[11px] text-stone">Run from the bench — <Link href="/" className="text-ink underline">Go to console</Link></div>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {runs.map(r=> (
                <div key={r.file} className="flex items-center gap-4 rounded-[12px] border border-line bg-white p-4 hover:border-ink/15 hover:shadow-evidence transition-all">
                  <div className="h-10 w-10 rounded-[8px] bg-ink text-paper grid place-items-center font-mono text-[11px] font-bold">{r.platform.slice(0,2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[14px] font-semibold leading-4 truncate" style={{fontFamily:"var(--font-sora)"}}>{r.keyword}</div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-stone">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.date}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {r.videos} tapes</span>
                      <span className="hidden sm:inline">· {r.rankBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link href={`/report/${r.platform}`} className="h-8 px-3 inline-flex items-center rounded-full bg-ink text-paper font-mono text-[11px] font-medium">Open</Link>
                    <a href={`/api/export?platform=${r.platform}&format=csv`} className="hidden sm:inline-flex h-8 px-3 items-center rounded-full border border-line bg-white font-mono text-[11px]">CSV</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-3 bg-secondary/50 border-t border-line flex items-center justify-between font-mono text-[11px] text-stone">
          <span>Local only — no cloud. Files in <span className="text-ink">output/</span></span>
          <span className="hidden sm:inline">© Manish Tiwari</span>
        </div>
      </div>
      <div className="rounded-[12px] border border-line bg-paper p-4 font-mono text-[11px] leading-5 text-stone">
        <span className="font-medium text-ink">Tip:</span> Compare walls — open two reports and diff the <span className="text-ink">Formats</span> + <span className="text-ink">Hooks</span> tables.
      </div>
    </div>
  );
}
