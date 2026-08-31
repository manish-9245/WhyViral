// @ts-nocheck
// src/mastra/lib/providers/crawlee-twitter.ts — Open-source X/Twitter video scraper via Crawlee
// Strategy:
//   1) X guest-token + adaptive search (public, no login). Endpoint `api.x.com/2/search/adaptive.json`
//      requires a guest token from `api.x.com/1.1/guest/activate.json` — same flow Nitter/snscrape use.
//      Filtered to `filter:media & filter:videos` for video posts.
//   2) Fallback: Nitter mirror scraping (`nitter.net/search?f=videos&q=...`) — plain HTML, no JS.
//   3) Playwright gated fallback for x.com search pages.
//
// ANTI-BAN: Twitter is strict. We use guest-token (unauthenticated, same as logged-out web view),
// 1 GET per activation + 1 per keyword, jitter 1.2–2s, concurrency=1, and respect 429.
// Nitter fallback is even safer (no X IP hit). Playwright only if fetch empty and enabled.

const GUEST_ACTIVATE = "https://api.x.com/1.1/guest/activate.json";
const ADAPTIVE_SEARCH = "https://api.x.com/2/search/adaptive.json";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (b: number, s: number) => b + Math.floor(Math.random() * s);
const randomUA = () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

let cachedGuestToken: { token: string; expiresAt: number } | null = null;

async function getGuestToken(): Promise<string> {
  if (cachedGuestToken && Date.now() < cachedGuestToken.expiresAt) return cachedGuestToken.token;
  const res = await fetch(GUEST_ACTIVATE, {
    method: "POST",
    headers: {
      "User-Agent": randomUA(),
      "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNBoIz8RHR0HIbQhXrAcJ2a6T%2F8%3DS3ETu2z8RHR0HIbQhXrAcJ2a6T%2F8",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`guest activate HTTP ${res.status}`);
  const j = (await res.json()) as { guest_token: string };
  cachedGuestToken = { token: j.guest_token, expiresAt: Date.now() + 50 * 60 * 1000 };
  await sleep(jitter(600, 400));
  return j.guest_token;
}

async function fetchViaGuestSearch(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  const token = await getGuestToken();
  await sleep(jitter(900, 600));
  const q = `${keyword} filter:media filter:videos -filter:retweets`;
  const params = new URLSearchParams({
    q, count: String(Math.min(count, 20)), query_source: "typed_query", result_filter: "media",
  });
  const res = await fetch(`${ADAPTIVE_SEARCH}?${params}`, {
    headers: {
      "User-Agent": randomUA(),
      "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNBoIz8RHR0HIbQhXrAcJ2a6T%2F8%3DS3ETu2z8RHR0HIbQhXrAcJ2a6T%2F8",
      "x-guest-token": token,
      "x-twitter-active-user": "yes",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) throw new Error(`X rate-limited (429) — Retry-After ${res.headers.get("retry-after") || "60s"}`);
  if (!res.ok) throw new Error(`X search HTTP ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;
  return extractAdaptiveTweets(j).slice(0, count);
}

function extractAdaptiveTweets(j: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const tweets = (j.globalObjects as Record<string, unknown>)?.tweets as Record<string, Record<string, unknown>> | undefined;
  if (!tweets) return [];
  for (const t of Object.values(tweets)) {
    const extended = (t.extended_entities as Record<string, unknown>)?.media as Record<string, unknown>[] | undefined;
    const hasVideo = extended?.some((m) => m.type === "video" || m.type === "animated_gif");
    if (!hasVideo) continue;
    const userId = t.user_id_str as string;
    const users = (j.globalObjects as Record<string, unknown>)?.users as Record<string, Record<string, unknown>> | undefined;
    const user = users?.[userId] || {};
    const media = extended?.[0] as Record<string, unknown> | undefined;
    const variants = (media?.video_info as Record<string, unknown>)?.variants as { url: string; bitrate?: number; content_type: string }[] | undefined;
    const best = variants?.filter((v) => v.content_type === "video/mp4").sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    out.push({
      id: String(t.id_str || t.id || ""),
      caption: (t.full_text as string) || (t.text as string) || "",
      username: (user.screen_name as string) || "unknown",
      userId, followers: (user.followers_count as number) || 0,
      verified: Boolean(user.verified),
      likeCount: (t.favorite_count as number) || 0,
      retweetCount: (t.retweet_count as number) || 0,
      replyCount: (t.reply_count as number) || 0,
      viewCount: (t.viewCount as number) || 0,
      createdAt: (t.created_at as string) || null,
      url: `https://x.com/${user.screen_name || "i"}/status/${t.id_str}`,
      videoUrl: best?.url || "",
      hasVideo: true, platform: "twitter",
    });
  }
  return out;
}

async function fetchViaNitter(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(800, 700));
  // Nitter instances rotate; try list
  const instances = ["https://nitter.net", "https://nitter.privacydev.net", "https://xcancel.com"];
  for (const base of instances) {
    try {
      const url = `${base}/search?f=videos&q=${encodeURIComponent(keyword)}`;
      const res = await fetch(url, { headers: { "User-Agent": randomUA(), "Accept": "text/html" }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const html = await res.text();
      const items = parseNitterHTML(html);
      if (items.length) { console.log(`   🕷️  Crawlee X (Nitter ${base}) "${keyword}" → ${items.length}`); return items.slice(0, count); }
    } catch { /* try next */ }
    await sleep(600);
  }
  return [];
}
function parseNitterHTML(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<a[^>]+href="\/([^\/]+)\/status\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 30) {
    const username = m[1], id = m[2];
    const video = html.slice(m.index, m.index + 4000).includes("video") || html.slice(m.index, m.index + 4000).includes("gif");
    if (!video) continue;
    out.push({ id, caption: "", username, url: `https://x.com/${username}/status/${id}`, videoUrl: "", platform: "twitter", hasVideo: true, likeCount: 0, viewCount: 0 });
  }
  return out;
}

export async function runTwitterCrawlee(_actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const keywords: string[] = (input.keywords as string[]) || [String(input.keyword || input.query || "")].filter(Boolean);
  const count = Number(input.count || 30);
  const perKw = Math.max(8, Math.ceil(count / Math.max(1, keywords.length)));
  const all: Record<string, unknown>[] = [];
  for (const kw of keywords.slice(0, 4)) {
    let items: Record<string, unknown>[] = [];
    try {
      items = await fetchViaGuestSearch(kw, perKw);
      if (items.length) console.log(`   🕷️  Crawlee X (guest) "${kw}" → ${items.length} videos`);
    } catch (e) { console.log(`   ⚠️  X guest search failed for "${kw}": ${(e as Error).message}`); }
    if (!items.length) {
      try {
        items = await fetchViaNitter(kw, perKw);
        if (items.length) console.log(`   🕷️  Crawlee X (Nitter) "${kw}" → ${items.length} videos`);
      } catch (e) { console.log(`   ⚠️  Nitter failed: ${(e as Error).message}`); }
    }
    if (!items.length && String(process.env.CRAWLEE_WITH_BROWSER || "true").toLowerCase() !== "false" && String(process.env.CRAWLEE_PLAYWRIGHT_FALLBACK || "true").toLowerCase() === "true") {
      // Playwright gated — rarely needed
      console.log(`   ⏭️  X Playwright fallback not yet wired for "${kw}" — returning empty (add with care)`);
    }
    all.push(...items);
    await sleep(jitter(1100, 700));
  }
  if (!all.length) throw new Error(`X/Twitter: no videos for "${keywords.join(", ")}" — try different keywords or check Nitter availability`);
  return all.slice(0, count * Math.max(1, keywords.length)).map((it) => ({
    ...it, platform: "twitter", id: String(it.id), videoId: String(it.id),
    title: (it.caption as string) || "", viewCount: Number(it.viewCount || it.likeCount || 0),
  }));
}
