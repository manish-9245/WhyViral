import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["400", "600", "700", "800"] });

const REPO = "https://github.com/manish-9245/WhyViral";
const OG = `${REPO}/blob/main/public/og-image.png?raw=true`;

export const metadata: Metadata = {
  metadataBase: new URL(REPO),
  title: {
    default: "WhyViral — AI tells you why a video worked. With proof.",
    template: "%s · WhyViral",
  },
  applicationName: "WhyViral",
  authors: [{ name: "Manish Tiwari", url: "https://buildwithmanish.com" }],
  creator: "Manish Tiwari",
  publisher: "Manish Tiwari",
  keywords: [
    "whyviral",
    "tiktok analytics",
    "instagram reels analytics",
    "viral content",
    "ai video analysis",
    "content intelligence",
    "viral hook",
    "video performance",
    "social media analytics",
    "content strategy",
    "ai agent",
    "next.js",
    "typescript",
    "local-first",
    "open source",
    "manish tiwari",
    "buildwithmanish",
  ],
  category: "technology",
  classification: "Developer Tools, AI, Analytics, Content",
  description:
    "WhyViral — AI watches every video on TikTok, Instagram, and Meta, then tells you exactly why it earned distribution. Hooks, visuals, angles — pinned with proof links. Local-first, open source.",
  abstract:
    "Local-first, AI-powered content intelligence. Scrapes TikTok, Instagram, and Meta, watches every video, and pins the winning hooks, visuals, and angles with proof links.",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: REPO },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: REPO,
    siteName: "WhyViral",
    title: "WhyViral — AI tells you why a video worked. With proof.",
    description:
      "AI watches every video on TikTok, Instagram, and Meta, then tells you exactly why it earned distribution. Hooks, visuals, angles — pinned with proof links.",
    images: [
      { url: OG, width: 1280, height: 640, alt: "WhyViral — AI watches every video, then tells you exactly why it worked" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhyViral — AI tells you why a video worked. With proof.",
    description:
      "AI watches every video on TikTok, Instagram, and Meta, then pins the winning hooks, visuals, and angles — with proof links.",
    images: [OG],
    creator: "@manishtiwari",
  },
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
  },
  other: {
    "github:repo": REPO,
    "github:author": "manish-9245",
  },
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
