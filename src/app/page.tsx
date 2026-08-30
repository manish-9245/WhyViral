"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Play, ExternalLink, CheckCircle2, AlertTriangle, Search, SlidersHorizontal, FlaskConical, Archive, Terminal, Zap, X, RefreshCw, ChevronRight, Circle } from "lucide-react";

type CheckResult = { service: string; ok: boolean; message: string };
type RunCost = { platform: string; pool: number; apifyUsd: number; tier1Calls: number; tier1Inr: number; tier2Calls: number; tier2Inr: number; synthRan: boolean; synthInr: number; cacheHits: number };
type RunWarn = { stage: string; severity: "warn" | "block"; message: string; advice: string };
type Stage = "scrape" | "prescreen" | "watch" | "deep" | "synth";
type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";
type PipelineData = {
  platform: string;
  stages: Stage[];
  statuses: Record<Stage, StageStatus> | null;
  state: { lastCompleted: Stage | null; failedAt: Stage | null; failureReason: string | null; updatedAt: string } | null;
  reportMeta: { keyword: string; videoCount: number; date: string } | null;
} | null;

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "scrape", label: "Scrape", hint: "Pull raw videos from the platform" },
  { id: "prescreen", label: "Pre-screen", hint: "Filter by caption & language" },
  { id: "watch", label: "Watch", hint: "AI watches each video" },
  { id: "deep", label: "Deep pass", hint: "Tier-2 analysis on top winners" },
  { id: "synth", label: "Synth", hint: "Cluster patterns into a wall" },
];

export default function Dashboard() {
  const [keyword, setKeyword] = useState("");
  const [platform, setPlatform] = useState<"tiktok" | "instagram" | "meta" | "all">("tiktok");
  const [count, setCount] = useState(5);
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runStage, setRunStage] = useState<Stage | null>(null);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [reportLinks, setReportLinks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"run" | "reports" | "help">("run");
  const [history, setHistory] = useState<Array<{file:string; keyword:string; platform:string; videos:number; date:string}>>([]);
  const [runCosts, setRunCosts] = useState<RunCost[]>([]);
  const [warns, setWarns] = useState<RunWarn[]>([]);
  const [pipeline, setPipeline] = useState<PipelineData>(null);
  const [resumeFrom, setResumeFrom] = useState<Stage | null>(null);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?platform=${platform}`);
      if (res.ok) setPipeline(await res.json());
    } catch { setPipeline(null); }
  }, [platform]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // Refresh pipeline state while running
  useEffect(() => {
    if (!running) return;
    const id = setInterval(fetchPipeline, 3000);
    return () => clearInterval(id);
  }, [running, fetchPipeline]);

  async function handleCheckKeys() {
    setChecking(true);
    setCheckResults(null);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      const j = await res.json();
      setCheckResults(j.results || []);
    } catch (e) { setCheckResults([{ service: "error", ok: false, message: String(e) }]); }
    finally { setChecking(false); }
  }
  async function handleRun(opts?: { resume?: boolean; stage?: Stage; clearState?: boolean }) {
    if (running) return;
    setRunning(true);
    setRunLog([]);
    setReportLinks([]);
    setRunCosts([]);
    setWarns([]);
    setRunStage(opts?.stage || null);
    const body: Record<string, unknown> = { keywords: keyword.split(",").map((s) => s.trim()).filter(Boolean), platform, count };
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
            if (evt.type === "done") setReportLinks(evt.reports || []);
            if (evt.type === "cost") setRunCosts((c) => [...c, evt as RunCost]);
            if (evt.type === "warn" || evt.type === "error") setWarns((w) => [...w, evt as RunWarn]);
            if (evt.type === "state") fetchPipeline();
          } catch { setRunLog((l) => [...l, line]); }
        }
      }
    } catch (e) { setWarns((w) => [...w, { stage: "network", severity: "block", message: "Couldn't reach the workflow.", advice: "Is the app still running? Restart it and try again." }]); }
    finally { setRunning(false); setRunStage(null); fetchPipeline(); }
  }

  return (
    <div className="space-y-8">
      {/* Lab masthead — Sora display, not centered hero */}
      <div className="border border-line rounded-[12px] overflow-hidden bg-white">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-0">
          <div className="p-8 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-3 py-1 font-mono text-[10px] tracking-[0.12em]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" /> WHYVIRAL — FIND THE WINNING WHY
            </div>
            <h1 className="font-display font-[800] text-[42px] md:text-[52px] leading-[0.9] tracking-[-0.04em] mt-4" style={{ fontFamily: "var(--font-sora)" }}>
              Every hook<br />
              <span className="font-[400] italic">has a tape.</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-[14px] leading-6 text-stone">
              WhyViral answers the only question that matters — *why does this work?* It watches real videos, pins the hooks, visuals and angles that earn distribution, each with a proof link. Private, local, and built for strategists by <span className="font-semibold text-ink">Manish Tiwari</span>.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber text-ink px-2.5 py-1 font-medium"><span className="h-1.5 w-1.5 rounded-full bg-ink" /> Private & Local</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1">Proof-linked</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1">For strategists</span>
            </div>
          </div>
          <div className="bg-ink text-paper p-6 md:p-8 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-line relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent 0 31px, hsl(var(--border)) 32px)` }} aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.12em] opacity-60">
                <span>WALL — STRING BOARD PREVIEW</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber" /> 6 dims × 5 pins</span>
              </div>
              {/* Mini string board */}
              <svg viewBox="0 0 400 180" className="mt-4 w-full h-[160px]">
                <line x1="40" y1="40" x2="200" y2="90" className="string" />
                <line x1="120" y1="38" x2="200" y2="90" className="string" />
                <line x1="200" y1="36" x2="200" y2="90" className="string" />
                <line x1="280" y1="40" x2="200" y2="90" className="string" />
                <line x1="360" y1="42" x2="200" y2="90" className="string" />
                <line x1="360" y1="120" x2="200" y2="90" className="string" />
                {[
                  [40,40,"Hook\nvis"],["120,38","Hook\nspo"],["200,36","Hook\ntxt"],["280,40","Format"],["360,42","Tone"],["360,120","Other"],
                ].map(([x,y,label],i)=> (
                  <g key={i}>
                    <circle cx={Number(String(x).split(",")[0])} cy={Number(String(x).split(",")[1]||y as string)} r="14" fill="hsl(var(--paper))" stroke="hsl(var(--ink))" strokeWidth="1.2" />
                    <circle cx={Number(String(x).split(",")[0])} cy={Number(String(x).split(",")[1]||y as string)} r="4.5" fill="hsl(var(--amber))" stroke="hsl(var(--ink))" strokeWidth="1" />
                    <text x={Number(String(x).split(",")[0])} y={Number(String(x).split(",")[1]||y as string)+28} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize="7" fill="hsl(var(--paper))" opacity="0.9">{String(label).split("\n")[0]}</text>
                    <text x={Number(String(x).split(",")[0])} y={Number(String(x).split(",")[1]||y as string)+36} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize="7" fill="hsl(var(--paper))" opacity="0.9">{String(label).split("\n")[1]||""}</text>
                  </g>
                ))}
                <g>
                  <circle cx="200" cy="90" r="22" fill="hsl(var(--amber))" stroke="hsl(var(--paper))" strokeWidth="1.5" />
                  <text x="200" y="94" textAnchor="middle" fontFamily="var(--font-sora)" fontSize="9" fontWeight="700" fill="hsl(var(--ink))">EVIDENCE</text>
                </g>
              </svg>
              <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]">
                <div className="rounded-[8px] bg-white/[0.06] border border-white/10 p-2.5">
                  <div className="opacity-60 tracking-[0.08em]">WINNERS</div>
                  <div className="text-[14px] font-medium mt-1">Target {count}</div>
                </div>
                <div className="rounded-[8px] bg-white/[0.06] border border-white/10 p-2.5">
                  <div className="opacity-60 tracking-[0.08em]">PLATFORM</div>
                  <div className="text-[12px] font-medium mt-1 uppercase">{platform}</div>
                </div>
                <div className="rounded-[8px] bg-amber text-ink p-2.5">
                  <div className="tracking-[0.08em] opacity-60">BUILT BY</div>
                  <div className="text-[12px] font-bold mt-1">Manish Tiwari</div>
                </div>
              </div>
            </div>
            <div className="relative mt-6 flex items-center gap-2 font-mono text-[11px]">
              <span className="opacity-60">Last wall:</span>
              <a href="/report/tiktok" className="inline-flex items-center gap-1.5 rounded-full bg-white text-ink px-3 py-1.5 font-medium hover:bg-paper transition-colors">Open TikTok wall <ExternalLink className="h-3 w-3" /></a>
              <a href="/report/meta" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/10 transition-colors">Meta</a>
            </div>
          </div>
        </div>
      </div>

      {/* Bench — console left, log/wall right */}
      <div className="grid lg:grid-cols-[448px_1fr] gap-6 items-start">
        {/* Console */}
        <div className="bg-white border border-line rounded-[12px] overflow-hidden">
          <div className="h-9 flex items-center justify-between px-4 bg-ink text-paper font-mono text-[10px] tracking-[0.12em]">
            <span className="flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5 text-amber" /> CONSOLE — RUN</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 opacity-60"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> IDLE</span>
          </div>
          <div className="p-6 space-y-5">
            {/* Tabs as file tabs */}
            <div className="flex gap-1 p-1 rounded-full bg-secondary border border-line w-fit">
              {[
                ["run","Run"],["reports","Reports"],["help","Help"],
              ].map(([v,l])=> (
                <button key={v} onClick={()=>setActiveTab(v as never)} className={`px-3 py-1.5 rounded-full font-mono text-[11px] tracking-[0.08em] transition-colors ${activeTab===v ? "bg-ink text-paper" : "hover:bg-white"}`}>{l}</button>
              ))}
            </div>

            {activeTab==="run" && (
              <div className="space-y-5 animate-[log-in_340ms_cubic-bezier(0.16,1,0.3,1)]">
                <div>
                  <label className="font-mono text-[10px] tracking-[0.12em] text-stone flex items-center gap-1.5"><Search className="h-3 w-3" /> KEYWORDS — COMMA SEPARATED</label>
                  <input value={keyword} onChange={(e)=>setKeyword(e.target.value)} placeholder="magnesium gummies" className="mt-2 flex h-11 w-full rounded-[8px] border border-line bg-paper px-3 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-amber/20 focus:border-amber" />
                  <p className="mt-2 font-mono text-[11px] leading-4 text-stone">On larger runs, related terms are added automatically to widen the net — same niche, no drift.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] tracking-[0.12em] text-stone flex items-center gap-1"><SlidersHorizontal className="h-3 w-3" /> PLATFORM</label>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {[
                        ["tiktok","TikTok"],["instagram","IG"],["meta","Meta"],["all","All"],
                      ].map(([val,label])=> (
                        <button key={val} onClick={()=>setPlatform(val as never)} className={`h-9 rounded-[8px] border text-[12px] font-mono font-medium transition-colors ${platform===val ? "bg-ink text-paper border-ink" : "bg-white border-line hover:border-ink/20"}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] tracking-[0.12em] text-stone">TARGET — WINNERS</label>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={()=>setCount(c=>Math.max(1,c-1))} className="h-9 w-9 grid place-items-center rounded-[8px] border border-line bg-white hover:bg-secondary">−</button>
                      <div className="flex-1 h-9 grid place-items-center rounded-[8px] border border-line bg-paper font-mono text-[14px] font-medium">{count}</div>
                      <button onClick={()=>setCount(c=>Math.min(100,c+1))} className="h-9 w-9 grid place-items-center rounded-[8px] border border-line bg-white hover:bg-secondary">+</button>
                    </div>
                    <div className="mt-1.5 font-mono text-[10px] tracking-[0.06em] text-stone">pool ≈ {Math.max(count*12,300)} · bait ×0.5</div>
                  </div>
                </div>
                {platform==="instagram" && <div className="rounded-[8px] border border-amber/20 bg-amber/[0.08] p-3 font-mono text-[11px] leading-4">IG links expire in 24–48h — re-download may backfill from pool.</div>}

                {/* ── Pipeline stage control ─────────────────────────────────── */}
                <div className="rounded-[10px] border border-line bg-paper p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-stone">PIPELINE</span>
                    <button onClick={fetchPipeline} className="text-stone hover:text-ink transition-colors" title="Refresh pipeline state"><RefreshCw className="h-3 w-3" /></button>
                  </div>
                  {/* Stage stepper */}
                  <div className="flex items-center gap-0.5">
                    {STAGES.map((s, i) => {
                      const status = pipeline?.statuses?.[s.id] ?? "pending";
                      const isRunning = running && runStage === s.id;
                      const isFailed = status === "failed";
                      const isDone = status === "done";
                      const isPending = status === "pending";
                      const dotColor = isRunning ? "bg-amber animate-pulse" : isFailed ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-stone/30";
                      const textColor = isFailed ? "text-red-600" : isDone ? "text-emerald-700" : isRunning ? "text-amber-700" : "text-stone";
                      return (
                        <div key={s.id} className="flex items-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center ${dotColor}`}>
                              {isRunning ? <Loader2 className="h-3 w-3 animate-spin text-ink" /> : isDone ? <CheckCircle2 className="h-3 w-3 text-paper" /> : isFailed ? <AlertTriangle className="h-3 w-3 text-paper" /> : <Circle className="h-2 w-2 text-paper/40" />}
                            </div>
                            <span className={`font-mono text-[9px] tracking-wide ${textColor}`}>{s.label}</span>
                            {!running && !isPending && !isFailed && (
                              <button
                                onClick={() => handleRun({ stage: s.id as Stage })}
                                className="font-mono text-[8px] text-amber-600 hover:text-amber-800 transition-colors border border-amber-200 bg-amber-50 rounded px-1 py-0.5"
                                title={`Run from ${s.label}`}
                              >from here</button>
                            )}
                          </div>
                          {i < STAGES.length - 1 && (
                            <div className={`w-4 h-px mb-3 ${isDone ? "bg-emerald-400" : "bg-stone/20"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Resume / clear controls */}
                  {pipeline?.state && !running && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {(pipeline.state.failedAt || pipeline.state.lastCompleted) && (
                        <button
                          onClick={() => handleRun({ resume: true })}
                          className="inline-flex items-center gap-1.5 h-7 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] px-2.5 hover:bg-emerald-100 transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" /> Resume from {pipeline.state.lastCompleted || pipeline.state.failedAt}
                        </button>
                      )}
                      <button
                        onClick={() => handleRun({ clearState: true })}
                        className="inline-flex items-center gap-1.5 h-7 rounded-[6px] bg-red-50 border border-red-200 text-red-600 font-mono text-[10px] px-2.5 hover:bg-red-100 transition-colors"
                        title="Clear saved pipeline state and start fresh"
                      >
                        <X className="h-3 w-3" /> Clear state
                      </button>
                      {pipeline.state.failedAt && (
                        <span className="font-mono text-[10px] text-red-600 truncate max-w-[140px]" title={pipeline.state.failureReason || ""}>
                          Failed: {pipeline.state.failureReason || pipeline.state.failedAt}
                        </span>
                      )}
                    </div>
                  )}
                  {pipeline?.reportMeta && !running && (
                    <div className="mt-2 font-mono text-[10px] text-stone">
                      Last run: <span className="text-ink font-medium">{pipeline.reportMeta.keyword}</span> · {pipeline.reportMeta.videoCount} videos · {pipeline.reportMeta.date}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleRun()} disabled={running} className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-[8px] bg-amber text-ink font-mono text-[13px] font-semibold tracking-[0.04em] hover:bg-amber/90 disabled:opacity-50 transition-colors">
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-ink" />} {running ? "RUNNING…" : "RUN WORKFLOW"}
                  </button>
                  <button onClick={handleCheckKeys} disabled={checking} className="h-11 px-4 inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-white font-mono text-[12px] font-medium hover:bg-secondary transition-colors">
                    {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Keys
                  </button>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.06em] text-stone border-t border-dashed border-line pt-4">
                  <Zap className="h-3 w-3 text-amber" /> Runs entirely on your machine — your data never leaves it
                </div>
              </div>
            )}

            {activeTab==="reports" && (
              <div className="space-y-3">
                {[
                  { p:"tiktok", label:"TikTok", sub:"weighted engagement · bait ×0.5", accent:true },
                  { p:"instagram", label:"Instagram", sub:"reels · engagement", accent:false },
                  { p:"meta", label:"Meta Ads", sub:"days running · variantCount", accent:false },
                ].map(x=> (
                  <a key={x.p} href={`/report/${x.p}`} className={`flex items-center justify-between rounded-[12px] border p-4 hover:shadow-evidence transition-all ${x.accent ? "bg-ink text-paper border-ink" : "bg-white border-line hover:border-ink/15"}`}>
                    <div>
                      <div className={`font-mono text-[11px] tracking-[0.12em] ${x.accent ? "opacity-60" : "text-stone"}`}>WALL — {x.p.toUpperCase()}</div>
                      <div className="font-display text-[16px] font-semibold tracking-[-0.02em]" style={{fontFamily:"var(--font-sora)"}}>{x.label}</div>
                      <div className={`font-mono text-[11px] ${x.accent ? "opacity-60" : "text-stone"}`}>{x.sub}</div>
                    </div>
                    <span className={`h-8 w-8 grid place-items-center rounded-full ${x.accent ? "bg-amber text-ink" : "bg-ink text-paper"}`}><ExternalLink className="h-3.5 w-3.5" /></span>
                  </a>
                ))}
                <div className="rounded-[8px] bg-secondary border border-line p-3 font-mono text-[11px] leading-4 text-stone">
                  Reports are saved locally on your machine and open instantly in your browser.
                </div>
              </div>
            )}

            {activeTab==="help" && (
              <div className="space-y-4">
                <div className="rounded-[12px] border border-line bg-white p-5">
                  <h3 className="font-display text-[14px] font-semibold" style={{fontFamily:"var(--font-sora)"}}>How WhyViral works</h3>
                  <ol className="mt-3 space-y-2 font-mono text-[12px] leading-5 text-stone list-decimal list-inside">
                    <li><span className="font-medium text-ink">Find</span> — searches TikTok, Instagram and Meta for your keyword</li>
                    <li><span className="font-medium text-ink">Watch</span> — AI watches each video (hook, visuals, spoken line)</li>
                    <li><span className="font-medium text-ink">Filter</span> — keeps only on-topic, correct language</li>
                    <li><span className="font-medium text-ink">Pin</span> — clusters winning hooks and formats, every claim links to its tape</li>
                  </ol>
                  <div className="mt-4 rounded-[8px] bg-paper border border-line p-3 font-mono text-[11px] leading-4">
                    <span className="font-medium text-ink">Need help?</span> Add your keys in <a href="/settings" className="text-ink underline">Settings</a> → start with 5 videos → open your wall. Runs locally, private.
                  </div>
                </div>
                <div className="rounded-[12px] border border-line bg-paper p-4">
                  <h4 className="font-mono text-[10px] tracking-[0.12em] text-stone">TIPS</h4>
                  <ul className="mt-2 space-y-1.5 font-mono text-[11px] leading-4 text-stone list-disc list-inside">
                    <li>Use 2–3 word keywords — e.g. “magnesium gummies”, not a sentence</li>
                    <li>Start with TikTok, then try Instagram + Meta for comparison</li>
                    <li>Increase target to 20+ for a full wall (needs more pool)</li>
                    <li>Every pin links to the source — verify a cluster before you shoot</li>
                  </ul>
                </div>
                <button onClick={handleCheckKeys} disabled={checking} className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-[8px] bg-ink text-paper font-mono text-[12px] font-medium">
                  {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} {checking ? "Checking…" : "Check connections"}
                </button>
                {checkResults && (
                  <div className="space-y-2">
                    {checkResults.map((r,i)=> (
                      <div key={i} className={`flex items-center gap-2 rounded-[8px] border p-3 ${r.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                        {r.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                        <span className="font-mono text-[12px] font-medium">{r.service}</span>
                        <span className="font-mono text-[11px] text-stone flex-1 truncate">{r.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-6 py-3 bg-secondary/50 border-t border-line flex items-center justify-between font-mono text-[10px] tracking-[0.06em] text-stone">
            <span>© Manish Tiwari — WhyViral</span>
            <span><a href="https://buildwithmanish.com" className="hover:underline">buildwithmanish.com</a></span>
          </div>
        </div>

        {/* Wall / Log */}
        <div className="space-y-4">
          <div className="bg-ink text-paper rounded-[12px] overflow-hidden border border-white/10">
            <div className="h-9 flex items-center justify-between px-4 border-b border-white/10 font-mono text-[10px] tracking-[0.12em]">
              <span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-amber" /> WORKFLOW LOG</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] ${running ? "bg-amber text-ink" : "bg-white/10"}`}>{running ? "RUNNING" : "IDLE"}</span>
            </div>
            <div className="p-4">
              <pre className="bg-white/[0.06] border border-white/10 rounded-[8px] p-3 text-[11px] leading-4 font-mono overflow-auto max-h-[280px] whitespace-pre-wrap min-h-[140px]">{runLog.length ? runLog.join("\n") : "Waiting — press RUN WORKFLOW. Every line here is also in output/last-run.log"}</pre>
              {reportLinks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {reportLinks.map(r=> (
                    <a key={r} href={r.replace("output/", "/report/").replace(".html","").replace(".json","")} className="inline-flex items-center gap-1.5 rounded-full bg-amber text-ink px-3 py-1.5 font-mono text-[11px] font-semibold hover:bg-amber/90">
                      open {r.replace("output/","")} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-line rounded-[12px] p-4">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.12em] text-stone">
              <span className="flex items-center gap-1.5"><Archive className="h-3.5 w-3.5" /> LAST WALL — TIKTOK</span>
              <a href="/report/tiktok" className="text-ink hover:underline">Open wall →</a>
            </div>
            <WallPreview platform="tiktok" />
          </div>

          <div className="rounded-[12px] border border-dashed border-line bg-paper p-4 font-mono text-[11px] leading-4 text-stone">
            <span className="font-medium text-ink">Tip:</span> Start with 5 videos on TikTok — cache hits make re-runs near-free. Cached videos auto-skip the AI cost.
          </div>
        </div>
      </div>

      {/* Local per-user: recent walls + cost, actually does the job */}
      <div className="grid lg:grid-cols-[1.4fr_0.6fr] gap-6">
        <div className="rounded-[12px] border border-line bg-white overflow-hidden">
          <div className="h-9 flex items-center justify-between px-5 bg-ink text-paper font-mono text-[10px] tracking-[0.12em]">
            <span>RECENT WALLS — OUTPUT/</span>
            <a href="/history" className="opacity-60 hover:opacity-100 hover:text-amber">View all →</a>
          </div>
          <div className="p-4">
            <WallHistoryPreview />
          </div>
        </div>
        <div className="rounded-[12px] border border-line bg-white p-5">
          <div className="font-mono text-[10px] tracking-[0.12em] text-stone flex items-center gap-1.5"><span className="h-1 w-6 bg-amber" /> {runCosts.length > 0 ? "ACTUAL COST" : "COST ESTIMATOR"}</div>
          <CostEstimator count={count} platform={platform} liveCosts={runCosts.length > 0 ? runCosts : undefined} />
          {warns.length > 0 && (
            <div className="space-y-2 mt-3">
              {warns.map((w, i) => (
                <div key={i} className={`rounded-[8px] border p-3 ${w.severity === "block" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${w.severity === "block" ? "text-red-600" : "text-amber-600"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] font-medium">{w.message}</p>
                      <p className="font-mono text-[10px] text-stone mt-1">{w.advice}</p>
                    </div>
                    <button onClick={() => setWarns((prev) => prev.filter((_, idx) => idx !== i))} className="text-stone hover:text-ink"><X className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {runCosts.length === 0 && (
            <div className="mt-4 rounded-[8px] border border-line bg-paper p-3 font-mono text-[11px] leading-4 text-stone">
              <span className="font-medium text-ink">Tip:</span> Add your API keys in <a href="/settings" className="text-ink underline">Settings</a>, then run a search. Cached videos make re-runs near-free.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WallPreview({ platform }: { platform: string }) {
  const [data, setData] = useState<{ keyword: string; videos: unknown[]; patterns: { hook_type: { value: string }[] } | null } | null>(null);
  useEffect(() => { fetch(`/api/report?platform=${platform}`).then(r => r.ok ? r.json() : null).then(j => setData(j)).catch(() => setData(null)); }, [platform]);
  if (!data) return <div className="mt-3 rounded-[8px] border border-dashed border-line p-4 text-center font-mono text-[11px] text-stone">No wall yet — run a search to populate this.</div>;
  if (!data.videos?.length) return <div className="mt-3 font-mono text-[11px] text-stone">Wall is empty — try increasing the target count.</div>;
  const topHook = data.patterns?.hook_type?.[0]?.value || "—";
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
      <div className="rounded-[8px] border border-line p-3">
        <div className="tracking-[0.08em] text-stone">TAPES</div>
        <div className="mt-1 font-medium">{data.videos.length} analyzed</div>
      </div>
      <div className="rounded-[8px] border border-line p-3">
        <div className="tracking-[0.08em] text-stone">TOP HOOK</div>
        <div className="mt-1 font-medium truncate">{topHook}</div>
      </div>
      <div className="rounded-[8px] bg-ink text-paper p-3">
        <div className="tracking-[0.08em] opacity-60">BUILT BY</div>
        <div className="mt-1 font-semibold">Manish Tiwari</div>
        <div className="mt-1 text-[10px] opacity-60">for strategists</div>
      </div>
    </div>
  );
}

function WallHistoryPreview() {
  const [runs, setRuns] = useState<Array<{file:string; keyword:string; platform:string; videos:number; date:string}> | null>(null);
  useEffect(() => { fetch("/api/history").then(r=>r.json()).then(j=> setRuns((j.runs||[]).slice(0,4))).catch(()=> setRuns([])); }, []);
  if (runs === null) return <div className="font-mono text-[12px] text-stone">Loading…</div>;
  if (runs.length===0) return <div className="rounded-[8px] border border-dashed border-line bg-paper p-4 font-mono text-[12px] text-stone">No walls yet — run a search to populate this.</div>;
  return (
    <div className="space-y-2">
      {runs.map(r=> (
        <a key={r.file} href={`/report/${r.platform}`} className="flex items-center gap-3 rounded-[8px] border border-line p-3 hover:border-ink/20 hover:bg-paper transition-colors">
          <span className="h-8 w-8 rounded-[8px] bg-ink text-paper grid place-items-center font-mono text-[10px] font-bold">{r.platform.slice(0,2).toUpperCase()}</span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-[13px] font-semibold leading-4 truncate" style={{fontFamily:"var(--font-sora)"}}>{r.keyword}</span>
            <span className="block font-mono text-[11px] text-stone">{r.date} · {r.videos} tapes</span>
          </span>
          <span className="font-mono text-[11px] text-stone hidden sm:inline">→</span>
        </a>
      ))}
      <a href="/history" className="block text-center font-mono text-[11px] text-ink hover:underline pt-1">View all history →</a>
    </div>
  );
}

function CostEstimator({ count, platform, liveCosts }: { count: number; platform: string; liveCosts?: RunCost[] }) {
  // If the user has run live, show actual numbers; otherwise show pre-run estimate.
  if (liveCosts && liveCosts.length > 0) {
    const totals = liveCosts.reduce(
      (acc, c) => ({
        pool: acc.pool + c.pool,
        apify: acc.apify + c.apifyUsd,
        t1: acc.t1 + c.tier1Inr,
        t2: acc.t2 + c.tier2Inr,
        synth: acc.synth + c.synthInr,
        cacheHits: acc.cacheHits + c.cacheHits,
        legs: acc.legs + 1,
      }),
      { pool: 0, apify: 0, t1: 0, t2: 0, synth: 0, cacheHits: 0, legs: 0 }
    );
    const totalInr = totals.t1 + totals.t2 + totals.synth;
    return (
      <div className="mt-3 space-y-2 font-mono text-[11px]">
        {liveCosts.map((c) => (
          <div key={c.platform} className="rounded-[6px] bg-paper border border-line p-2 space-y-1">
            <div className="text-stone text-[10px]">{c.platform.toUpperCase()} — {c.pool} pool</div>
            {c.tier1Calls > 0 && <div className="flex justify-between"><span className="text-stone">Watched</span><span className="font-medium">₹{c.tier1Inr}{c.cacheHits > 0 ? ` (${c.cacheHits} cached)` : ""}</span></div>}
            {c.tier2Calls > 0 && <div className="flex justify-between"><span className="text-stone">Deep pass</span><span className="font-medium">₹{c.tier2Inr}</span></div>}
            {c.synthRan && <div className="flex justify-between"><span className="text-stone">Synthesis</span><span className="font-medium">₹{c.synthInr}</span></div>}
            <div className="flex justify-between"><span className="text-stone">Apify</span><span className="font-medium">${c.apifyUsd.toFixed(2)}</span></div>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-dashed border-line flex justify-between font-medium text-ink">
          <span>{totals.legs > 1 ? `×${totals.legs} platforms` : "Total"}</span>
          <span>₹{totalInr} + ${totals.apify.toFixed(2)}</span>
        </div>
        {totals.cacheHits > 0 && (
          <div className="rounded-[6px] bg-emerald-50 border border-emerald-200 p-2 text-[10px] text-emerald-700">
            {totals.cacheHits} videos reused from cache — no AI cost.
          </div>
        )}
      </div>
    );
  }

  // Pre-run estimate
  const pool = Math.max(count * 12, 300);
  const apifyCost = pool * 0.0026;
  const tier1 = count * 2.5;
  const tier2 = Math.min(8, count) * 10;
  const synth = 18;
  const total = tier1 + tier2 + synth;
  const byPlatform = platform === "all" ? total * 3 : total;
  return (
    <div className="mt-3 space-y-2 font-mono text-[11px]">
      <div className="flex justify-between"><span className="text-stone">Pool</span><span className="font-medium">~{pool} videos · ${apifyCost.toFixed(2)}</span></div>
      <div className="flex justify-between"><span className="text-stone">Watch</span><span className="font-medium">{count} × ₹2.5 ≈ ₹{tier1.toFixed(0)}</span></div>
      <div className="flex justify-between"><span className="text-stone">Deep pass</span><span className="font-medium">{Math.min(8, count)} × ₹10 ≈ ₹{tier2.toFixed(0)}</span></div>
      <div className="flex justify-between"><span className="text-stone">Synthesis</span><span className="font-medium">₹{synth}</span></div>
      <div className="pt-2 mt-2 border-t border-dashed border-line flex justify-between font-medium text-ink">
        <span>Estimate {platform === "all" ? "×3 platforms" : ""}</span><span>₹{byPlatform.toFixed(0)} + ${(platform === "all" ? apifyCost * 3 : apifyCost).toFixed(2)}</span>
      </div>
      <div className="text-[10px] leading-4 text-stone">Local, pay-as-you-go — no subscription. Cached videos skip AI costs on re-run.</div>
    </div>
  );
}
