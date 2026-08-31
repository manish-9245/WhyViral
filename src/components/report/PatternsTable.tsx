"use client";
import { useState } from "react";
import { ChevronDown, ExternalLink, Pin } from "lucide-react";
import type { Patterns } from "@/lib/types";

const TOP_N = 5;

function Chip({ label, url, metric }: { label: string; url?: string; metric?: string }) {
  if (!url) return <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 font-mono text-[11px] font-medium cursor-default">{label}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" title={metric} aria-label={`Open ${label} — ${metric ?? ""}`} className="group inline-flex items-center gap-1 rounded-full bg-ink text-paper px-2.5 py-1.5 font-mono text-[11px] font-medium hover:bg-amber hover:text-ink active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1">
      <span className="h-1.5 w-1.5 rounded-full bg-amber group-hover:bg-ink shrink-0" aria-hidden="true" /> {label} <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 shrink-0" aria-hidden="true" />
    </a>
  );
}

function ClusterCell({ cluster, videoMap }: { cluster: Record<string, unknown> | undefined; videoMap: Record<string, { url: string; metric: string }> }) {
  const [open, setOpen] = useState(false);
  if (!cluster) return <td className="p-6 text-center font-mono text-[12px] text-stone">—</td>;
  const members = (cluster.members as Array<{ label: string; verbatim: string }>) || [];
  const placement = cluster.placement as string | undefined;
  return (
    <td className="align-top p-4 bg-white border border-line">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 h-2 w-2 rounded-full bg-amber ring-1 ring-ink/10 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {placement && <div className={`inline-flex rounded-full px-2 py-1 font-mono text-[10px] font-medium tracking-[0.08em] border mb-2 ${placement==="hook" ? "bg-amber text-ink border-amber" : "bg-white border-line text-stone"}`}>{placement.toUpperCase()}</div>}
          <div className="font-display text-[13px] leading-5 font-semibold tracking-[-0.02em]" style={{fontFamily:"var(--font-sora)"}}>{cluster.theme as string}</div>
          <div className="mt-1 font-mono text-[11px] font-medium tracking-[0.06em] text-stone">{cluster.count as number} TAPES</div>
          {members.length > 0 && (
            <div className="mt-3">
              <button
                onClick={()=>setOpen(v=>!v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 min-h-[32px] px-2 -mx-2 rounded-lg font-mono text-[12px] font-medium text-ink hover:text-amber hover:bg-amber/10 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" /> {members.length} members — {open ? "hide" : "see all"}
              </button>
              {open && (
                <div className="mt-2 space-y-2 motion-safe:animate-[log-in_340ms_cubic-bezier(0.16,1,0.3,1)]">
                  {members.map(m=> (
                    <div key={m.label} className="flex items-start gap-2 rounded-[10px] border border-dashed border-line bg-paper p-2.5">
                      <Chip label={m.label} url={videoMap[m.label]?.url} metric={videoMap[m.label]?.metric} />
                      <span className="flex-1 font-mono text-[11px] leading-4 italic">“{m.verbatim}”</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </td>
  );
}

function ClosedCell({ row, videoMap }: { row: Record<string, unknown> | undefined; videoMap: Record<string, { url: string; metric: string }> }) {
  if (!row) return <td className="p-6 text-center font-mono text-[12px] text-stone">—</td>;
  const evidence = (row.evidence as string[]) || [];
  return (
    <td className="align-top p-4 bg-white border border-line">
      <div className="flex items-start gap-2" aria-hidden="true">
        <span className="mt-1 h-1.5 w-8 rounded-full bg-ink/10 overflow-hidden flex"><span className="h-full bg-amber transition-all duration-500" style={{width:`${Math.min(100, (row.count as number)*18)}%`}} /></span>
      </div>
      <div className="mt-2 font-display text-[13px] leading-5 font-semibold tracking-[-0.02em]" style={{fontFamily:"var(--font-sora)"}}>{row.value as string}</div>
      <div className="mt-1 font-mono text-[11px] font-medium tracking-[0.06em] text-stone">{row.count as number} TAPES</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {evidence.map(l=> <Chip key={l} label={l} url={videoMap[l]?.url} metric={videoMap[l]?.metric} />)}
      </div>
    </td>
  );
}

export function PatternsTable({ patterns, videoMap }: { patterns: Patterns | null; videoMap: Record<string, { url: string; metric: string }> }) {
  if (!patterns) return <div className="rounded-[16px] border border-dashed border-line bg-paper p-6 text-center"><p className="font-mono text-[13px] font-medium text-stone">Too few tapes for a wall — need 5+ to pin patterns.</p><p className="font-mono text-[11px] text-stone/60 mt-1">Run with <span className="font-medium text-ink">--count 5</span> or more.</p></div>;

  const hookVisual = (patterns as unknown as Record<string, unknown>).hookVisual as Record<string, unknown>[] | undefined || [];
  const hookSpoken = (patterns as unknown as Record<string, unknown>).hookSpoken as Record<string, unknown>[] | undefined || [];
  const hookText = (patterns as unknown as Record<string, unknown>).hookText as Record<string, unknown>[] | undefined || [];
  const other = (patterns as unknown as Record<string, unknown>).otherPatterns as Record<string, unknown>[] | undefined || [];
  const closed = (patterns as unknown as Record<string, unknown>).closed as Record<string, unknown> | undefined;

  const columns = [
    { header: "Hook visuals", kind: "cluster", source: hookVisual },
    { header: "Hook spoken", kind: "cluster", source: hookSpoken },
    { header: "Hook on-screen", kind: "cluster", source: hookText },
    { header: "Formats", kind: "closed", source: (closed?.format as unknown[]) || [] },
    { header: "Tones", kind: "closed", source: (closed?.tone as unknown[]) || [] },
    { header: "Other", kind: "cluster", source: other },
  ];

  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 bg-ink text-paper px-5 sm:px-6 min-h-[44px] py-2">
        <span className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.08em]"><Pin className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> WALL — PATTERNS · 6 dims × {TOP_N} pins</span>
        <span className="hidden sm:inline-flex font-mono text-[11px] tracking-[0.06em] opacity-60">every pin links to its tape — Manish Tiwari</span>
      </div>
      <div className="px-5 sm:px-6 py-2.5 bg-paper border-b border-line flex items-center gap-2 font-mono text-[12px] font-medium text-stone">
        <span className="h-2 w-2 rounded-full bg-amber shrink-0" aria-hidden="true" /> Top {TOP_N} per column · expand members to verify clustering · string = same intent
      </div>

      {/* Mobile: stacked evidence bags */}
      <div className="md:hidden p-4 space-y-6">
        {columns.map(c=> (
          <div key={c.header}>
            <div className="font-mono text-[11px] font-medium tracking-[0.08em] text-ink flex items-center gap-1.5"><span className="h-1 w-6 bg-amber" aria-hidden="true" /> {c.header.toUpperCase()}</div>
            <div className="mt-3 grid gap-3">
              {Array.from({length:TOP_N}).map((_,r)=>{
                const item = (c.source as unknown[])[r] as Record<string,unknown>|undefined;
                if(!item) return <div key={r} className="rounded-[12px] border border-dashed border-line p-4 text-center font-mono text-[12px] text-stone">—</div>;
                return <div key={r} className="rounded-[12px] border border-line overflow-hidden">{c.kind==="cluster" ? <table className="w-full"><tbody><tr><ClusterCell cluster={item} videoMap={videoMap} /></tr></tbody></table> : <table className="w-full"><tbody><tr><ClosedCell row={item} videoMap={videoMap} /></tr></tbody></table>}</div>;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: string board table */}
      <div className="hidden md:block overflow-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">Evidence wall — top {TOP_N} patterns across 6 dimensions</caption>
          <thead>
            <tr>
              {columns.map(c=> (
                <th key={c.header} scope="col" className="bg-ink text-paper font-mono text-[11px] font-medium tracking-[0.08em] text-left px-4 py-3 border border-white/10 whitespace-nowrap">
                  {c.header.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({length:TOP_N}).map((_,r)=> (
              <tr key={r} className="align-top">
                {columns.map(c=>{
                  const item = (c.source as unknown[])[r] as Record<string,unknown>|undefined;
                  if(!item) return <td key={c.header} className="p-6 text-center font-mono text-[12px] text-stone border border-line bg-paper">—</td>;
                  return c.kind==="cluster" ? <ClusterCell key={c.header} cluster={item} videoMap={videoMap} /> : <ClosedCell key={c.header} row={item} videoMap={videoMap} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 sm:px-6 py-3 bg-paper border-t border-line font-mono text-[11px] text-stone flex items-center justify-between gap-4">
        <span className="font-medium">© Manish Tiwari — WhyViral · Built with proof</span>
        <span className="hidden sm:inline text-stone/60">Lab No. 002 · every pin is a timestamped source</span>
      </div>
    </div>
  );
}
