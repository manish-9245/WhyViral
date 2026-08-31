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
import { FaLinkedin } from "react-icons/fa";
import { Layers } from "lucide-react";

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
  linkedin: { label: "LinkedIn", Icon: FaLinkedin as unknown as React.ComponentType<{ className?: string; style?: React.CSSProperties }>, color: "#0A66C2", bg: "#0A66C2" },
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
