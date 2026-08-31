"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Trash2, Database, Settings, ChevronDown, Plug, AlertCircle, Loader2 } from "lucide-react";

type Env = Record<string, string>;
type Health = { ok: boolean; message: string; service: string }[];

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  const id = `sf-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div>
      <label htmlFor={id} className="font-mono text-[11px] font-medium text-stone tracking-[0.06em] block mb-1.5">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 appearance-none rounded-[12px] border border-stone/20 bg-paper pl-3 pr-9 font-mono text-[13px] text-ink focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 cursor-pointer transition-colors"
        >
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone/50 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [env, setEnv] = useState<Env>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [cache, setCache] = useState<{ count: number; size: number; mtime: string | null } | null>(null);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [s, c] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/cache").then((r) => r.json()),
    ]);
    setEnv(s.env || {});
    setCache(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function checkConnections() {
    setHealthLoading(true);
    setHealth(null);
    try {
      const r = await fetch("/api/keys", { method: "POST" });
      const j = await r.json();
      setHealth(j.results || []);
    } catch (e) {
      setHealth([{ service: "network", ok: false, message: String(e) }]);
    }
    setHealthLoading(false);
  }

  async function save() {
    setSaving(true);
    const body: Record<string, string> = {};
    for (const k of Object.keys(env)) {
      const el = document.getElementById(`env-${k}`) as HTMLInputElement | null;
      if (el) {
        const v = el.value.trim();
        if (v && !v.includes("•")) body[k] = v;
      }
    }
    // Also include select-driven run defaults + scraper provider
    const selectKeys = ["VIDEO_COUNT", "RANK_BY", "VIEW_FLOOR", "LANGUAGE", "COUNTRY", "DEEP_COUNT", "SCRAPER_PROVIDER", "CRAWLEE_MAX_CONCURRENCY", "CRAWLEE_WITH_BROWSER"];
    for (const k of selectKeys) {
      if (env[k] !== undefined) body[k] = env[k];
    }
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    load();
    checkConnections();
  }

  async function clearCache() {
    if (!confirm("Clear all cached video analyses? Re-running will cost AI credits again.")) return;
    await fetch("/api/cache", { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="font-mono text-[13px] text-stone/50">Loading…</div>
      </div>
    );
  }

  const Field = ({ k, label, placeholder }: { k: string; label: string; placeholder?: string }) => (
    <div>
      <label htmlFor={`env-${k}`} className="font-mono text-[11px] font-medium text-stone tracking-[0.06em] block mb-1.5">{label}</label>
      <input
        id={`env-${k}`}
        defaultValue={env[k] || ""}
        placeholder={placeholder}
        type={showTokens ? "text" : "password"}
        autoComplete="off"
        spellCheck={false}
        className="w-full h-10 rounded-[12px] border border-stone/20 bg-paper px-3.5 font-mono text-[13px] text-ink placeholder:text-stone/40 focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 focus:bg-white transition-colors"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Nav — lab header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 border-b border-line" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-[10px] bg-ink grid place-items-center text-amber text-[11px] font-bold font-mono shadow-pin group-hover:shadow-[0_4px_12px_rgba(10,10,11,0.12)] transition-shadow">WV</div>
            <div className="hidden sm:block leading-none">
              <div className="font-mono text-[12px] font-bold tracking-[0.14em] text-ink">WHYVIRAL <span className="font-normal text-stone/50 text-[10px] tracking-[0.08em]">/ LAB</span></div>
              <div className="font-mono text-[10px] tracking-[0.08em] text-stone/60">Settings — local .env</div>
            </div>
            <div className="sm:hidden font-mono text-[12px] font-bold tracking-[0.1em] text-ink">WHYVIRAL</div>
          </Link>
          <nav className="flex items-center gap-1.5" aria-label="Primary">
            <Link href="/" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">Console</Link>
            <Link href="/history" className="h-8 px-4 hidden sm:inline-flex items-center justify-center rounded-full font-mono text-[12px] font-medium text-stone hover:bg-stone-100 hover:text-ink transition-colors">History</Link>
            <Link href="/settings" aria-current="page" aria-label="Settings" className="h-8 w-8 grid place-items-center rounded-full bg-ink text-white"><Settings className="h-4 w-4" aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Header — dossier title */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] font-bold tracking-[-0.04em] text-ink" style={{fontFamily:"var(--font-sora)"}}>Settings</h1>
            <p className="font-mono text-[13px] leading-5 text-stone mt-1">Local <span className="font-semibold text-ink">.env</span> — no cloud, no sync. Writes directly to disk.</p>
          </div>
          <button
            onClick={() => setShowTokens((v) => !v)}
            aria-pressed={showTokens}
            className="h-9 px-3.5 rounded-full border border-line bg-white font-mono text-[12px] font-medium text-stone flex items-center gap-1.5 hover:bg-paper hover:text-ink hover:border-stone/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            {showTokens ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
            {showTokens ? "Hide" : "Show"} tokens
          </button>
        </div>

        {/* Connections health */}
        <div className="bg-white rounded-[16px] border border-line shadow-sm overflow-hidden">
          <div className="min-h-[44px] px-5 flex items-center justify-between border-b border-line gap-4 py-2">
            <div className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.08em] text-stone">
              <Plug className="h-3.5 w-3.5" aria-hidden="true" /> CONNECTIONS
            </div>
            <button
              onClick={checkConnections}
              disabled={healthLoading}
              className="h-9 min-w-[44px] px-3.5 rounded-full border border-line bg-white font-mono text-[12px] font-medium text-stone hover:bg-paper hover:text-ink disabled:opacity-50 flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              {healthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plug className="h-3.5 w-3.5" aria-hidden="true" />}
              Check now
            </button>
          </div>
          <div className="p-5">
            {!health && !healthLoading && (
              <p className="font-mono text-[13px] leading-6 text-stone">Click <span className="font-medium text-ink">Check now</span> to verify Apify + Gemini are reachable.</p>
            )}
            {healthLoading && <p className="font-mono text-[13px] text-stone">Pinging providers…</p>}
            {health && (
              <div className="space-y-2" role="status" aria-live="polite">
                {health.map((h) => (
                  <div key={h.service} className={`flex items-start gap-3 p-3.5 rounded-xl border ${h.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                    {h.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" /> : <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[12px] font-semibold text-ink">{h.service}</div>
                      <div className="font-mono text-[12px] text-stone mt-0.5 break-words leading-5">{h.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scraper provider — anti-ban safe by default */}
        <div className="bg-white rounded-[16px] border border-line shadow-sm overflow-hidden">
          <div className="min-h-[44px] px-5 flex items-center justify-between border-b border-line gap-4 py-2">
            <div className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.08em] text-stone">
              <Plug className="h-3.5 w-3.5" aria-hidden="true" /> SCRAPER PROVIDER
            </div>
            <span className="font-mono text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">anti-ban: jitter + 1 concurrency</span>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <SelectField
              label="PROVIDER (see docs/scraper-provider.md)"
              value={env.SCRAPER_PROVIDER || "auto"}
              options={[
                ["auto","auto — Crawlee + Apify fallback (recommended)"],
                ["crawlee","crawlee — 100% open-source, $0"],
                ["apify","apify — hosted only"],
              ]}
              onChange={(v) => setEnv({ ...env, SCRAPER_PROVIDER: v })}
            />
            <SelectField
              label="ANTI-BAN CONCURRENCY"
              value={env.CRAWLEE_MAX_CONCURRENCY || "1"}
              options={[["1","1 — stealthiest (default)"],["2","2 — needs proxy"],["3","3 — high risk"]]}
              onChange={(v) => setEnv({ ...env, CRAWLEE_MAX_CONCURRENCY: v })}
            />
          </div>
          <div className="px-5 pb-3 grid sm:grid-cols-2 gap-4">
            <Field k="CRAWLEE_PROXY" label="CRAWLEE_PROXY (optional)" placeholder="http://user:pass@host:port" />
            <div className="flex flex-col justify-end">
              <p className="font-mono text-[12px] leading-5 text-stone">
                Crawlee uses TikWM cache for TikTok (no direct hits) and adds jitter + Retry-After handling for IG/Meta. Keep concurrency at <span className="text-ink font-semibold">1</span> without a proxy to avoid bans.
              </p>
            </div>
          </div>
          <div className="px-5 pb-5 flex gap-2 flex-wrap">
            <label className="flex items-center gap-2.5 font-mono text-[12px] font-medium text-stone cursor-pointer min-h-[32px]">
              <input type="checkbox" checked={(env.CRAWLEE_WITH_BROWSER || "true") === "true"} onChange={(e) => setEnv({ ...env, CRAWLEE_WITH_BROWSER: e.target.checked ? "true" : "false" })} className="h-4 w-4 rounded border-stone/30 text-amber focus:ring-amber" />
              Browser fallback (Playwright)
            </label>
            <span className="font-mono text-[11px] text-stone/60 ml-2 self-center">off = fetch-only, safest for IG</span>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-[16px] border border-line shadow-sm overflow-hidden">
          <div className="min-h-[44px] px-5 flex items-center gap-2 border-b border-line font-mono text-[11px] font-medium tracking-[0.08em] text-stone">
            <Settings className="h-3.5 w-3.5" aria-hidden="true" /> API KEYS
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <Field k="APIFY_TOKEN" label="APIFY_TOKEN (optional with Crawlee)" placeholder="apify_api_…" />
            <Field k="GEMINI_API_KEY" label="GEMINI_API_KEY" placeholder="AIza…" />
          </div>
          <div className="px-5 pb-5">
            <Field k="GEMINI_MODEL" label="GEMINI_MODEL (optional)" placeholder="gemini-3.5-flash" />
          </div>
          <div className="px-5 pb-4">
            <p className="font-mono text-[12px] leading-5 text-stone">
              When <span className="font-semibold text-ink">SCRAPER_PROVIDER=crawlee</span> you can leave <span className="font-semibold text-ink">APIFY_TOKEN</span> empty — local Crawlee is $0 and ban-safe (TikWM cache + jitter). Keep a token only if you want <span className="font-semibold text-ink">auto</span> fallback.
            </p>
          </div>
        </div>

        {/* Run settings */}
        <div className="bg-white rounded-[16px] border border-line shadow-sm overflow-hidden">
          <div className="min-h-[44px] px-5 flex items-center gap-2 border-b border-line font-mono text-[11px] font-medium tracking-[0.08em] text-stone">
            RUN DEFAULTS
          </div>
          <div className="p-5 grid sm:grid-cols-3 gap-4">
            <SelectField
              label="VIDEO COUNT"
              value={env.VIDEO_COUNT || "5"}
              options={[["5","5"],["10","10"],["20","20"],["30","30"],["50","50"],["100","100"]]}
              onChange={(v) => setEnv({ ...env, VIDEO_COUNT: v })}
            />
            <SelectField
              label="RANK BY"
              value={env.RANK_BY || "engagement"}
              options={[["engagement","Engagement"],["reach","Reach"],["views","Views"]]}
              onChange={(v) => setEnv({ ...env, RANK_BY: v })}
            />
            <SelectField
              label="VIEW FLOOR"
              value={String(env.VIEW_FLOOR || "100000")}
              options={[["0","0"],["50000","50K"],["100000","100K"],["500000","500K"],["1000000","1M"]]}
              onChange={(v) => setEnv({ ...env, VIEW_FLOOR: v })}
            />
            <SelectField
              label="LANGUAGE"
              value={env.LANGUAGE || "en"}
              options={[["en","English"],["id","Indonesian"],["any","Any"]]}
              onChange={(v) => setEnv({ ...env, LANGUAGE: v })}
            />
            <SelectField
              label="COUNTRY"
              value={env.COUNTRY || "US"}
              options={[["US","US"],["GB","UK"],["AU","AU"],["IN","IN"],["CA","CA"],["ALL","All"]]}
              onChange={(v) => setEnv({ ...env, COUNTRY: v })}
            />
            <SelectField
              label="DEEP COUNT"
              value={String(env.DEEP_COUNT || "8")}
              options={[["0","Off"],["3","3"],["5","5"],["8","8 (default)"],["12","12"],["20","20"]]}
              onChange={(v) => setEnv({ ...env, DEEP_COUNT: v })}
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            aria-busy={saving}
            className="h-11 px-6 rounded-full bg-amber text-ink font-mono text-[13px] font-semibold flex items-center gap-2 hover:bg-amber/90 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="font-mono text-[13px] font-medium text-emerald-600" role="status" aria-live="polite">✓ Saved</span>}
          <a href="/api/settings" target="_blank" rel="noreferrer" className="ml-auto font-mono text-[12px] font-medium text-stone hover:text-ink underline decoration-dotted underline-offset-4 transition-colors">View raw .env →</a>
        </div>

        {/* Cache + privacy */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-[16px] border border-line shadow-sm p-5">
            <div className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.08em] text-stone mb-3">
              <Database className="h-3.5 w-3.5" aria-hidden="true" /> ANALYSIS CACHE
            </div>
            {cache ? (
              <>
                <div className="flex items-baseline gap-2">
                  <div className="font-display text-[32px] font-bold leading-none text-ink tabular-nums">{cache.count}</div>
                  <span className="font-mono text-[12px] text-stone">tapes cached · {(cache.size / 1024).toFixed(1)} KB</span>
                </div>
                <p className="font-mono text-[11px] text-stone/60 mt-1">
                  {cache.mtime ? `Updated ${new Date(cache.mtime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : "Never"}
                </p>
                <button
                  onClick={clearCache}
                  className="mt-4 h-9 px-3.5 rounded-full border border-red-200 bg-red-50 font-mono text-[12px] font-medium text-red-700 flex items-center gap-1.5 hover:bg-red-100 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear cache
                </button>
              </>
            ) : (
              <p className="font-mono text-[13px] text-stone">No cache yet.</p>
            )}
          </div>

          <div className="bg-ink text-white rounded-[16px] border border-white/10 p-5 sm:p-6">
            <div className="font-mono text-[11px] font-medium tracking-[0.08em] text-white/40 mb-2">PRIVATE & LOCAL</div>
            <p className="font-mono text-[13px] leading-6 text-white/80">
              Keys live in <span className="text-white font-semibold">.env</span> (not committed). Reports in <span className="text-white font-semibold">output/</span>. Wipe the folder to erase everything.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/history" className="h-9 px-4 rounded-full bg-white text-ink font-mono text-[12px] font-medium flex items-center hover:bg-stone-100 active:scale-[0.98] transition-all">History</Link>
              <Link href="/" className="h-9 px-4 rounded-full border border-white/20 font-mono text-[12px] font-medium flex items-center hover:bg-white/10 active:scale-[0.98] transition-all">Console →</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
