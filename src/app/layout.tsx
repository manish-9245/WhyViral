import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-screen bg-[#f8f7f4] font-sans antialiased text-[14px] leading-[1.5] text-ink selection:bg-amber selection:text-ink">
        <div className="h-[2px] w-full bg-amber" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
