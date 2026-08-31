// Shared WhyViral domain types — mirrors the normalizeVideo / normalizeReel / normalizeAd shape
// used across all three platform scrapers. Mastra tools and shadcn UI both import from here.

export type Platform =
  | "tiktok"
  | "instagram"
  | "meta"
  | "youtube"
  | "twitter"
  | "pinterest"
  | "reddit"
  | "linkedin"
  | "snapchat";

export interface Video {
  platform: Platform;
  id: string | null;
  caption: string;
  author: string;
  language: string | null;
  followers: number;
  verified: boolean;
  isAd: boolean;
  url: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  weightedEngagementRate: number;
  reachMultiple: number | null;
  likelyCommentBait: boolean;
  createTime: string | null;
  videoUrl: string;
  // Meta-only
  daysRunning?: number;
  variantCount?: number;
  durationSeconds?: number | null;
}

export interface Analysis {
  hook: { visual: string; spoken: string; on_screen_text: string };
  hook_type: string;
  format: string;
  visual_style: string;
  broll_ratio: string;
  tone: string;
  pacing: string;
  recurring_text_overlay: string;
  angle: string;
  persuasion_tactics: string[];
  target_audience: string;
  primary_topic: string;
  niche_match: string;
  key_claims: string[];
  cta: string;
  why_it_works: string;
  spoken_language: string;
  schema_version: string;
  analysis_tier: string;
  niche_for?: string;
  duration_seconds?: string;
  script?: Array<{ spoken: string; on_screen_text: string; visual: string }>;
}

export interface ClusterMember {
  label: string;
  verbatim: string;
}

export interface Cluster {
  theme: string;
  description: string;
  placement?: string;
  count: number;
  members: ClusterMember[];
}

export interface ClosedRow {
  value: string;
  count: number;
  evidence: string[];
}

export interface Patterns {
  keyword: string;
  total_videos_analyzed: number;
  closed: {
    format: ClosedRow[];
    hook_type: ClosedRow[];
    tone: ClosedRow[];
    visual_style: ClosedRow[];
    broll_ratio: ClosedRow[];
    pacing: ClosedRow[];
    angle: ClosedRow[];
    persuasion_tactics: ClosedRow[];
  };
  hookVisual: Cluster[];
  hookSpoken: Cluster[];
  hookText: Cluster[];
  otherPatterns: Cluster[];
}

export interface ArchiveRunParams {
  keywords: string[];
  platform: Platform | "all";
  count: number;
  pool: number;
  rankBy: string;
  viewFloor: number;
  minLikes: number;
  language: string;
  country: string;
  regions?: string[];
  niche?: string;
  nicheFilter?: string;
  adaptableFloor?: number;
  metaDaysFloor?: number;
  minSynth?: number;
  deepCount?: number;
  reuse?: boolean;
  igHashtags?: string[];
  igAccounts?: string[];
  metaBrands?: string[];
  testMode?: boolean;
  // youtube / twitter / etc. extra sources (optional, not required for tiktok/ig/meta)
  ytChannels?: string[];
  ytHandles?: string[];
  twitterAccounts?: string[];
  twitterHashtags?: string[];
}

export interface ArchiveReport {
  keyword: string;
  platform: Platform;
  videos: Video[];
  analyses: Analysis[];
  patterns: Patterns | null;
  adaptable: Array<{ video: Video; analysis: Analysis }>;
  meta: { rankBy: string; date: string; platform: Platform };
}
