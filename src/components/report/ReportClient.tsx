"use client";
import { useState, useMemo } from "react";
import { VideoCard } from "./VideoCard";
import { PatternsTable } from "./PatternsTable";
import type { ArchiveReport } from "@/lib/types";
import { Search, Download, Copy, Check, Filter } from "lucide-react";

export function ReportClient({ report, videoMap }: { report: ArchiveReport; videoMap: Record<string, { url: string; metric: string }> }) {
  const [q, setQ] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);

  const formats = useMemo(() => {
    const s = new Set<string>();
    report.analyses.forEach(a => { if (a?.format) s.add(a.format); });
    return ["all", ...Array.from(s)];
  }, [report.analyses]);

  const filtered = useMemo(() => {
    const lower = q.toLowerCase().trim();
    return report.videos.map((v, i) => ({ v, a: report.analyses[i], idx: i }))
      .filter(({ v, a }) => {
        if (formatFilter !== "all" && a?.format !== formatFilter) return false;
        if (!lower) return true;
        const hay = `${v.caption} ${v.author} ${a?.hook?.spoken || ""} ${a?.hook?.visual || ""} ${a?.hook?.on_screen_text || ""} ${a?.format || ""} ${a?.tone || ""} ${a?.why_it_works || ""}`.toLowerCase();
        return hay.includes(lower);
      });
  }, [q, formatFilter, report.videos, report.analyses]);

  async function copyAllVerbatims() {
    const lines = filtered.map(({ v, a }) => `V${report.videos.indexOf(v)+1} @${v.author}: spoken="${a?.hook?.spoken || "none"}" | visual="${a?.hook?.visual || "none"}" | text="${a?.hook?.on_screen_text || "none"}" | ${v.url}`).join("\n");
    await navigator.clipboard.writeText(lines);
    setCopied("all");
    setTimeout(()=>setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search hook, spoken, visual, author, caption…" className="w-full h-10 pl-9 pr-3 rounded-[8px] border border-line bg-white font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-amber/20 focus:border-amber" />
          {q && <button onClick={()=>setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-stone hover:text-ink">Clear</button>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-secondary border border-line p-1">
            <Filter className="h-3 w-3 ml-2 text-stone" />
            <select value={formatFilter} onChange={e=>setFormatFilter(e.target.value)} className="bg-transparent font-mono text-[11px] pr-2 focus:outline-none">
              {formats.map(f=> <option key={f} value={f}>{f==="all" ? "All formats" : f}</option>)}
            </select>
          </div>
          <button onClick={copyAllVerbatims} className="h-10 px-3 inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-white font-mono text-[11px] font-medium hover:bg-paper">
            {copied==="all" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied==="all" ? "Copied" : "Copy filtered"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`/api/export?platform=${report.platform}&format=csv`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink text-paper px-3 font-mono text-[11px] font-medium"><Download className="h-3 w-3" /> CSV</a>
        <a href={`/api/export?platform=${report.platform}&format=md`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 font-mono text-[11px]">MD</a>
        <a href={`/api/export?platform=${report.platform}&format=json`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 font-mono text-[11px]">JSON</a>
        <span className="ml-auto font-mono text-[11px] text-stone">{filtered.length} of {report.videos.length} tapes · {q ? `for "${q}"` : "all"}{formatFilter!=="all" ? ` · ${formatFilter}` : ""}</span>
      </div>

      <div>
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{fontFamily:"var(--font-sora)"}}>Wall — Patterns</h2>
          <span className="font-mono text-[10px] tracking-[0.12em] text-stone">6 DIMS × 5 PINS</span>
        </div>
        <div className="mt-4"><PatternsTable patterns={report.patterns} videoMap={videoMap} /></div>
      </div>

      <div>
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{fontFamily:"var(--font-sora)"}}>Evidence — Tapes</h2>
          <span className="font-mono text-[10px] tracking-[0.12em] text-stone">{filtered.length} BAGS</span>
        </div>
        <div className="mt-4 space-y-3">
          {filtered.length ? filtered.map(({ v, a })=> {
            const origIdx = report.videos.indexOf(v);
            return <VideoCard key={v.id || String(origIdx)} video={v} analysis={a} label={`V${origIdx+1}`} />;
          }) : <div className="rounded-[12px] border border-dashed border-line bg-paper p-8 text-center font-mono text-[13px] text-stone">No tapes match “{q}” {formatFilter!=="all" && `in ${formatFilter}`} — <button onClick={()=>{setQ(""); setFormatFilter("all");}} className="text-ink underline">clear filters</button></div>}
        </div>
      </div>
    </div>
  );
}
