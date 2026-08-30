"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Save, Eye, EyeOff, Trash2, Database, Settings, ChevronDown } from "lucide-react";

type Env = Record<string, string>;

function SelectField({ label, value, options }: { label: string; value: string; options: Array<[string, string]> }) {
  return (
    <div>
      <label className="font-mono text-[10px] text-stone/60 tracking-wider block mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          className="w-full h-9 appearance-none rounded-lg border border-stone/20 bg-paper pl-3 pr-8 font-mono text-[12px] text-ink focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 cursor-pointer"
        >
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone/40 pointer-events-none" />
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
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    load();
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
      <label htmlFor={`env-${k}`} className="font-mono text-[10px] text-stone/60 tracking-wider block mb-1.5">{label}</label>
      <input
        id={`env-${k}`}
        defaultValue={env[k] || ""}
        placeholder={placeholder}
        type={showTokens ? "text" : "password"}
        className="w-full h-9 rounded-lg border border-stone/20 bg-paper px-3 font-mono text-[13px] text-ink focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone/10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-ink grid place-items-center text-amber text-[10px] font-bold font-mono">WV</div>
            <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-ink">WHYVIRAL</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50">Console</Link>
            <Link href="/history" className="h-8 px-3 flex items-center rounded-lg font-mono text-[11px] text-stone hover:bg-stone-50">History</Link>
            <Link href="/settings" className="h-8 px-3 flex items-center rounded-lg bg-stone-100 font-mono text-[11px]">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Settings</h1>
            <p className="font-mono text-[12px] text-stone/60 mt-1">Local .env — no cloud, no sync.</p>
          </div>
          <button
            onClick={() => setShowTokens((v) => !v)}
            className="h-8 px-3 rounded-lg border border-stone/20 bg-white font-mono text-[11px] text-stone flex items-center gap-1.5 hover:bg-stone-50 transition-colors"
          >
            {showTokens ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showTokens ? "Hide" : "Show"} tokens
          </button>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-xl border border-stone/10 shadow-sm overflow-hidden">
          <div className="h-10 px-5 flex items-center gap-2 border-b border-stone/10 font-mono text-[11px] tracking-wider text-stone/60">
            <Settings className="h-3.5 w-3.5" /> API KEYS
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <Field k="APIFY_TOKEN" label="APIFY_TOKEN" placeholder="apify_api_…" />
            <Field k="GEMINI_API_KEY" label="GEMINI_API_KEY" placeholder="AIza…" />
          </div>
          <div className="px-5 pb-5">
            <Field k="GEMINI_MODEL" label="GEMINI_MODEL (optional)" placeholder="gemini-3.5-flash" />
          </div>
        </div>

        {/* Run settings */}
        <div className="bg-white rounded-xl border border-stone/10 shadow-sm overflow-hidden">
          <div className="h-10 px-5 flex items-center gap-2 border-b border-stone/10 font-mono text-[11px] tracking-wider text-stone/60">
            RUN DEFAULTS
          </div>
          <div className="p-5 grid sm:grid-cols-3 gap-4">
            <SelectField
              label="VIDEO COUNT"
              value={env.VIDEO_COUNT || "5"}
              options={[["5","5"],["10","10"],["20","20"],["30","30"],["50","50"],["100","100"]]}
            />
            <SelectField
              label="RANK BY"
              value={env.RANK_BY || "engagement"}
              options={[["engagement","Engagement"],["reach","Reach"],["views","Views"]]}
            />
            <SelectField
              label="VIEW FLOOR"
              value={String(env.VIEW_FLOOR || "100000")}
              options={[["0","0"],["50000","50K"],["100000","100K"],["500000","500K"],["1000000","1M"]]}
            />
            <SelectField
              label="LANGUAGE"
              value={env.LANGUAGE || "en"}
              options={[["en","English"],["id","Indonesian"],["any","Any"]]}
            />
            <SelectField
              label="COUNTRY"
              value={env.COUNTRY || "US"}
              options={[["US","US"],["GB","UK"],["AU","AU"],["IN","IN"],["CA","CA"],["ALL","All"]]}
            />
            <SelectField
              label="DEEP COUNT"
              value={String(env.DEEP_COUNT || "8")}
              options={[["0","Off"],["3","3"],["5","5"],["8","8 (default)"],["12","12"],["20","20"]]}
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-amber text-ink font-mono text-[12px] font-semibold flex items-center gap-2 hover:bg-amber/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <div className="h-4 w-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="font-mono text-[12px] text-emerald-600">✓ Saved</span>}
          <a href="/api/settings" target="_blank" className="ml-auto font-mono text-[11px] text-stone/60 hover:text-stone transition-colors">View raw .env →</a>
        </div>

        {/* Cache + privacy */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-stone/10 shadow-sm p-5">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-stone/60 mb-3">
              <Database className="h-3.5 w-3.5" /> ANALYSIS CACHE
            </div>
            {cache ? (
              <>
                <div className="flex items-baseline gap-2">
                  <div className="font-display text-[32px] font-bold leading-none text-ink">{cache.count}</div>
                  <span className="font-mono text-[11px] text-stone/60">tapes cached · {(cache.size / 1024).toFixed(1)} KB</span>
                </div>
                <p className="font-mono text-[10px] text-stone/50 mt-1">
                  {cache.mtime ? `Updated ${new Date(cache.mtime).toLocaleString()}` : "Never"}
                </p>
                <button
                  onClick={clearCache}
                  className="mt-4 h-8 px-3 rounded-lg border border-red-200 bg-red-50 font-mono text-[11px] text-red-700 flex items-center gap-1.5 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Clear cache
                </button>
              </>
            ) : (
              <p className="font-mono text-[12px] text-stone/50">No cache yet.</p>
            )}
          </div>

          <div className="bg-ink text-white rounded-xl border border-white/10 p-5">
            <div className="font-mono text-[10px] tracking-wider text-white/40 mb-2">PRIVATE & LOCAL</div>
            <p className="font-mono text-[12px] leading-5 text-white/80">
              Keys live in <span className="text-white font-medium">.env</span> (not committed). Reports in <span className="text-white font-medium">output/</span>. Wipe the folder to erase everything.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/history" className="h-8 px-3 rounded-lg bg-white text-ink font-mono text-[11px] flex items-center">History</Link>
              <Link href="/" className="h-8 px-3 rounded-lg border border-white/20 font-mono text-[11px] flex items-center">Console →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
