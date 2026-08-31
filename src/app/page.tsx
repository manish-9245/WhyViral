"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, Play, CheckCircle2, AlertTriangle, SlidersHorizontal, ExternalLink, RefreshCw, X, ChevronDown, ChevronUp, Archive, Settings } from "lucide-react";
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

const STAGES: { id: Stage; label: string }[] = [
  { id: "scrape", label: "Scrape" },
  { id: "prescreen", label: "Pre-screen" },
  { id: "watch", label: "Watch" },
  { id: "deep", label: "Deep" },
  { id: "synth", label: "Synth" },
];

function StageDot({ status, label, onRerun }: { status: StageStatus; label: string; onRerun?: () => void }) {
  const cfg = {
    pending: { dot: "bg-white border border-line", text: "text-stone/50", icon: null },
    running: { dot: "bg-amber border border-amber shadow-sm animate-pulse", text: "text-amber-700", icon: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
    done: { dot: "bg-emerald-500 border border-emerald-600 shadow-sm", text: "text-emerald-700", icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
    failed: { dot: "bg-red-500 border border-red-600 shadow-sm", text: "text-red-600", icon: <AlertTriangle className="h-2.5 w-2.5" /> },
    skipped: { dot: "bg-paper border border-line", text: "text-stone/40", icon: null },
  }[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-5 w-5 rounded-full grid place-items-center shrink-0 ${cfg.dot} ${status === "done" ? "text-white" : status === "failed" ? "text-white" : status === "running" ? "text-ink" : "text-stone/40"}`}>
        {cfg.icon}
      </div>
      <span className={`font-mono text-[10px] tracking-[0.04em] ${cfg.text}`}>{label}</span>
      {(status === "done" || status === "failed") && onRerun && (
        <button onClick={onRerun} className="font-mono text-[9px] font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0.5 bg-amber-50 ml-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500">retry</button>
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

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* ── Top nav ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone/10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-ink grid place-items-center text-amber text-[10px] font-bold font-mono">WV</div>
            <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-ink hidden sm:block">WHYVIRAL</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/" className="h-8 px-3 flex items-center rounded-lg bg-stone-100 font-mono text-[11px]">Console</Link>
            <Link href="/history" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50 transition-colors">History</Link>
            <Link href="/settings" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50 transition-colors">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Input bar ────────────────────────────────────────── */}
        <div className="bg-white rounded-[16px] border border-line shadow-evidence overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 p-5">
            {/* Keyword */}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] text-stone/60 mb-1.5 tracking-[0.08em]">KEYWORD</div>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. magnesium gummies, llm tutorial"
                className="w-full h-10 rounded-[12px] border border-line bg-paper px-3 font-mono text-[13px] leading-none placeholder:text-stone/50 focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 focus:bg-white transition-colors"
              />
            </div>

            {/* Platform */}
            <div className="lg:max-w-[420px]">
              <div className="font-mono text-[10px] text-stone/60 mb-1.5 tracking-[0.08em]">PLATFORM — 9 + ALL</div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["tiktok","TikTok"],["instagram","Instagram"],["meta","Meta"],
                  ["youtube","YouTube"],["twitter","X"],["pinterest","Pinterest"],
                  ["reddit","Reddit"],["linkedin","LinkedIn"],["snapchat","Snapchat"],
                  ["all","All"],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPlatform(val as PlatformId)}
                    aria-pressed={platform === val}
                    className={`h-7 px-2.5 rounded-full border font-mono text-[11px] flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1 ${platform === val ? "bg-ink text-white border-ink shadow-pin" : "bg-white text-stone border-line hover:bg-paper hover:border-stone/30"}`}
                  >
                    <PlatformIcon platform={val} size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <div className="shrink-0">
              <div className="font-mono text-[10px] text-stone/60 mb-1.5 tracking-[0.08em]">TARGET</div>
              <div className="flex items-center rounded-[12px] border border-line overflow-hidden bg-white">
                <button onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Decrease target" className="h-10 w-9 grid place-items-center bg-white text-stone hover:bg-paper hover:text-ink transition-colors focus-visible:outline-none focus-visible:bg-paper">−</button>
                <div className="h-10 w-12 grid place-items-center bg-paper font-mono text-[13px] font-semibold tabular-nums border-x border-line">{count}</div>
                <button onClick={() => setCount((c) => Math.min(100, c + 1))} aria-label="Increase target" className="h-10 w-9 grid place-items-center bg-white text-stone hover:bg-paper hover:text-ink transition-colors focus-visible:outline-none focus-visible:bg-paper">+</button>
              </div>
            </div>

            {/* Run */}
            <div className="shrink-0 flex flex-col justify-end">
              <div className="font-mono text-[10px] text-stone/60 mb-1.5 tracking-[0.08em] invisible select-none">RUN</div>
              <button
                onClick={() => handleRun()}
                disabled={running || !keyword.trim()}
                className="h-10 px-6 rounded-[12px] bg-amber text-ink font-mono text-[12px] font-semibold flex items-center gap-2 hover:bg-amber/90 active:bg-amber disabled:opacity-40 disabled:cursor-not-allowed shadow-pin transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-ink" />}
                {running ? "Running…" : "Run"}
              </button>
            </div>
          </div>

          {/* Advanced controls — collapsible row of 5 dropdowns */}
          <div className="border-t border-line bg-paper/30">
            <button
              onClick={() => setAdvancedOpen((o) => !o)}
              className="w-full h-9 px-4 flex items-center justify-between font-mono text-[10px] tracking-[0.08em] text-stone/60 hover:text-stone hover:bg-white/60 transition-colors focus-visible:outline-none focus-visible:bg-white"
              aria-expanded={advancedOpen}
            >
              <span className="flex items-center gap-2 truncate">
                <SlidersHorizontal className="h-3 w-3 shrink-0" /> ADVANCED
                <span className="text-stone/30">·</span>
                <span className="text-stone/50 truncate">rank {rankBy} · views ≥{viewFloor.toLocaleString('en-US')} · {language} · {country} · deep {deepCount}</span>
              </span>
              {advancedOpen ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
            </button>
            {advancedOpen && (
              <div className="px-4 pb-4 pt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-line/50 bg-white/80">
                <SelectField
                  label="RANK BY"
                  value={rankBy}
                  options={[
                    ["engagement", "Engagement"],
                    ["reach", "Reach"],
                    ["views", "Views"],
                  ]}
                  onChange={(v) => setRankBy(v as typeof rankBy)}
                />
                <SelectField
                  label="VIEW FLOOR"
                  value={String(viewFloor)}
                  options={[
                    ["0", "0"],
                    ["50000", "50K"],
                    ["100000", "100K"],
                    ["500000", "500K"],
                    ["1000000", "1M"],
                    ["5000000", "5M"],
                  ]}
                  onChange={(v) => setViewFloor(Number(v))}
                />
                <SelectField
                  label="LANGUAGE"
                  value={language}
                  options={[
                    ["en", "English"],
                    ["id", "Indonesian"],
                    ["any", "Any"],
                  ]}
                  onChange={(v) => setLanguage(v as typeof language)}
                />
                <SelectField
                  label="COUNTRY"
                  value={country}
                  options={[
                    ["US", "US"],
                    ["GB", "UK"],
                    ["AU", "AU"],
                    ["IN", "IN"],
                    ["CA", "CA"],
                    ["ALL", "All"],
                  ]}
                  onChange={(v) => setCountry(v as typeof country)}
                />
                <SelectField
                  label="DEEP COUNT"
                  value={String(deepCount)}
                  options={[
                    ["0", "Off"],
                    ["3", "3"],
                    ["5", "5"],
                    ["8", "8 (default)"],
                    ["12", "12"],
                    ["20", "20"],
                  ]}
                  onChange={(v) => setDeepCount(Number(v))}
                />
              </div>
            )}
          </div>

          {/* Pipeline strip */}
          <div className="border-t border-line px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper/60">
            <div className="flex items-center gap-4 sm:gap-6">
              <span className="font-mono text-[10px] text-stone/60 tracking-[0.08em] shrink-0">PIPELINE</span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {STAGES.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <StageDot
                      status={pipeline?.statuses?.[s.id] ?? "pending"}
                      label={s.label}
                      onRerun={() => handleRun({ stage: s.id })}
                    />
                    {i < STAGES.length - 1 && (
                      <div className={`w-3 sm:w-4 h-px ${(pipeline?.statuses?.[s.id] ?? "pending") === "done" ? "bg-emerald-300" : "bg-stone/20"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {failedStage && !running && (
                <button onClick={() => handleRun({ resume: true })} className="h-7 px-3 rounded-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-medium flex items-center gap-1.5 hover:bg-emerald-100 hover:border-emerald-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  <RefreshCw className="h-3 w-3" /> Resume
                </button>
              )}
              {hasState && !running && (
                <button onClick={() => handleRun({ clearState: true })} className="h-7 px-3 rounded-[10px] bg-white border border-line text-stone font-mono text-[10px] hover:bg-paper hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone">Reset</button>
              )}
              <button onClick={fetchPipeline} aria-label="Refresh pipeline" className="h-7 w-7 grid place-items-center rounded-[10px] border border-line bg-white text-stone hover:bg-paper hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone"><RefreshCw className="h-3 w-3" /></button>
            </div>
          </div>

          {/* Warnings */}
          {hasWarn && (
            <div className="border-t border-stone/10 px-4 py-3 space-y-2">
              {warns.map((w, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${w.severity === "block" ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${w.severity === "block" ? "text-red-500" : "text-amber-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[11px] font-medium text-stone">{w.message}</p>
                    <p className="font-mono text-[10px] text-stone/60 mt-0.5">{w.advice}</p>
                  </div>
                  <button onClick={() => setWarns((p) => p.filter((_, idx) => idx !== i))} className="text-stone/40 hover:text-stone"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main content: log + walls ────────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">

          {/* Live log */}
          <div className="bg-white rounded-xl border border-stone/10 shadow-sm overflow-hidden">
            <button
              onClick={() => setLogOpen((o) => !o)}
              className="w-full h-11 px-4 flex items-center justify-between bg-ink text-paper font-mono text-[11px] tracking-wider"
            >
              <span className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-amber animate-pulse" : "bg-stone-400"}`} />
                {running ? "LIVE LOG" : runLog.length > 0 ? "RUN LOG" : "LOG"}
              </span>
              <span className="flex items-center gap-2 opacity-60">
                {runLog.length > 0 && <span>{runLog.length} lines</span>}
                {logOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>
            {logOpen && (
              <div className="p-4">
                {runLog.length === 0 ? (
                  <p className="font-mono text-[12px] text-stone/50">Press Run to see the workflow log here.</p>
                ) : (
                  <pre className="font-mono text-[11px] leading-5 text-stone whitespace-pre-wrap max-h-80 overflow-auto">
                    {runLog.join("\n")}
                  </pre>
                )}
                {reportLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {reportLinks.map((r) => (
                      <a key={r} href={r.replace("output/", "/report/").replace(".json", "")}
                        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-amber text-ink font-mono text-[11px] font-semibold hover:bg-amber/90 transition-colors">
                        Open wall <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* API keys quick check */}
            <div className="bg-white rounded-xl border border-stone/10 shadow-sm overflow-hidden">
              <button onClick={() => setKeysOpen((o) => !o)} className="w-full h-10 px-4 flex items-center justify-between font-mono text-[11px] tracking-wider border-b border-stone/10">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> API KEYS
                </span>
                {keysOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {keysOpen && (
                <div className="p-4 space-y-3">
                  <button onClick={handleCheckKeys} disabled={checking}
                    className="w-full h-9 rounded-lg bg-ink text-white font-mono text-[11px] flex items-center justify-center gap-2 hover:bg-ink/90 disabled:opacity-50 transition-colors">
                    {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    {checking ? "Checking…" : "Check connections"}
                  </button>
                  {checkResults && (
                    <div className="space-y-1.5">
                      {checkResults.map((r, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${r.ok ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                          {r.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className="font-mono text-[10px]">{r.service}</span>
                          <span className="font-mono text-[10px] text-stone/60 truncate ml-auto">{r.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link href="/settings" className="block text-center font-mono text-[10px] text-stone/60 hover:text-amber-600 transition-colors">Edit in Settings →</Link>
                </div>
              )}
            </div>

            {/* Cost summary */}
            <div className="bg-white rounded-xl border border-stone/10 shadow-sm p-4">
              <div className="font-mono text-[10px] text-stone/60 tracking-wider mb-3">
                {runCosts.length > 0 ? "ACTUAL COST" : "COST ESTIMATE"}
              </div>
              {runCosts.length > 0 ? (
                <div className="space-y-1.5">
                  {runCosts.map((c) => (
                    <div key={c.platform} className="font-mono text-[11px] flex justify-between items-center">
                      <span className="text-stone capitalize flex items-center gap-1.5"><PlatformIcon platform={c.platform} size={12} />{c.platform}</span>
                      <span className="font-medium">₹{c.tier1Inr + c.tier2Inr + c.synthInr} + ${c.apifyUsd.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-stone/10 font-mono text-[11px] flex justify-between font-semibold text-ink">
                    <span>Total</span>
                    <span>₹{totalCost.inr} + ${totalCost.usd.toFixed(2)}</span>
                  </div>
                  {totalCost.cache > 0 && (
                    <div className="font-mono text-[10px] text-emerald-600">✓ {totalCost.cache} videos from cache</div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-stone"><span>Watch</span><span>~₹{Math.round(count * 2.5)}</span></div>
                  <div className="flex justify-between text-stone"><span>Deep pass</span><span>~₹{deepCount * 10}</span></div>
                  <div className="flex justify-between text-stone"><span>Apify</span><span>~${(Math.max(count * 12, 300) * 0.0026).toFixed(2)}</span></div>
                </div>
              )}
            </div>

            {/* Recent walls */}
            <div className="bg-white rounded-xl border border-stone/10 shadow-sm overflow-hidden">
              <div className="h-10 px-4 flex items-center justify-between border-b border-stone/10 font-mono text-[11px] tracking-wider">
                <span className="flex items-center gap-2"><Archive className="h-3.5 w-3.5" /> RECENT WALLS</span>
                <Link href="/history" className="text-stone/60 hover:text-amber-600 text-[10px] transition-colors">All →</Link>
              </div>
              <div className="divide-y divide-stone/5">
                {runsLoading ? (
                  <div className="p-4 font-mono text-[11px] text-stone/50">Loading…</div>
                ) : runs.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="font-mono text-[11px] text-stone/60">No walls yet.</p>
                    <p className="font-mono text-[10px] text-stone/40 mt-1">Run a search to see walls here.</p>
                  </div>
                ) : (
                  runs.slice(0, 5).map((r) => (
                    <Link key={r.file} href={`/report/${r.platform}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-paper transition-colors group">
                      <PlatformBadge platform={r.platform} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] font-medium truncate text-stone group-hover:text-ink">{r.keyword}</div>
                        <div className="font-mono text-[10px] text-stone/50">{r.videos} tapes · {r.date}</div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-stone/30 group-hover:text-amber-600 shrink-0 transition-colors" />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] text-stone/60 mb-1.5 tracking-wider block">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 appearance-none rounded-lg border border-stone/20 bg-paper pl-3 pr-8 font-mono text-[12px] text-ink focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 cursor-pointer"
        >
          {options.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone/40 pointer-events-none" />
      </div>
    </div>
  );
}
