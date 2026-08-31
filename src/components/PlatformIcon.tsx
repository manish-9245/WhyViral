// src/components/PlatformIcon.tsx — Real brand icons for all 9 platforms
// Uses react-icons/si (Simple Icons) for pixel-perfect official logos. Single source of truth
// for platform -> icon + brand colour. Used in Console picker, History, Report, README badge.
"use client";

import {
  SiTiktok,
  SiInstagram,
  SiFacebook,
  SiYoutube,
  SiX,
  SiPinterest,
  SiReddit,
  SiSnapchat,
} from "react-icons/si";
import { Layers } from "lucide-react";

// Proper LinkedIn icon via Simple Icons (official path) — react-icons/si lacks it in this version
function LinkedinIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.777 13.019H3.56V9h3.554v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.455C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export type PlatformId =
  | "tiktok"
  | "instagram"
  | "meta"
  | "youtube"
  | "twitter"
  | "pinterest"
  | "reddit"
  | "linkedin"
  | "snapchat"
  | "all";

const MAP: Record<PlatformId, { label: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string }> = {
  tiktok: { label: "TikTok", Icon: SiTiktok, color: "#000000", bg: "#000000" },
  instagram: { label: "Instagram", Icon: SiInstagram, color: "#E4405F", bg: "#E4405F" },
  meta: { label: "Meta", Icon: SiFacebook, color: "#0866FF", bg: "#0866FF" },
  youtube: { label: "YouTube", Icon: SiYoutube, color: "#FF0000", bg: "#FF0000" },
  twitter: { label: "X", Icon: SiX, color: "#000000", bg: "#000000" },
  pinterest: { label: "Pinterest", Icon: SiPinterest, color: "#E60023", bg: "#E60023" },
  reddit: { label: "Reddit", Icon: SiReddit, color: "#FF4500", bg: "#FF4500" },
  linkedin: { label: "LinkedIn", Icon: LinkedinIcon, color: "#0A66C2", bg: "#0A66C2" },
  snapchat: { label: "Snapchat", Icon: SiSnapchat, color: "#FFFC00", bg: "#FFFC00" },
  all: { label: "All", Icon: Layers, color: "#f59e0b", bg: "#f59e0b" },
};

export function platformMeta(id: string) {
  return MAP[id as PlatformId] ?? { label: id, Icon: Layers, color: "#78716c", bg: "#78716c" };
}

export function PlatformIcon({
  platform,
  size = 14,
  className,
  filled = false,
}: {
  platform: string;
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  const meta = platformMeta(platform);
  const Icon = meta.Icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; size?: number }>;
  // Snapchat yellow needs dark icon for contrast
  const color = filled ? (platform === "snapchat" ? "#000" : "#fff") : meta.color;
  return <Icon className={className} style={{ width: size, height: size, color, flexShrink: 0 }} />;
}

export function PlatformBadge({ platform, size = 28 }: { platform: string; size?: number }) {
  const meta = platformMeta(platform);
  const isSnap = platform === "snapchat";
  return (
    <div
      className="grid place-items-center rounded-xl shrink-0"
      style={{ width: size, height: size, background: isSnap ? "#FFFC00" : meta.bg, color: isSnap ? "#000" : "#fff" }}
    >
      <PlatformIcon platform={platform} size={Math.round(size * 0.52)} filled />
    </div>
  );
}

export function AllPlatformIcons({ size = 18, className }: { size?: number; className?: string }) {
  const ids: PlatformId[] = ["tiktok", "instagram", "meta", "youtube", "twitter", "pinterest", "reddit", "linkedin", "snapchat"];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {ids.map((id) => (
        <span
          key={id}
          className="grid place-items-center rounded-full bg-white border border-stone/10 shadow-sm"
          style={{ width: size + 8, height: size + 8 }}
          title={platformMeta(id).label}
        >
          <PlatformIcon platform={id} size={size} />
        </span>
      ))}
    </span>
  );
}
