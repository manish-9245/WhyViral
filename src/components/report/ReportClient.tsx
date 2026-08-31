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
        <div className="flex-1 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone pointer-events-none" aria-hidden="true" />
          <label htmlFor="report-search" className="sr-only">Search tapes</label>
          <input id="report-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search hook, spoken, visual, author, caption…" aria-label="Search tapes by hook, author or caption" className="w-full h-11 pl-10 pr-16 rounded-[12px] border border-line bg-white font-mono text-[13px] placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-amber/20 focus:border-amber transition-colors" />
          {q && <button onClick={()=>setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2.5 rounded-full bg-stone-100 font-mono text-[11px] font-medium text-stone hover:bg-stone-200 hover:text-ink transition-colors cursor-pointer">Clear</button>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-white border border-line p-1 h-11">
            <Filter className="h-3.5 w-3.5 ml-2.5 text-stone" aria-hidden="true" />
            <label htmlFor="format-filter" className="sr-only">Filter by format</label>
            <select id="format-filter" value={formatFilter} onChange={e=>setFormatFilter(e.target.value)} className="bg-transparent font-mono text-[12px] font-medium pr-6 pl-1 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-amber cursor-pointer">
              {formats.map(f=> <option key={f} value={f}>{f==="all" ? "All formats" : f}</option>)}
            </select>
          </div>
          <button onClick={copyAllVerbatims} aria-live="polite" className="h-11 px-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-white font-mono text-[12px] font-medium hover:bg-paper hover:border-stone/20 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
            {copied==="all" ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />} {copied==="all" ? "Copied" : "Copy filtered"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/export?platform=${report.platform}&format=csv`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink text-paper px-4 font-mono text-[12px] font-medium hover:bg-ink/90 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"><Download className="h-3.5 w-3.5" aria-hidden="true" /> CSV</a>
        <a href={`/api/export?platform=${report.platform}&format=md`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-4 font-mono text-[12px] font-medium hover:bg-paper hover:border-stone/20 active:scale-[0.98] transition-all cursor-pointer">MD</a>
        <a href={`/api/export?platform=${report.platform}&format=json`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-4 font-mono text-[12px] font-medium hover:bg-paper hover:border-stone/20 active:scale-[0.98] transition-all cursor-pointer">JSON</a>
        <span className="ml-auto font-mono text-[12px] font-medium text-stone tabular-nums" aria-live="polite">{filtered.length} of {report.videos.length} tapes · {q ? `for "${q}"` : "all"}{formatFilter!=="all" ? ` · ${formatFilter}` : ""}</span>
      </div>

      <section aria-labelledby="patterns-heading">
        <div className="flex items-baseline gap-3">
          <h2 id="patterns-heading" className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{fontFamily:"var(--font-sora)"}}>Wall — Patterns</h2>
          <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-stone">6 DIMS × 5 PINS</span>
        </div>
        <div className="mt-4"><PatternsTable patterns={report.patterns} videoMap={videoMap} /></div>
      </section>

      <section aria-labelledby="tapes-heading">
        <div className="flex items-baseline gap-3">
          <h2 id="tapes-heading" className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{fontFamily:"var(--font-sora)"}}>Evidence — Tapes</h2>
          <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-stone tabular-nums">{filtered.length} BAGS</span>
        </div>
        <div className="mt-4 space-y-3">
          {filtered.length ? filtered.map(({ v, a })=> {
            const origIdx = report.videos.indexOf(v);
            return <VideoCard key={v.id || String(origIdx)} video={v} analysis={a} label={`V${origIdx+1}`} />;
          }) : <div className="rounded-[16px] border border-dashed border-line bg-paper p-8 text-center"><p className="font-mono text-[13px] font-medium text-stone">No tapes match “{q}” {formatFilter!=="all" && `in ${formatFilter}`}</p><button onClick={()=>{setQ(""); setFormatFilter("all");}} className="mt-2 inline-flex h-8 px-3 rounded-full bg-ink text-white font-mono text-[12px] font-medium cursor-pointer hover:bg-ink/90">clear filters</button></div>}
        </div>
      </section>
    </div>
  );
}
