"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, Play, CheckCircle2, AlertTriangle, SlidersHorizontal, ExternalLink, RefreshCw, X, ChevronDown, ChevronUp, Archive, Settings, FlaskConical, FileSearch, Sparkles } from "lucide-react";
import { PlatformIcon, PlatformBadge } from "@/components/PlatformIcon";

type Stage = "scrape" | "prescreen" | "watch" | "deep" | "synth";
type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";
type CheckResult = { service: string; ok: boolean; message: string };
type RunCost = { platform: string; pool: number; apifyUsd: number; tier1Calls: number; tier1Inr: number; tier2Calls: number; tier2Inr: number; synthRan: boolean; synthInr: number; cacheHits: number };
type RunWarn = { stage: string; severity: "warn" | "block"; message: string; advice: string };
type RunEntry = { file: string; keyword: string; platform: string; videos: number; date: string; rankBy: string };
type PipelineData = {
  platform: string;
  stages: Stage[];
  statuses: Record<Stage, StageStatus> | null;
  state: { lastCompleted: Stage | null; failedAt: Stage | null; failureReason: string | null; updatedAt: string } | null;
  reportMeta: { keyword: string; videoCount: number; date: string } | null;
} | null;

const STAGES: { id: Stage; label: string; sub:string }[] = [
  { id: "scrape", label: "Scrape", sub:"collect" },
  { id: "prescreen", label: "Scan", sub:"filter" },
  { id: "watch", label: "Watch", sub:"analyze" },
  { id: "deep", label: "Deep", sub:"script" },
  { id: "synth", label: "Wall", sub:"cluster" },
];

function StageDot({ status, label, sub, onRerun }: { status: StageStatus; label: string; sub:string; onRerun?: () => void }) {
  const isRunning = status === "running";
  const isDone = status === "done";
  const isFailed = status === "failed";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative h-7 w-7 rounded-full grid place-items-center shrink-0 border transition-all duration-300 ${isDone ? "bg-emerald-500 border-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]" : isFailed ? "bg-red-500 border-red-600 text-white" : isRunning ? "bg-amber border-amber text-ink shadow-pin-amber motion-safe:animate-pulse" : "bg-white border-line text-stone"}`} aria-hidden="true">
        {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : isFailed ? <AlertTriangle className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-stone/40" />}
        {isRunning && <span className="absolute -inset-1 rounded-full border border-amber/30 motion-safe:animate-ping" aria-hidden="true" />}
      </div>
      <div className="leading-none">
        <div className={`font-mono text-[12px] font-semibold tracking-[-0.01em] ${isDone ? "text-emerald-700" : isFailed ? "text-red-600" : isRunning ? "text-ink" : "text-stone"}`}>{label}</div>
        <div className="font-mono text-[10px] tracking-[0.06em] text-stone/60 hidden sm:block">{sub}</div>
      </div>
      {(isDone || isFailed) && onRerun && (
        <button onClick={onRerun} aria-label={`Retry ${label}`} className="ml-1 hidden sm:inline-flex items-center h-6 px-2 rounded-full border border-amber/30 bg-amber/10 text-amber-800 font-mono text-[10px] font-medium hover:bg-amber hover:text-ink hover:border-amber transition-colors cursor-pointer">↻</button>
      )}
    </div>
  );
}

export type PlatformId = "tiktok" | "instagram" | "meta" | "youtube" | "twitter" | "pinterest" | "reddit" | "linkedin" | "snapchat" | "all";
export default function HomePage() {
  const [keyword, setKeyword] = useState("");
  const [platform, setPlatform] = useState<PlatformId>("tiktok");
  const [count, setCount] = useState(5);
  const [viewFloor, setViewFloor] = useState(100000);
  const [rankBy, setRankBy] = useState<"engagement" | "reach" | "views">("engagement");
  const [language, setLanguage] = useState<"en" | "id" | "any">("en");
  const [country, setCountry] = useState<"US" | "GB" | "AU" | "IN" | "CA" | "ALL">("US");
  const [deepCount, setDeepCount] = useState(8);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [_runStage, setRunStage] = useState<Stage | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [reportLinks, setReportLinks] = useState<string[]>([]);
  const [runCosts, setRunCosts] = useState<RunCost[]>([]);
  const [warns, setWarns] = useState<RunWarn[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData>(null);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [keysOpen, setKeysOpen] = useState(false);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?platform=${platform}`);
      if (res.ok) setPipeline(await res.json());
    } catch { setPipeline(null); }
  }, [platform]);

  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await fetch("/api/history");
      const j = await res.json();
      setRuns(j.runs || []);
    } catch { setRuns([]); }
    setRunsLoading(false);
  }, []);

  useEffect(() => { fetchPipeline(); fetchRuns(); }, [fetchPipeline, fetchRuns]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(fetchPipeline, 4000);
    return () => clearInterval(id);
  }, [running, fetchPipeline]);

  async function handleRun(opts?: { resume?: boolean; stage?: Stage; clearState?: boolean }) {
    if (running) return;
    setRunning(true);
    setRunLog([]);
    setReportLinks([]);
    setRunCosts([]);
    setWarns([]);
    setRunStage(opts?.stage || null);
    setLogOpen(true);
    const body: Record<string, unknown> = {
      keywords: keyword.split(",").map((s) => s.trim()).filter(Boolean),
      platform, count, viewFloor, rankBy, language, country, deepCount,
    };
    if (opts?.resume) body.resume = true;
    if (opts?.stage) body.stage = opts.stage;
    if (opts?.clearState) body.clearState = true;
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "log") setRunLog((l) => [...l, evt.message]);
            if (evt.type === "done") { setReportLinks(evt.reports || []); fetchRuns(); }
            if (evt.type === "cost") setRunCosts((c) => [...c, evt as RunCost]);
            if (evt.type === "warn" || evt.type === "error") setWarns((w) => [...w, evt as RunWarn]);
            if (evt.type === "state") fetchPipeline();
          } catch { setRunLog((l) => [...l, line]); }
        }
      }
    } catch { setWarns((w) => [...w, { stage: "network", severity: "block", message: "Workflow unreachable.", advice: "Restart the app with `npm run all`." }]); }
    finally { setRunning(false); setRunStage(null); fetchPipeline(); }
  }

  async function handleCheckKeys() {
    setChecking(true);
    setCheckResults(null);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      setCheckResults((await res.json()).results || []);
    } catch { setCheckResults([{ service: "error", ok: false, message: "Failed to reach server." }]); }
    setChecking(false);
  }

  const totalCost = runCosts.reduce((acc, c) => ({
    inr: acc.inr + c.tier1Inr + c.tier2Inr + c.synthInr,
    usd: acc.usd + c.apifyUsd,
    cache: acc.cache + c.cacheHits,
  }), { inr: 0, usd: 0, cache: 0 });

  const failedStage = pipeline?.state?.failedAt;
  const hasState = !!pipeline?.state;
  const hasWarn = warns.length > 0;
  const isAll = platform === "all";

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* ── Top nav — lab header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 border-b border-line" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-[10px] bg-ink grid place-items-center text-amber text-[11px] font-bold font-mono shadow-pin group-hover:shadow-[0_4px_12px_rgba(10,10,11,0.12)] transition-shadow">WV</div>
            <div className="hidden sm:block leading-none">
              <div className="font-mono text-[12px] font-bold tracking-[0.14em] text-ink flex items-center gap-2">WHYVIRAL <span className="font-normal text-stone/50 tracking-[0.08em] text-[10px]">/ LAB 002</span></div>
              <div className="font-mono text-[10px] tracking-[0.08em] text-stone/60">Evidence Archive — Manish Tiwari</div>
            </div>
            <div className="sm:hidden font-mono text-[12px] font-bold tracking-[0.1em] text-ink">WHYVIRAL</div>
          </Link>
          <nav className="flex items-center gap-1.5" aria-label="Primary">
            <Link href="/" aria-current="page" className="h-8 px-4 inline-flex items-center justify-center rounded-full bg-ink text-white font-mono text-[12px] font-medium">Console</Link>
            <Link href="/history" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">History</Link>
            <Link href="/history" className="h-8 w-8 grid place-items-center sm:hidden rounded-full text-stone hover:bg-stone-100"><Archive className="h-4 w-4" /></Link>
            <Link href="/settings" aria-label="Settings" className="h-8 w-8 grid place-items-center rounded-full bg-white border border-line text-stone hover:border-stone/30 hover:text-ink transition-colors"><Settings className="h-4 w-4" /></Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <h1 className="sr-only">WhyViral Console — AI content intelligence</h1>

        {/* ── Dossier — intake form, lab bench ── */}
        <div className="bg-white rounded-[24px] border border-line shadow-dossier overflow-hidden">
          {/* Dossier header — ink bench */}
          <div className="bg-ink text-paper px-5 sm:px-7 h-[44px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-2.5 py-1 font-mono text-[10px] tracking-[0.1em]"><span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" /> INTAKE DOSSIER</span>
              <span className="sm:hidden h-6 w-6 rounded-full bg-white/10 grid place-items-center"><FileSearch className="h-3.5 w-3.5 text-white/70" /></span>
              <span className="font-mono text-[11px] tracking-[0.08em] text-white/60 hidden lg:inline">CHAIN OF CUSTODY: VERIFIED</span>
              <span className="h-3 w-px bg-white/15 hidden lg:block" aria-hidden="true" />
              <span className="font-mono text-[11px] text-white/80 truncate">Manish Tiwari — strategist</span>
            </div>
            <div className="hidden md:flex items-center gap-2 font-mono text-[10px] tracking-[0.08em] text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" /> LAB READY
            </div>
          </div>

          {/* Dossier body — two-column bench */}
          <div className="grid lg:grid-cols-[1.55fr_0.95fr] gap-0">
            {/* Left: subject + sources */}
            <div className="p-5 sm:p-7 lg:pr-6 space-y-6 lg:border-r border-line">
              {/* Subject */}
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <label htmlFor="keyword-input" className="font-mono text-[11px] font-semibold tracking-[0.08em] text-ink flex items-center gap-2">
                    <FlaskConical className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> SUBJECT — KEYWORD
                  </label>
                  <span className="font-mono text-[10px] tracking-[0.06em] text-stone/50 hidden sm:block">{keyword.trim() ? `${keyword.split(",").filter(Boolean).length} term${keyword.split(",").filter(Boolean).length!==1?"s":""}` : "comma separates · 2–3 words ideal"}</span>
                </div>
                <div className="relative group">
                  <input
                    id="keyword-input"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && keyword.trim() && !running) handleRun(); }}
                    placeholder="magnesium gummies, llm tutorial, knee pain"
                    autoComplete="off"
                    aria-required="true"
                    spellCheck={false}
                    className="w-full h-[52px] rounded-[14px] border-[1.5px] border-line bg-paper px-4 font-mono text-[15px] leading-none placeholder:text-stone/40 focus:outline-none focus:border-amber focus:ring-[3px] focus:ring-amber/15 focus:bg-white group-hover:border-stone/30 transition-all"
                  />
                  {keyword && !running && (
                    <button onClick={()=>setKeyword("")} aria-label="Clear keyword" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-full bg-white border border-line text-stone hover:text-ink hover:border-stone/30 transition-colors"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                <p className="font-mono text-[11px] leading-4 text-stone mt-2 hidden sm:block">We widen automatically on full runs (30+ tapes) — related terms, no drift. Every pin links back to its tape.</p>
              </div>

              {/* Sources — platform board */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="font-mono text-[11px] font-semibold tracking-[0.08em] text-ink flex items-center gap-2" id="platform-label">
                    <span className="h-2 w-2 rounded-full bg-amber" aria-hidden="true" /> SOURCES — {isAll ? "ALL 9" : platform.toUpperCase()}
                  </div>
                  <span className="font-mono text-[11px] text-stone/60 hidden sm:block">{isAll ? "parallel intake" : "single source"}</span>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="platform-label">
                  {([
                    ["tiktok","TikTok"],["instagram","Instagram"],["meta","Meta"],
                    ["youtube","YouTube"],["twitter","X"],["pinterest","Pinterest"],
                    ["reddit","Reddit"],["linkedin","LinkedIn"],["snapchat","Snapchat"],
                    ["all","All 9"],
                  ] as const).map(([val, label]) => {
                    const active = platform === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setPlatform(val as PlatformId)}
                        aria-pressed={active}
                        className={`relative h-9 px-3.5 rounded-full border font-mono text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1 ${active ? "bg-ink text-white border-ink shadow-pin" : "bg-white text-stone border-line hover:bg-paper hover:border-stone/30 hover:text-ink hover:shadow-sm"}`}
                      >
                        <PlatformIcon platform={val} size={14} />
                        {label}
                        {active && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 border border-amber/20 px-2.5 py-1 font-mono text-[11px] font-medium text-amber-800"><Sparkles className="h-3 w-3" aria-hidden="true" /> Ban-safe via Crawlee · jitter + 1 concurrency</span>
                  <span className="hidden sm:inline-flex items-center rounded-full bg-paper border border-line px-2.5 py-1 font-mono text-[11px] text-stone">TikWM cache for TikTok · no direct hits</span>
                </div>
              </div>
            </div>

            {/* Right: bench controls */}
            <div className="bg-paper/40 p-5 sm:p-7 lg:pl-6 space-y-5 border-t lg:border-t-0 border-line">
              {/* Target dial */}
              <div>
                <div className="font-mono text-[11px] font-semibold tracking-[0.08em] text-ink mb-3" id="target-label">SAMPLE — TARGET TAPES</div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-[14px] border border-line bg-white shadow-sm overflow-hidden" role="group" aria-labelledby="target-label">
                    <button onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Decrease target" className="h-[52px] w-[52px] grid place-items-center text-stone hover:text-ink hover:bg-paper active:bg-stone-100 transition-colors cursor-pointer text-[20px] font-light">−</button>
                    <div className="h-[52px] w-[72px] grid place-items-center bg-ink text-white font-mono text-[22px] font-bold tabular-nums tracking-[-0.02em] border-x border-line/50" aria-live="polite" aria-atomic="true">{String(count).padStart(2,"0")}</div>
                    <button onClick={() => setCount((c) => Math.min(100, c + 1))} aria-label="Increase target" className="h-[52px] w-[52px] grid place-items-center text-stone hover:text-ink hover:bg-paper active:bg-stone-100 transition-colors cursor-pointer text-[20px] font-light">+</button>
                  </div>
                  <div className="hidden sm:block leading-none">
                    <div className="font-mono text-[11px] tracking-[0.06em] text-stone">TAPES</div>
                    <div className="font-mono text-[11px] text-stone/60">5 → wall ready</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white border border-line overflow-hidden flex">
                  <div className="h-full bg-amber transition-all duration-700" style={{ width: `${Math.min(100, (count/20)*100)}%` }} />
                </div>
              </div>

              {/* Run — bench press */}
              <div>
                <button
                  onClick={() => handleRun()}
                  disabled={running || !keyword.trim()}
                  aria-busy={running}
                  className="w-full h-[52px] rounded-[14px] bg-amber text-ink font-mono text-[14px] font-bold tracking-[-0.01em] inline-flex items-center justify-center gap-2.5 hover:bg-amber/90 active:bg-amber active:scale-[0.985] disabled:opacity-40 disabled:cursor-not-allowed shadow-pin-amber transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                >
                  {running ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Running — streaming log…</> : <><Play className="h-4 w-4 fill-ink" aria-hidden="true" /> Run intake</>}
                </button>
                <div className="mt-2.5 flex items-center justify-between gap-3 font-mono text-[11px]">
                  <span className="text-stone/60 hidden sm:inline">⏎ Enter to run · resume from pipeline if failed</span>
                  <span className="text-stone hidden sm:inline tabular-nums">~₹{Math.round(count*2.5 + deepCount*10)} + ${(Math.max(count*12,300)*0.0026).toFixed(2)} estim.</span>
                </div>
              </div>

              {/* Mini cost + pipeline teaser */}
              <div className="rounded-[14px] bg-white border border-line p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-ink grid place-items-center text-amber shrink-0"><FileSearch className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-ink">PIPELINE — 5 STAGES</div>
                    <div className="font-mono text-[11px] text-stone truncate hidden sm:block">Scrape → Scan → Watch → Deep → Wall</div>
                    <div className="font-mono text-[11px] text-stone sm:hidden">{pipeline?.state ? "has state · resume" : "fresh run"}</div>
                  </div>
                </div>
                <button onClick={fetchPipeline} aria-label="Refresh pipeline" className="h-8 w-8 grid place-items-center rounded-full border border-line bg-white text-stone hover:bg-paper hover:text-ink transition-colors shrink-0"><RefreshCw className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          {/* Advanced — collapsible bench drawer */}
          <div className="border-t border-line">
            <button
              onClick={() => setAdvancedOpen((o) => !o)}
              className="w-full min-h-[44px] px-5 sm:px-7 flex items-center justify-between gap-4 font-mono text-[11px] font-medium tracking-[0.06em] text-stone hover:text-ink hover:bg-paper/60 transition-colors cursor-pointer"
              aria-expanded={advancedOpen}
              aria-controls="advanced-panel"
            >
              <span className="flex items-center gap-2.5 truncate">
                <span className="h-7 w-7 rounded-full bg-white border border-line grid place-items-center shrink-0"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span className="hidden sm:inline">ADVANCED — rank</span><span className="sm:hidden">ADVANCED</span>
                <span className="hidden sm:inline text-stone/40">·</span>
                <span className="truncate text-stone/60 hidden sm:inline">{rankBy} · ≥{viewFloor >= 1000000 ? `${viewFloor/1000000}M` : `${viewFloor/1000}K`} views · {language} · {country} · deep {deepCount}</span>
              </span>
              <span className={`h-7 w-7 rounded-full border grid place-items-center transition-colors shrink-0 ${advancedOpen ? "bg-ink text-white border-ink" : "bg-white border-line text-stone"}`}>{advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
            </button>
            {advancedOpen && (
              <div id="advanced-panel" className="px-5 sm:px-7 pb-6 pt-4 grid grid-cols-2 lg:grid-cols-5 gap-4 border-t border-line bg-paper/30">
                <SelectField label="RANK BY" value={rankBy} options={[["engagement","Engagement"],["reach","Reach"],["views","Views"]]} onChange={(v)=>setRankBy(v as typeof rankBy)} />
                <SelectField label="VIEW FLOOR" value={String(viewFloor)} options={[["0","0"],["50000","50K"],["100000","100K"],["500000","500K"],["1000000","1M"],["5000000","5M"]]} onChange={(v)=>setViewFloor(Number(v))} />
                <SelectField label="LANGUAGE" value={language} options={[["en","English"],["id","Indonesian"],["any","Any"]]} onChange={(v)=>setLanguage(v as typeof language)} />
                <SelectField label="COUNTRY" value={country} options={[["US","US"],["GB","UK"],["AU","AU"],["IN","IN"],["CA","CA"],["ALL","All"]]} onChange={(v)=>setCountry(v as typeof country)} />
                <SelectField label="DEEP COUNT" value={String(deepCount)} options={[["0","Off"],["3","3"],["5","5"],["8","8"],["12","12"],["20","20"]]} onChange={(v)=>setDeepCount(Number(v))} />
              </div>
            )}
          </div>

          {/* Pipeline — custody chain */}
          <div className="border-t border-line bg-paper/60 px-5 sm:px-7 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-1 overflow-x-auto scrollbar-none pb-1 lg:pb-0">
                {STAGES.map((s, i) => {
                  const status = pipeline?.statuses?.[s.id] ?? "pending";
                  const isDone = status === "done";
                  return (
                    <div key={s.id} className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <StageDot status={status} label={s.label} sub={s.sub} onRerun={() => handleRun({ stage: s.id })} />
                      {i < STAGES.length - 1 && <div className={`hidden sm:block w-8 lg:w-10 h-px ${isDone ? "bg-emerald-300" : "bg-stone/20"}`} aria-hidden="true" />}
                      {i < STAGES.length - 1 && <div className="sm:hidden text-stone/20 text-[10px]">›</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {failedStage && !running && (
                  <button onClick={() => handleRun({ resume: true })} className="h-9 px-4 rounded-full bg-emerald-600 text-white font-mono text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-700 active:scale-[0.98] transition-all cursor-pointer"><RefreshCw className="h-3.5 w-3.5" /> Resume {failedStage}</button>
                )}
                {hasState && !running && (
                  <button onClick={() => handleRun({ clearState: true })} className="h-9 px-4 rounded-full bg-white border border-line text-stone font-mono text-[12px] font-medium hover:bg-paper hover:text-ink transition-colors cursor-pointer">Reset</button>
                )}
              </div>
            </div>
          </div>

          {/* Warnings — evidence alerts */}
          {hasWarn && (
            <div className="border-t border-line px-5 sm:px-7 py-4 space-y-3 bg-white" role="alert" aria-live="polite">
              {warns.map((w, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-[14px] px-4 py-3.5 border ${w.severity === "block" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                  <span className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${w.severity==="block" ? "bg-red-500 text-white" : "bg-amber text-ink"}`}><AlertTriangle className="h-4 w-4" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[12px] font-semibold text-ink leading-5">{w.message}</div>
                    <div className="font-mono text-[11px] leading-4 text-stone mt-0.5">{w.advice}</div>
                  </div>
                  <button onClick={() => setWarns((p) => p.filter((_, idx) => idx !== i))} aria-label="Dismiss" className="h-8 w-8 grid place-items-center rounded-full bg-white border border-line text-stone/60 hover:text-stone shrink-0"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Bench log + instrument panel ── */}
        <div className="grid lg:grid-cols-[1.45fr_380px] gap-5">
          {/* Live log — bench ledger */}
          <div className="bg-white rounded-[20px] border border-line shadow-evidence overflow-hidden flex flex-col">
            <div className="min-h-[48px] px-5 flex items-center justify-between gap-4 bg-ink text-paper">
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${running ? "bg-amber motion-safe:animate-pulse" : "bg-white/25"}`} aria-hidden="true" />
                <span className="font-mono text-[11px] font-semibold tracking-[0.08em]">{running ? "LIVE LEDGER" : runLog.length ? "RUN LEDGER" : "LEDGER"}</span>
                {running && <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber text-ink px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.06em]">● STREAMING</span>}
              </div>
              <div className="flex items-center gap-3">
                {runLog.length > 0 && <span className="font-mono text-[11px] tabular-nums text-white/60">{runLog.length} lines</span>}
                <button onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen} aria-controls="live-log-panel" className="h-7 w-7 grid place-items-center rounded-full bg-white/10 hover:bg-white/15 text-white transition-colors"><ChevronDown className={`h-4 w-4 transition-transform ${logOpen ? "rotate-180" : ""}`} /></button>
              </div>
            </div>
            {logOpen && (
              <div id="live-log-panel" className="flex-1 p-4 sm:p-5">
                {runLog.length === 0 ? (
                  <div className="py-10 text-center rounded-[16px] border border-dashed border-line bg-paper/50">
                    <div className="h-10 w-10 rounded-full bg-white border border-line grid place-items-center mx-auto"><FileSearch className="h-5 w-5 text-stone/60" /></div>
                    <div className="mt-3 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">Bench is idle</div>
                    <div className="mt-1 font-mono text-[12px] leading-5 text-stone max-w-[36ch] mx-auto">Enter a subject above and press <span className="font-semibold text-ink">Run intake</span>. The ledger streams each stage — scrape, scan, watch, deep, wall.</div>
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white border border-line px-3 py-1.5 font-mono text-[11px] text-stone"><span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" /> Local & private — output/ stays on disk</div>
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-line overflow-hidden bg-[#fcfbF8]">
                    <div className="h-7 flex items-center gap-1.5 px-3 bg-paper border-b border-line font-mono text-[10px] tracking-[0.08em] text-stone/60">
                      <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" /><span className="h-2 w-2 rounded-full bg-amber" aria-hidden="true" /><span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                      <span className="ml-2">output/last-run.log</span>
                      <span className="ml-auto tabular-nums">{runLog.length} lines</span>
                    </div>
                    <pre className="font-mono text-[12px] leading-5 text-ink whitespace-pre-wrap max-h-[360px] overflow-auto p-4" aria-live="polite">{runLog.join("\n")}</pre>
                  </div>
                )}
                {reportLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {reportLinks.map((r) => (
                      <a key={r} href={r.replace("output/", "/report/").replace(".json", "")} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-ink text-white font-mono text-[12px] font-semibold hover:bg-ink/90 active:scale-[0.98] transition-all cursor-pointer">
                        Open wall <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                    <span className="inline-flex items-center font-mono text-[11px] text-stone/60 ml-1">reports are in output/ — local only</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Instrument panel */}
          <div className="space-y-5">
            {/* Credentials — key drawer */}
            <div className="bg-white rounded-[20px] border border-line shadow-evidence overflow-hidden">
              <button onClick={() => setKeysOpen((o) => !o)} aria-expanded={keysOpen} aria-controls="keys-panel" className="w-full min-h-[48px] px-5 flex items-center justify-between gap-3 hover:bg-paper/50 transition-colors cursor-pointer">
                <span className="flex items-center gap-2.5 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink"><span className="h-7 w-7 rounded-full bg-ink text-amber grid place-items-center"><SlidersHorizontal className="h-3.5 w-3.5" /></span> CREDENTIALS</span>
                <span className={`h-7 w-7 rounded-full border grid place-items-center transition-colors ${keysOpen ? "bg-ink text-white border-ink" : "bg-white border-line text-stone"}`}>{keysOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
              </button>
              {keysOpen && (
                <div id="keys-panel" className="px-5 pb-5 space-y-3 border-t border-line bg-paper/30">
                  <p className="font-mono text-[11px] leading-4 text-stone pt-3">Verify Apify + Gemini reachability before a full run. Crawlee is local — no token needed when <span className="font-semibold text-ink">SCRAPER_PROVIDER=crawlee</span>.</p>
                  <button onClick={handleCheckKeys} disabled={checking} className="w-full h-10 rounded-full bg-ink text-white font-mono text-[12px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-ink/90 disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer">
                    {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />} {checking ? "Checking…" : "Check connections"}
                  </button>
                  {checkResults && (
                    <div className="space-y-2" role="status" aria-live="polite">
                      {checkResults.map((r, i) => (
                        <div key={i} className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 border text-[11px] font-mono ${r.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
                          {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />}
                          <span className="font-semibold">{r.service}</span>
                          <span className="truncate ml-auto opacity-70">{r.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link href="/settings" className="block text-center font-mono text-[11px] font-medium text-stone hover:text-ink underline decoration-dotted underline-offset-4">Edit in Settings →</Link>
                </div>
              )}
            </div>

            {/* Cost — receipt */}
            <div className="bg-white rounded-[20px] border border-line shadow-evidence overflow-hidden">
              <div className="h-10 px-5 flex items-center justify-between border-b border-dashed border-line bg-paper/50">
                <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-stone flex items-center gap-2"><span className="h-1.5 w-6 bg-amber rounded-full" aria-hidden="true" /> {runCosts.length ? "RECEIPT — ACTUAL" : "ESTIMATE"}</span>
                <span className="font-mono text-[10px] tracking-[0.06em] text-stone/50">{runCosts.length ? `${runCosts.length} leg${runCosts.length!==1?"s":""}` : "per run"}</span>
              </div>
              <div className="p-5">
                {runCosts.length ? (
                  <div className="space-y-3">
                    {runCosts.map((c) => (
                      <div key={c.platform} className="flex items-center justify-between gap-3 font-mono text-[12px]">
                        <span className="inline-flex items-center gap-1.5 font-medium text-stone capitalize"><PlatformIcon platform={c.platform} size={13} />{c.platform}</span>
                        <span className="font-semibold tabular-nums">₹{c.tier1Inr + c.tier2Inr + c.synthInr} <span className="font-normal text-stone">+</span> ${c.apifyUsd.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-dashed border-line flex items-center justify-between font-mono text-[13px] font-bold tracking-[-0.02em]">
                      <span className="text-ink">TOTAL</span>
                      <span className="tabular-nums">₹{totalCost.inr} <span className="font-normal text-stone/60">+</span> ${totalCost.usd.toFixed(2)}</span>
                    </div>
                    {totalCost.cache > 0 && <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-700">↻ {totalCost.cache} from cache — no AI cost</div>}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex justify-between font-mono text-[12px] text-stone"><span>Watch (Tier 1)</span><span className="font-semibold tabular-nums">~₹{Math.round(count*2.5)}</span></div>
                    <div className="flex justify-between font-mono text-[12px] text-stone"><span>Deep (Tier 2)</span><span className="font-semibold tabular-nums">~₹{deepCount*10}</span></div>
                    <div className="flex justify-between font-mono text-[12px] text-stone"><span>Apify <span className="text-stone/60">(if used)</span></span><span className="font-semibold tabular-nums">~${(Math.max(count*12,300)*0.0026).toFixed(2)}</span></div>
                    <div className="pt-3 border-t border-dashed border-line flex justify-between font-mono text-[12px] font-bold"><span>ESTIMATED</span><span className="tabular-nums">₹{Math.round(count*2.5)+deepCount*10} <span className="font-normal text-stone/60">+</span> ${(Math.max(count*12,300)*0.0026).toFixed(2)}</span></div>
                    <p className="font-mono text-[11px] leading-4 text-stone/60">Crawlee = $0 scrape. Re-runs reuse cache. Actual appears after run.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent — evidence sleeves */}
            <div className="bg-white rounded-[20px] border border-line shadow-evidence overflow-hidden">
              <div className="h-10 px-5 flex items-center justify-between border-b border-line bg-paper/30">
                <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-ink flex items-center gap-2"><Archive className="h-3.5 w-3.5" /> RECENT WALLS</span>
                <Link href="/history" className="font-mono text-[11px] font-medium text-stone hover:text-ink px-2 py-1 rounded-full hover:bg-paper transition-colors">All →</Link>
              </div>
              <div className="divide-y divide-line/60">
                {runsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3].map(i=> <div key={i} className="h-[64px] rounded-[14px] bg-paper animate-pulse" />)}
                  </div>
                ) : runs.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="h-12 w-12 rounded-[14px] bg-paper border border-dashed border-line grid place-items-center mx-auto"><Archive className="h-5 w-5 text-stone/40" /></div>
                    <div className="mt-3 font-mono text-[13px] font-semibold text-ink">No walls yet</div>
                    <div className="mt-1 font-mono text-[11px] leading-4 text-stone">Run an intake to pin your first wall. Private, local, in output/.</div>
                    <Link href="/" className="mt-4 inline-flex h-8 px-4 rounded-full bg-ink text-white font-mono text-[11px] font-medium items-center">Start intake →</Link>
                  </div>
                ) : (
                  runs.slice(0, 5).map((r) => (
                    <Link key={r.file} href={`/report/${r.platform}`} className="flex items-center gap-3.5 px-5 py-4 hover:bg-paper/60 transition-colors group">
                      <PlatformBadge platform={r.platform} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[13px] font-semibold tracking-[-0.01em] truncate text-ink group-hover:text-ink">{r.keyword}</div>
                        <div className="font-mono text-[11px] text-stone mt-0.5 flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />{r.videos} tapes · {r.date} · {r.platform}</div>
                      </div>
                      <span className="h-7 w-7 hidden sm:grid place-items-center rounded-full border border-line bg-white group-hover:border-amber/30 group-hover:bg-amber/10 text-stone group-hover:text-amber-700 transition-colors"><ExternalLink className="h-3.5 w-3.5" /></span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 font-mono text-[11px] text-stone/40 pt-2">
          <span>© Manish Tiwari</span><span className="h-1 w-1 rounded-full bg-stone/20" aria-hidden="true" /><span>LOCAL · PRIVATE · FILE-BASED</span><span className="h-1 w-1 rounded-full bg-stone/20" aria-hidden="true" /><span>output/ is yours</span>
        </div>
      </main>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string,string]>; onChange: (v:string)=>void }) {
  const id = `select-${label.toLowerCase().replace(/\s+/g,'-')}`;
  return (
    <div>
      <label htmlFor={id} className="font-mono text-[11px] font-semibold tracking-[0.06em] text-ink block mb-1.5">{label}</label>
      <div className="relative">
        <select id={id} value={value} onChange={(e)=>onChange(e.target.value)} className="w-full h-10 appearance-none rounded-[12px] border border-line bg-white pl-3 pr-9 font-mono text-[13px] text-ink focus:outline-none focus:border-amber focus:ring-[3px] focus:ring-amber/15 cursor-pointer transition-colors">
          {options.map(([v,l])=> <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone/50 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}
