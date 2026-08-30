"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Save, Eye, EyeOff, Trash2, Database, Settings2 } from "lucide-react";

type Env = Record<string,string>;

export default function SettingsPage() {
  const [env, setEnv] = useState<Env>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [cache, setCache] = useState<{count:number; size:number; mtime:string|null} | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    const [s, c] = await Promise.all([fetch("/api/settings").then(r=>r.json()), fetch("/api/cache").then(r=>r.json())]);
    setEnv(s.env || {});
    setCache(c);
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function save() {
    setSaving(true);
    // Collect values from inputs (unmasked)
    const body: Record<string,string> = {};
    for (const k of Object.keys(env)) {
      const el = document.getElementById(`env-${k}`) as HTMLInputElement | null;
      if (el) {
        const v = el.value.trim();
        if (v && !v.includes("•")) body[k]=v;
      }
    }
    const res = await fetch("/api/settings", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(()=>setSaved(false),2000); load(); }
  }
  async function clearCache() {
    if (!confirm("Clear analysis cache (output/analyses.json)? Cached Gemini watches will be lost and re-run will cost again.")) return;
    await fetch("/api/cache", { method:"DELETE" });
    load();
  }

  if (loading) return <div className="font-mono text-[13px] text-stone p-8">Loading settings…</div>;

  const Field = ({ k, label, placeholder, type="text", mono=false }: { k:string; label:string; placeholder?:string; type?:string; mono?:boolean }) => (
    <div>
      <label htmlFor={`env-${k}`} className="font-mono text-[10px] tracking-[0.12em] text-stone">{label}</label>
      <input id={`env-${k}`} defaultValue={env[k]||""} placeholder={placeholder} type={showTokens ? "text" : type} className={`mt-1.5 flex h-9 w-full rounded-[8px] border border-line bg-white px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber/20 focus:border-amber ${mono ? "font-mono" : ""}`} />
    </div>
  );

  return (
    <div className="space-y-6 max-w-[960px]">
      <div className="rounded-[12px] border border-line bg-white overflow-hidden">
        <div className="h-9 flex items-center justify-between px-6 bg-ink text-paper font-mono text-[10px] tracking-[0.12em]">
          <span className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5 text-amber" /> SETTINGS — LOCAL .ENV</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 opacity-60">Manish Tiwari · private, file-based</span>
        </div>
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <h1 className="font-display text-[22px] font-bold tracking-[-0.02em]" style={{fontFamily:"var(--font-sora)"}}>Settings</h1>
            <p className="mt-1 font-mono text-[12px] text-stone">All keys stay on your machine in <span className="font-medium text-ink">.env</span> (600). No cloud. <button onClick={()=>setShowTokens(v=>!v)} className="inline-flex items-center gap-1 ml-2 text-ink hover:underline">{showTokens ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {showTokens ? "Hide" : "Show"}</button></p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field k="APIFY_TOKEN" label="APIFY_TOKEN — Apify (scrape)" placeholder="apify_api_..." mono />
            <Field k="GEMINI_API_KEY" label="GEMINI_API_KEY — Gemini (watch)" placeholder="AIza..." mono />
            <Field k="GEMINI_MODEL" label="GEMINI_MODEL" placeholder="gemini-3.5-flash" />
            <Field k="GOOGLE_CLOUD_PROJECT" label="GOOGLE_CLOUD_PROJECT (Vertex, optional)" placeholder="my-gcp-project" />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Field k="VIDEO_COUNT" label="VIDEO_COUNT — target winners" placeholder="5" />
            <Field k="VIEW_FLOOR" label="VIEW_FLOOR — min views" placeholder="100000" />
            <Field k="RANK_BY" label="RANK_BY — engagement | reach | views" placeholder="engagement" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Field k="LANGUAGE" label="LANGUAGE — en | id | any" placeholder="en" />
            <Field k="COUNTRY" label="COUNTRY — US | GB | ALL" placeholder="US" />
            <Field k="DEEP_COUNT" label="DEEP_COUNT — top script tables" placeholder="8" />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={save} disabled={saving} className="h-10 px-5 inline-flex items-center gap-2 rounded-[8px] bg-amber text-ink font-mono text-[13px] font-semibold hover:bg-amber/90 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save .env"}
            </button>
            {saved && <span className="inline-flex items-center gap-1 font-mono text-[12px] text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
            <a href="/api/settings" target="_blank" className="ml-auto font-mono text-[11px] text-stone hover:text-ink">View raw</a>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-[12px] border border-line bg-white p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-stone"><Database className="h-3.5 w-3.5" /> CACHE — ANALYSES.JSON</div>
          {cache ? (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="font-display text-[28px] leading-none font-bold" style={{fontFamily:"var(--font-sora)"}}>{cache.count}</div>
                <span className="font-mono text-[11px] text-stone">tapes cached · {(cache.size/1024).toFixed(1)} KB</span>
              </div>
              <div className="mt-2 font-mono text-[11px] text-stone">Updated {cache.mtime ? new Date(cache.mtime).toLocaleString() : "—"}</div>
              <button onClick={clearCache} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 font-mono text-[11px] text-red-700 hover:bg-red-100">
                <Trash2 className="h-3 w-3" /> Clear cache
              </button>
            </>
          ) : <div className="font-mono text-[12px] text-stone mt-3">No cache</div>}
        </div>
        <div className="rounded-[12px] border border-line bg-ink text-paper p-5">
          <div className="font-mono text-[10px] tracking-[0.12em] opacity-60">LOCAL ONLY</div>
          <div className="mt-2 font-display text-[16px] font-semibold leading-5" style={{fontFamily:"var(--font-sora)"}}>No cloud. No sync. No tracking without opt-in.</div>
          <p className="mt-2 font-mono text-[11px] leading-4 opacity-70">Keys in <span className="text-paper">.env</span> (600). Reports in <span className="text-paper">output/</span>. Delete the folder to wipe everything. Built by Manish Tiwari.</p>
          <div className="mt-4 flex gap-2">
            <a href="/history" className="inline-flex h-8 items-center rounded-full bg-white text-ink px-3 font-mono text-[11px] font-medium">History</a>
            <a href="/" className="inline-flex h-8 items-center rounded-full border border-white/20 px-3 font-mono text-[11px]">Bench</a>
          </div>
        </div>
      </div>
    </div>
  );
}
