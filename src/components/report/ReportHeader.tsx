import { fmt } from "@/lib/utils";
import type { ArchiveReport } from "@/lib/types";

export function ReportHeader({ report }: { report: ArchiveReport }) {
  const { keyword, platform, videos, meta } = report;
  const label = platform === "meta" ? "Meta ads" : platform === "instagram" ? "Instagram Reels" : "TikToks";
  const total = platform === "meta" ? `${videos.reduce((a, v) => a + (v.daysRunning ?? 0), 0)} days` : fmt(videos.reduce((a, v) => a + v.views, 0));
  const totalLabel = platform === "meta" ? "Total days running" : "Total views";
  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-white">
      {/* Evidence rail */}
      <div className="flex items-center justify-between gap-4 bg-ink text-paper px-6 h-9 font-mono text-[10px] tracking-[0.12em]">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
          EVIDENCE ARCHIVE — WALL / {platform.toUpperCase()}
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 opacity-60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> CHAIN OF CUSTODY: VERIFIED
        </span>
        <span className="hidden lg:inline-flex items-center gap-2">
          <span className="opacity-60">CURATED BY</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white text-ink px-2 py-0.5 font-medium tracking-[0.06em]">Manish Tiwari</span>
        </span>
      </div>
      <div className="p-8 md:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 font-mono text-[10px] tracking-[0.12em] text-stone">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" /> LAB No. 002 · MASTRA NODE + SHADCN
        </div>
        <h1 className="mt-4 font-display text-[36px] md:text-[48px] leading-[0.9] tracking-[-0.04em] capitalize" style={{ fontFamily: "var(--font-sora)" }}>
          {keyword}
        </h1>
        <p className="mt-3 font-mono text-[12px] leading-5 text-stone">
          {videos.length} winning {label} · ranked by <span className="font-medium text-ink">{meta.rankBy}</span> · {meta.date} · every pin links to its tape
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="inline-flex h-7 items-center rounded-full bg-ink text-paper px-3 tracking-[0.06em]">{platform}</span>
          <span className="inline-flex h-7 items-center rounded-full border border-line bg-white px-3 tracking-[0.06em]">{meta.rankBy}</span>
          <span className="inline-flex h-7 items-center rounded-full border border-amber/20 bg-amber/10 px-3 tracking-[0.06em] text-ink">Manish Tiwari — strategist</span>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="rounded-[12px] border border-line bg-white p-4">
            <div className="font-mono text-[10px] tracking-[0.12em] text-stone">WINNERS</div>
            <div className="mt-1 font-display text-[28px] leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--font-sora)" }}>{videos.length}</div>
            <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-amber" style={{ width: `${Math.min(100, videos.length * 20)}%` }} /></div>
          </div>
          <div className="rounded-[12px] border border-line bg-ink text-paper p-4">
            <div className="font-mono text-[10px] tracking-[0.12em] opacity-60">PATTERNS</div>
            <div className="mt-1 font-display text-[28px] leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--font-sora)" }}>{report.patterns ? "5×6" : "—"}</div>
            <div className="mt-1 font-mono text-[11px] opacity-60">{report.patterns ? "wall complete" : "needs 5+"}</div>
          </div>
          <div className="rounded-[12px] border border-line bg-white p-4">
            <div className="font-mono text-[10px] tracking-[0.12em] text-stone">{totalLabel.toUpperCase()}</div>
            <div className="mt-1 font-mono text-[18px] leading-none font-medium tracking-[-0.02em]">{total}</div>
            <div className="mt-2 font-mono text-[11px] text-stone">{platform === "meta" ? "conviction signal" : "proof of distribution"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
