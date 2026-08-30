import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import { Logo } from "@/components/Logo";
import "./globals.css";

/* THESIS: WhyViral — the bench, not the dashboard.
   OWN-WORLD: Ink #0a0a0b + Paper #fdfbf7 + Amber pin. String board, logbook, evidence bag.
   STORY: strategist arrives to run or read — sees the console, sees the wall, acts.
   FIRST VIEWPORT: Ink header (lab No.002 + Manish Tiwari) → bench (console left 448px + wall right)
   FORM: Archive Terminal + String Board — Restrained palette, committed type, one string-draw motion.
*/

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "WhyViral | Manish Tiwari",
  description: "WhyViral — answer the question every strategist asks. AI watches real videos from TikTok, Instagram, and Meta and pins the hooks, visuals and angles that earn distribution, with proof links. Built by Manish Tiwari.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-paper font-sans antialiased text-[14px] leading-[1.5] text-ink selection:bg-amber selection:text-ink">
        {/* Top amber rule — the evidence tape */}
        <div className="h-[2px] w-full bg-amber" aria-hidden />
        {/* Ink header — the bench */}
        <header className="sticky top-0 z-40 w-full bg-ink text-paper border-b border-white/[0.08]">
          <div className="mx-auto max-w-[1280px] flex h-[56px] items-center justify-between px-6 gap-6">
            <a href="/" className="flex items-center gap-3 shrink-0 group">
              <Logo size={28} className="shrink-0 rounded-[7px] overflow-hidden" />
              <span className="font-mono text-[11px] tracking-[0.14em] leading-none hidden sm:block">
                <span className="font-semibold">WHYVIRAL</span>
                <span className="opacity-60"> — FIND THE WINNING WHY</span>
              </span>
              <span className="font-mono text-[11px] tracking-[0.14em] font-semibold sm:hidden">ARCHIVE</span>
            </a>
            <nav className="flex items-center gap-1 sm:gap-1.5 text-[12px] font-mono">
              <a href="/" className="px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-colors hidden md:inline-flex">Bench</a>
              <a href="/report/tiktok" className="px-2.5 py-1.5 rounded-full bg-white text-ink font-medium">Wall</a>
              <a href="/history" className="px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-colors">History</a>
              <a href="/settings" className="px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-colors">Settings</a>
            </nav>
            <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-white/10">
              <div className="hidden lg:block text-right leading-none">
                <div className="font-mono text-[11px] tracking-[0.08em] font-medium">Manish Tiwari</div>
                <div className="font-mono text-[10px] tracking-[0.06em] opacity-60">Built for strategists</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-amber text-ink grid place-items-center font-mono text-[11px] font-bold">MT</div>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 px-2 py-1 font-mono text-[10px] tracking-[0.08em]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-6 py-8 md:py-10">{children}</main>
        <footer className="mx-auto max-w-[1280px] px-6">
          <div className="border-t border-line pt-6 pb-10 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] font-mono">
            <div className="flex items-center gap-2">
              <Logo size={20} className="shrink-0 rounded-[5px]" />
              <span className="tracking-[0.08em]">WHYVIRAL — FIND THE WINNING WHY</span>
              <span className="opacity-40 hidden sm:inline">· every pin links to its tape</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="opacity-60">Built by</span>
              <span className="font-semibold tracking-[0.06em]">Manish Tiwari</span>
              <a href="https://buildwithmanish.com" className="hidden sm:inline-flex h-5 items-center rounded-full bg-ink text-paper px-2.5 text-[10px] tracking-[0.08em] hover:opacity-80 transition-opacity">buildwithmanish.com</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
