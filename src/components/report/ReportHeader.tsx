import { fmt } from "@/lib/utils";
import type { ArchiveReport } from "@/lib/types";

export function ReportHeader({ report }: { report: ArchiveReport }) {
  const { keyword, platform, videos, meta } = report;
  const label = platform === "meta" ? "Meta ads" : platform === "instagram" ? "Instagram Reels" : "TikToks";
  const total = platform === "meta" ? `${videos.reduce((a, v) => a + (v.daysRunning ?? 0), 0)} days` : fmt(videos.reduce((a, v) => a + v.views, 0));
  const totalLabel = platform === "meta" ? "days running" : "views";
  const wallReady = !!report.patterns;
  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-dossier">
      {/* Rail — lab dossier header */}
      <div className="bg-ink text-paper px-5 sm:px-7 h-[44px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-6 w-6 rounded-full bg-white/10 border border-white/10 grid place-items-center shrink-0"><span className="h-2 w-2 rounded-full bg-amber" aria-hidden="true" /></span>
          <span className="font-mono text-[11px] font-semibold tracking-[0.08em] truncate">EVIDENCE ARCHIVE — WALL / {platform.toUpperCase()}</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" /> VERIFIED</span>
        </div>
        <span className="hidden lg:inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.06em] text-white/60">Lab No. 002 · <span className="text-white">Manish Tiwari</span></span>
      </div>

      {/* Dossier cover — editorial, not metric cards */}
      <div className="grid lg:grid-cols-[1.35fr_0.75fr] gap-0">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.06em] text-stone">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" /> CASE FILE · {meta.date} · ranked by {meta.rankBy}
          </div>
          <h1 className="mt-4 font-display text-[34px] sm:text-[44px] lg:text-[48px] leading-[0.88] tracking-[-0.04em] capitalize text-balance" style={{ fontFamily: "var(--font-sora)" }}>
            {keyword}
          </h1>
          <p className="mt-3 font-mono text-[13px] leading-6 text-stone max-w-[52ch]">
            {videos.length} winning {label} — every pattern pins to its source tape. <span className="text-ink font-medium">No scores, just receipts.</span>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-full bg-ink text-white px-3 font-mono text-[11px] font-semibold tracking-[0.02em]">{platform}</span>
            <span className="inline-flex h-7 items-center rounded-full border border-line bg-white px-3 font-mono text-[11px] font-medium">{meta.rankBy} · {meta.date}</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-stone/60"><span className="h-1 w-6 bg-amber rounded-full" aria-hidden="true" /> {wallReady ? "wall complete — 5×6 pins" : "needs 5+ tapes for wall"}</span>
          </div>
        </div>

        {/* Evidence summary — single bar, not three equal cards */}
        <div className="bg-paper/60 border-t lg:border-t-0 lg:border-l border-line p-6 lg:p-7 flex flex-col justify-center gap-5">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-mono text-[11px] font-semibold tracking-[0.08em] text-stone">WINNERS ANALYZED</div>
              <div className="font-mono text-[11px] tracking-[0.06em] text-stone/60">{wallReady ? "● wall pinned" : "○ building"}</div>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <div className="font-display text-[44px] leading-none tracking-[-0.04em] tabular-nums" style={{ fontFamily: "var(--font-sora)" }}>{videos.length}</div>
              <div className="font-mono text-[13px] leading-4 text-stone">tapes<br /><span className="text-stone/60">verified</span></div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white border border-line overflow-hidden flex p-0.5">
              <div className="h-full rounded-full bg-amber transition-all duration-700" style={{ width: `${Math.min(100, videos.length * 14)}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-5 border-t border-dashed border-line/70">
            <div>
              <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-stone/60">PATTERNS</div>
              <div className="mt-1 font-mono text-[18px] font-bold tracking-[-0.02em]">{wallReady ? "5 × 6" : "—"}</div>
              <div className="font-mono text-[11px] text-stone/60">{wallReady ? "dims × pins" : "needs 5+"}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] font-semibold tracking-[0.08em] text-stone/60">{totalLabel.toUpperCase()}</div>
              <div className="mt-1 font-mono text-[18px] font-bold tracking-[-0.02em] tabular-nums">{total}</div>
              <div className="font-mono text-[11px] text-stone/60">{platform === "meta" ? "conviction" : "distribution"}</div>
            </div>
          </div>
          <div className="rounded-[12px] bg-ink text-paper p-3 flex items-center gap-2.5">
            <span className="h-7 w-7 rounded-full bg-white/10 grid place-items-center shrink-0">✓</span>
            <span className="font-mono text-[11px] leading-4">Every pin links to its tape —<br /><span className="text-white/60">verify before you create.</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
