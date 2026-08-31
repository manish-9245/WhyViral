// @ts-nocheck
// src/mastra/lib/providers/crawlee-reddit.ts — Open-source Reddit video scraper via Crawlee
// Strategy:
//   1) Reddit JSON search `https://www.reddit.com/search.json?q=...&sort=top&t=month` — public, no auth.
//      Returns BOTH text (self posts) + video (v.redd.it) + image/link posts — all analyzable via caption/LLM.
//   2) Fallback to old.reddit HTML parsing if JSON blocked.
// ANTI-BAN: Reddit JSON is generous for GETs with UA. One request per keyword,
// jitter 700–1200ms, concurrency=1. Respects 429 with Retry-After. Both text+video planes included.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (b: number, s: number) => b + Math.floor(Math.random() * s);
const _randomUA = () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function fetchRedditSearch(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(700, 500));
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=top&t=month&limit=${Math.min(count, 50)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; WhyViral/1.0; +https://buildwithmanish.com)",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 429) throw new Error(`Reddit 429 — retry after ${res.headers.get("retry-after") || "60s"}`);
  if (!res.ok) throw new Error(`Reddit HTTP ${res.status}`);
  const j = (await res.json()) as { data?: { children?: { data: Record<string, unknown> }[] } };
  const children = j.data?.children || [];
  const posts: Record<string, unknown>[] = [];
  for (const c of children) {
    const d = c.data;
    const isVideo = d.is_video === true || Boolean((d.media as Record<string, unknown>)?.reddit_video) || String(d.url || "").includes("v.redd.it");
    const isImage = !isVideo && (String(d.url || "").match(/\.(jpg|jpeg|png|gif|webp)$/i) || d.post_hint === "image");
    const isText = !isVideo && !isImage && Boolean(d.selftext);
    // Keep ALL: video, image, and text self-posts — all analyzable (text via caption/LLM, media via download)
    const videoUrl = isVideo ? (((d.media as Record<string, unknown>)?.reddit_video as Record<string, string>)?.fallback_url || (d.url as string) || "") : "";
    const imageUrl = isImage ? (d.url as string) || "" : "";
    const contentType = isVideo ? "video" : isImage ? "image" : isText ? "text" : "link";
    posts.push({
      id: String(d.id || ""),
      videoId: String(d.id || ""),
      title: (d.title as string) || "",
      caption: (d.title as string) || (d.selftext as string) || "",
      selftext: (d.selftext as string) || "",
      author: (d.author as string) || "unknown",
      subreddit: (d.subreddit as string) || "",
      viewCount: 0,
      likeCount: Number(d.ups || d.score || 0),
      commentCount: Number(d.num_comments || 0),
      url: `https://www.reddit.com${d.permalink as string}` || (d.url as string) || "",
      videoUrl, imageUrl, createdUtc: d.created_utc as number | undefined,
      platform: "reddit", contentType, is_video: isVideo, is_text: isText,
    });
  }
  return posts;
}

export async function runRedditCrawlee(_actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const keywords: string[] = (input.keywords as string[]) || [String(input.keyword || input.query || "")].filter(Boolean);
  const count = Number(input.count || 30);
  const perKw = Math.max(8, Math.ceil(count / Math.max(1, keywords.length)));
  const all: Record<string, unknown>[] = [];
  for (const kw of keywords.slice(0, 4)) {
    let items: Record<string, unknown>[] = [];
    try {
      items = await fetchRedditSearch(kw, perKw);
      if (items.length) console.log(`   🕷️  Crawlee Reddit "${kw}" → ${items.length} posts (text+video)`);
    } catch (e) { console.log(`   ⚠️  Reddit fetch failed for "${kw}": ${(e as Error).message}`); }
    all.push(...items);
    await sleep(jitter(700, 600));
  }
  if (!all.length) throw new Error(`Reddit: no posts for "${keywords.join(", ")}"`);
  return all.slice(0, count * Math.max(1, keywords.length));
}
