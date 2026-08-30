"use client";
import { useState } from "react";
import { ChevronDown, ExternalLink, Clock, Eye, Heart, MessageCircle, Share2, Package, FileText } from "lucide-react";
import { fmt } from "@/lib/utils";
import type { Video, Analysis } from "@/lib/types";

function Metric({ icon: Icon, value }: { icon: typeof Eye; value: string }) {
  return <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-stone"><Icon className="h-3.5 w-3.5" /> {value}</span>;
}

export function VideoCard({ video, analysis, label }: { video: Video; analysis: Analysis; label: string }) {
  const [open, setOpen] = useState(false);
  const isDeep = analysis?.analysis_tier === "2" || (Array.isArray(analysis?.script) && analysis.script.length > 0);
  const isIG = video.platform === "instagram";
  const isMeta = video.platform === "meta";
  const platformName = isMeta ? "Meta Ad Library" : isIG ? "Instagram" : "TikTok";
  const metricDisplay = isMeta ? `${video.daysRunning} days · ${(video.variantCount ?? 0) > 1 ? `${video.variantCount} variants` : "single"}` : `${fmt(video.views)} views`;

  return (
    <div className={`overflow-hidden rounded-[12px] border bg-white transition-colors ${open ? "border-amber/40 shadow-evidence" : "border-line hover:border-ink/15"}`}>
      <button onClick={()=>setOpen(v=>!v)} className="flex w-full items-center gap-3 px-4 md:px-5 h-[56px] text-left">
        <span className={`grid place-items-center h-7 w-7 rounded-full border shrink-0 transition-colors ${open ? "bg-amber text-ink border-amber" : "bg-white border-line text-stone"}`}>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.08em] bg-ink text-paper px-2 py-1 rounded-full">{label}</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] bg-secondary border border-line px-2.5 py-1 rounded-full">{metricDisplay}</span>
        </span>
        <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[11px]">{analysis?.format || "—"}</span>
        {analysis?.duration_seconds && <span className="hidden lg:inline-flex items-center gap-1 font-mono text-[11px] text-stone"><Clock className="h-3 w-3" /> {analysis.duration_seconds}s</span>}
        <span className="ml-auto hidden xl:inline-flex items-center gap-1 font-mono text-[11px] text-stone">↗ {platformName}</span>
        <a href={video.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="ml-auto xl:ml-2 inline-flex items-center gap-1 rounded-full bg-ink text-paper px-3 py-1.5 font-mono text-[11px] font-medium hover:bg-ink/90">
          open <ExternalLink className="h-3 w-3" />
        </a>
      </button>

      {open && (
        <div className="border-t border-line animate-[log-in_340ms_cubic-bezier(0.16,1,0.3,1)]">
          {/* Evidence meta rail */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-paper border-b border-line font-mono text-[11px]">
            {!isMeta ? (
              <>
                <Metric icon={Eye} value={`${fmt(video.views)} views`} />
                <Metric icon={Heart} value={`${fmt(video.likes)} likes`} />
                <Metric icon={MessageCircle} value={`${fmt(video.comments)} comments`} />
                <Metric icon={Share2} value={`${fmt(video.shares)} shares`} />
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white border border-line px-2.5 py-1"><Package className="h-3 w-3" /> @{video.author}</span>
              </>
            ) : (
              <>
                <Metric icon={Clock} value={`${video.daysRunning} days running`} />
                { (video.variantCount ?? 0) > 1 && <span className="inline-flex items-center rounded-full bg-amber text-ink px-2.5 py-1 font-medium">{video.variantCount} variants — conviction signal</span>}
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white border border-line px-2.5 py-1">@{video.author}</span>
              </>
            )}
          </div>

          <div className="p-5 space-y-5 bg-white">
            {/* Preview — local, actually does the job */}
            <div className="rounded-[12px] border border-line overflow-hidden bg-paper">
              <div className="flex items-center justify-between px-4 h-8 bg-ink text-paper font-mono text-[10px] tracking-[0.12em]">
                <span>PREVIEW — {platformName.toUpperCase()}</span>
                <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber hover:text-white">Open on {platformName} ↗</a>
              </div>
              <div className="p-3">
                {video.videoUrl ? (
                  <video
                    src={video.videoUrl}
                    controls
                    preload="metadata"
                    poster=""
                    className="w-full max-h-[320px] rounded-[8px] bg-ink object-contain"
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = "none";
                      const msg = el.nextElementSibling as HTMLElement | null;
                      if (msg) msg.style.display = "block";
                    }}
                  />
                ) : null}
                <div className={`rounded-[8px] border border-dashed border-line bg-white p-3 font-mono text-[11px] leading-4 text-stone ${video.videoUrl ? "hidden" : ""}`} style={{ display: video.videoUrl ? "none" : "block" }}>
                  {isMeta ? "Meta preview requires opening on Ad Library — video is not directly embeddable." : "No preview URL — link expired (IG links expire in 24–48h) or scrape missed. Open on " + platformName + " to watch. The analysis below is still valid — Gemini watched the original file at scrape time."}
                </div>
                {!video.videoUrl && null}
                <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-stone">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white border border-line px-2 py-1">ID: {video.id || "—"}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white border border-line px-2 py-1">{video.caption ? `${video.caption.slice(0,48)}${video.caption.length>48?"…":""}` : "no caption"}</span>
                </div>
              </div>
            </div>
            {/* About + Format */}
            <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-3">
              <div className="rounded-[12px] border border-line p-4">
                <div className="font-mono text-[10px] tracking-[0.12em] text-stone flex items-center gap-1.5"><FileText className="h-3 w-3" /> ABOUT</div>
                <div className="mt-2 font-mono text-[13px] leading-5">{analysis?.primary_topic || "—"}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex rounded-full bg-ink text-paper px-2.5 py-1 font-mono text-[11px]">{analysis?.format || "—"}</span>
                  <span className="inline-flex rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[11px]">{analysis?.hook_type || "—"}</span>
                  <span className="inline-flex rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[11px]">{analysis?.tone || "—"}</span>
                </div>
              </div>
              <div className="rounded-[12px] border border-line bg-paper p-4">
                <div className="font-mono text-[10px] tracking-[0.12em] text-stone">CHAIN OF CUSTODY</div>
                <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between"><span className="text-stone">Duration</span><span className="font-medium">{analysis?.duration_seconds ? `${analysis.duration_seconds}s` : "unknown"}</span></div>
                  <div className="flex justify-between"><span className="text-stone">Pacing</span><span className="font-medium">{analysis?.pacing || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-stone">B-roll</span><span className="font-medium">{analysis?.broll_ratio || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-stone">Visual</span><span className="font-medium">{analysis?.visual_style || "—"}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed border-line font-mono text-[10px] tracking-[0.06em] text-stone">© Manish Tiwari — WhyViral · Built with proof</div>
              </div>
            </div>

            {/* Hook — evidence photo */}
            <div>
              <div className="font-mono text-[10px] tracking-[0.12em] text-stone flex items-center gap-1.5"><span className="h-1 w-6 bg-amber" /> HOOK — FIRST 3 SECONDS</div>
              <div className="mt-3 grid gap-3">
                <div className="rounded-[12px] border border-line overflow-hidden">
                  <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
                    <div className="p-4">
                      <div className="font-mono text-[10px] tracking-[0.12em] text-stone">SPOKEN</div>
                      <div className="mt-2 font-mono text-[13px] leading-5">“{analysis?.hook?.spoken || "none"}”</div>
                    </div>
                    <div className="p-4 bg-paper">
                      <div className="font-mono text-[10px] tracking-[0.12em] text-stone">VISUAL</div>
                      <div className="mt-2 text-[13px] leading-5">{analysis?.hook?.visual || "none"}</div>
                    </div>
                    <div className="p-4">
                      <div className="font-mono text-[10px] tracking-[0.12em] text-stone">ON-SCREEN TEXT</div>
                      <div className="mt-2 font-mono text-[13px] leading-5">“{analysis?.hook?.on_screen_text || "none"}”</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Script — aligned log */}
            <div>
              <div className="font-mono text-[10px] tracking-[0.12em] text-stone flex items-center gap-1.5"><span className="h-1 w-6 bg-ink" /> SCRIPT — ALIGNED</div>
              {isDeep ? (
                <div className="mt-3 overflow-hidden rounded-[12px] border border-line">
                  <div className="overflow-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-ink text-paper font-mono text-[10px] tracking-[0.12em]">
                          <th className="text-left px-4 py-2.5 font-medium w-10">#</th>
                          <th className="text-left px-4 py-2.5 font-medium">Verbal</th>
                          <th className="text-left px-4 py-2.5 font-medium">Visual</th>
                          <th className="text-left px-4 py-2.5 font-medium">On-screen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {(analysis?.script || []).length ? (analysis.script || []).map((row,ix)=> (
                          <tr key={ix} className="hover:bg-paper">
                            <td className="px-4 py-3 font-mono text-[11px] text-stone text-right">{ix+1}</td>
                            <td className="px-4 py-3 font-mono text-[12px]">“{row.spoken || "none"}”</td>
                            <td className="px-4 py-3 text-[12px] leading-5">{row.visual || ""}</td>
                            <td className="px-4 py-3 font-mono text-[11px]">“{row.on_screen_text || "none"}”</td>
                          </tr>
                        )) : <tr><td colSpan={4} className="px-4 py-8 text-center font-mono text-[12px] text-stone">No script rows captured.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[12px] border border-dashed border-line bg-paper p-4 font-mono text-[12px] leading-5 text-stone">Not deep-analyzed — aligned script is only for top winners (raise <span className="font-medium text-ink">DEEP_COUNT</span>).</div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-dashed border-line">
              <div className="rounded-[12px] border border-line p-4">
                <div className="font-mono text-[10px] tracking-[0.12em] text-stone">WHY IT WORKS</div>
                <div className="mt-2 text-[13px] leading-5">{analysis?.why_it_works || "—"}</div>
              </div>
              <div className="rounded-[12px] border border-line p-4">
                <div className="font-mono text-[10px] tracking-[0.12em] text-stone">KEY CLAIMS</div>
                <ul className="mt-2 space-y-1.5">
                  {(analysis?.key_claims || []).length ? analysis.key_claims.map((c,i)=> <li key={i} className="flex gap-2 text-[12px] leading-5"><span className="mt-2 h-1 w-1 rounded-full bg-amber shrink-0" /> {c}</li>) : <li className="font-mono text-[12px] text-stone">—</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
