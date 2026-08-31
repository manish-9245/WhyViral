// @ts-nocheck
// src/mastra/lib/providers/crawlee-youtube.ts — Open-source YouTube Shorts scraper via Crawlee
// Replaces hosted Apify actors like `streamers/youtube-scraper` / `apify/youtube-scraper`
// Strategy:
//   1) YouTube Data API v3 (if YOUTUBE_API_KEY set) — official, quota-based, no ban risk.
//      Endpoint: search.list + videos.list (statistics). Filtered to `videoDuration=short`.
//   2) Fallback: Crawlee fetch of YouTube search HTML + parsing `ytInitialData` / `ytInitialPlayerResponse`
//      — same data the website uses, no key needed. Filtered to Shorts (/<shorts/ links + duration ≤ 60s).
//   3) Browser fallback (only if fetch empty): PlaywrightCrawler crawling
//      `https://www.youtube.com/results?search_query=...&sp=EgIYAQ%253D%253D` (Shorts filter).
//
// ANTI-BAN: YouTube is the most tolerant platform when using Data API (quota not IP ban).
// Fetch path sends ONE GET per keyword with browser UA + consent cookie, 1.0–1.8s jitter,
// concurrency=1, 429/backoff handled. Browser fallback uses same stealth as TikTok.

const YT_SEARCH_URL = "https://www.youtube.com/results";
const YT_API_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const YT_API_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number, spread: number) => base + Math.floor(Math.random() * spread);
const randomUA = () => [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
][Math.floor(Math.random() * 2)];

type YTItem = Record<string, unknown>;

function parseISO8601Duration(iso: string): number | null {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = Number(m[1] || 0), mn = Number(m[2] || 0), s = Number(m[3] || 0);
  return h * 3600 + mn * 60 + s;
}

// ---- Data API path (zero ban risk, official) ----
async function fetchViaYouTubeAPI(keyword: string, count: number): Promise<YTItem[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not set");
  // Search: filter to Shorts via videoDuration=short + type=video
  const searchParams = new URLSearchParams({
    part: "snippet",
    q: keyword,
    type: "video",
    videoDuration: "short",
    maxResults: String(Math.min(count, 50)),
    key,
  });
  const searchRes = await fetch(`${YT_API_SEARCH}?${searchParams}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!searchRes.ok) {
    const body = await searchRes.text().catch(() => "");
    if (searchRes.status === 403 && body.includes("quotaExceeded")) throw new Error("YouTube API quota exceeded — fallback to scraping");
    throw new Error(`YouTube API search HTTP ${searchRes.status}`);
  }
  const searchJson = (await searchRes.json()) as { items?: YTItem[] };
  const ids = (searchJson.items || []).map((it) => (it.id as Record<string, string>)?.videoId).filter(Boolean) as string[];
  if (!ids.length) return [];
  // videos.list for statistics
  const videosParams = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.join(","), key });
  const vRes = await fetch(`${YT_API_VIDEOS}?${videosParams}`, { signal: AbortSignal.timeout(15000) });
  if (!vRes.ok) throw new Error(`YouTube videos HTTP ${vRes.status}`);
  const vJson = (await vRes.json()) as { items?: YTItem[] };
  const byId = new Map((vJson.items || []).map((v) => [v.id as string, v]));
  return ids.map((id) => {
    const searchItem = searchJson.items!.find((s) => (s.id as Record<string,string>).videoId === id)!;
    const detail = byId.get(id) as YTItem | undefined;
    return mergeSearchAndDetail(searchItem, detail);
  }).filter(Boolean) as YTItem[];
}

function mergeSearchAndDetail(searchItem: YTItem, detail?: YTItem): YTItem {
  const vid = (searchItem.id as Record<string,string>).videoId;
  const snippet = (detail?.snippet as Record<string, unknown>) || (searchItem.snippet as Record<string, unknown>) || {};
  const stats = (detail?.statistics as Record<string,string>) || {};
  const content = (detail?.contentDetails as Record<string,string>) || {};
  const duration = content.duration ? parseISO8601Duration(content.duration) : null;
  return {
    // Normalized shape for our Video normalizer
    id: vid,
    videoId: vid,
    title: (snippet.title as string) || "",
    caption: (snippet.description as string) || (snippet.title as string) || "",
    channelId: (snippet.channelId as string) || "",
    channelTitle: (snippet.channelTitle as string) || "unknown",
    publishedAt: (snippet.publishedAt as string) || new Date().toISOString(),
    viewCount: Number(stats.viewCount || 0),
    likeCount: Number(stats.likeCount || 0),
    commentCount: Number(stats.commentCount || 0),
    durationSeconds: duration,
    isShort: duration == null ? true : duration <= 60,
    url: `https://www.youtube.com/shorts/${vid}`,
    videoUrl: `https://www.youtube.com/shorts/${vid}`,
    raw: { searchItem, detail },
  };
}

// ---- Fetch/ytInitialData path (no key, still low ban risk) ----
async function fetchViaYtInitialData(keyword: string, count: number): Promise<YTItem[]> {
  await sleep(jitter(900, 700));
  // Shorts filter param sp=EgIYAQ%3D%3D (YouTube's internal: EgIYAQ%253D%253D double-encoded)
  const url = `${YT_SEARCH_URL}?search_query=${encodeURIComponent(keyword)}&sp=EgIYAQ%253D%253D`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": randomUA(),
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+667; PREF=tz=UTC",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 429) throw new Error(`YouTube rate-limited (429) — Retry-After ${res.headers.get("retry-after") || "60s"}. Try YOUTUBE_API_KEY or proxy.`);
  if (!res.ok) throw new Error(`YouTube HTML HTTP ${res.status}`);
  const html = await res.text();
  // Extract ytInitialData JSON blob
  const m = html.match(/var ytInitialData = (\{.+?\});<\/script>/) || html.match(/ytInitialData"\s*:\s*(\{.+?\})\s*,\s*"yt/ ) || html.match(/ytInitialData = (\{.+?\});/s);
  let data: Record<string, unknown> | null = null;
  if (m) { try { data = JSON.parse(m[1]); } catch { /* ignore */ } }
  // Fallback: inline JSON search for ytInitialData assignment
  if (!data) {
    const alt = html.match(/"contents":\{"twoColumnSearchResultsRenderer"/);
    if (!alt) return [];
    // Try to locate JSON by balancing braces (best-effort)
    const idx = html.indexOf("ytInitialData");
    if (idx !== -1) {
      const slice = html.slice(idx, idx + 600000);
      const start = slice.indexOf("{");
      let depth = 0, end = -1;
      for (let i = start; i < slice.length; i++) {
        if (slice[i] === "{") depth++; else if (slice[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
        if (depth > 80) break;
      }
      if (end !== -1) { try { data = JSON.parse(slice.slice(start, end + 1)); } catch { /* ignore */ } }
    }
  }
  if (!data) return [];
  const items = extractYouTubeItemsFromInitialData(data);
  // Filter to Shorts-like items (short duration or shorts URL pattern)
  const shortsish = items.filter((it) => {
    const dur = it.durationSeconds as number | null;
    const isShort = dur == null ? true : dur <= 65;
    return isShort;
  });
  return (shortsish.length ? shortsish : items).slice(0, count).map((it) => ({
    ...it,
    url: `https://www.youtube.com/shorts/${it.videoId}`,
    videoUrl: `https://www.youtube.com/shorts/${it.videoId}`,
  }));
}

function extractYouTubeItemsFromInitialData(data: Record<string, unknown>): YTItem[] {
  const out: YTItem[] = [];
  const walk = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { for (const v of obj) walk(v); return; }
    const rec = obj as Record<string, unknown>;
    if (rec.videoId && (rec.title || rec.thumbnail)) {
      const vid = rec.videoId as string;
      const titleRuns = (rec.title as Record<string, unknown>)?.runs as { text: string }[] | undefined;
      const title = titleRuns ? titleRuns.map((r) => r.text).join("") : (rec.title as string) || "";
      const stats = rec.viewCountText as Record<string, unknown> | undefined;
      const simpleView = (stats?.simpleText as string) || (rec.shortViewCountText as Record<string,string>)?.simpleText || "";
      const views = parseViewCount(simpleView);
      const owner = rec.ownerText as Record<string, unknown> | undefined;
      const ownerRuns = owner?.runs as { text: string }[] | undefined;
      const channelTitle = ownerRuns?.[0]?.text || (rec.channelTitle as string) || "unknown";
      const length = (rec.lengthText as Record<string,string>)?.simpleText || (rec.simpleText as string) || "";
      const durationSeconds = length ? parseDurationString(length) : null;
      out.push({
        videoId: vid, id: vid, title, caption: title,
        channelTitle, viewCount: views, likeCount: 0, commentCount: 0,
        durationSeconds, publishedAt: (rec.publishedTimeText as Record<string,string>)?.simpleText || null,
        raw: rec,
      });
      return;
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(data);
  // Deduplicate
  const seen = new Set<string>();
  return out.filter((it) => {
    const id = String(it.videoId);
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  });
}

function parseViewCount(s: string): number {
  if (!s) return 0;
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const n = Number(m[1]); const unit = (m[2] || "").toUpperCase();
  if (unit === "K") return Math.round(n * 1e3);
  if (unit === "M") return Math.round(n * 1e6);
  if (unit === "B") return Math.round(n * 1e9);
  return Math.round(n);
}
function parseDurationString(s: string): number | null {
  const parts = s.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parts[0];
}

// ---- Playwright fallback (rare, gated) ----
async function crawlYouTubeWithPlaywright(keyword: string, count: number): Promise<YTItem[]> {
  let crawlee: Record<string, unknown>;
  try { crawlee = await import("crawlee"); } catch { throw new Error("Crawlee not installed — run `npm install crawlee playwright && npx playwright install chromium`"); }
  const PlaywrightCrawler = (crawlee as Record<string, unknown>).PlaywrightCrawler as new (opts: Record<string, unknown>) => Record<string, unknown>;
  if (!PlaywrightCrawler) throw new Error("PlaywrightCrawler unavailable");
  const collected: YTItem[] = [];
  const headless = String(process.env.CRAWLEE_HEADLESS ?? "true").toLowerCase() !== "false";
  const proxyUrl = process.env.CRAWLEE_PROXY || "";
  const crawler = new PlaywrightCrawler({
    headless, maxRequestRetries: 1, maxConcurrency: 1,
    autoscaledPoolOptions: { maxConcurrency: 1 },
    useSessionPool: true,
    launchContext: { launchOptions: { headless, args: ["--disable-blink-features=AutomationControlled"] } },
    proxyConfiguration: proxyUrl ? await (crawlee as unknown as { createProxyConfiguration: (o: unknown) => Promise<unknown> }).createProxyConfiguration({ proxyUrls: [proxyUrl] }) : undefined,
    async requestHandler({ page }: Record<string, unknown>) {
      const pg = page as { goto: (u: string, o?: unknown) => Promise<void>; waitForTimeout: (n: number) => Promise<void>; evaluate: (fn: string) => Promise<unknown> };
      await pg.goto(`${YT_SEARCH_URL}?search_query=${encodeURIComponent(keyword)}&sp=EgIYAQ%253D%253D`, { waitUntil: "domcontentloaded" });
      await pg.waitForTimeout(jitter(4500, 2000));
      try { await pg.evaluate(`window.scrollBy(0, 1400)`); await pg.waitForTimeout(1200); } catch { /* ignore */ }
      const data = await pg.evaluate(`
        (() => {
          const scripts=[...document.querySelectorAll('script')];
          for(const s of scripts){
            const t=s.textContent||"";
            const m=t.match(/var ytInitialData = (\\{.+?\\});<\\/script>/s) || t.match(/ytInitialData\\s*=\\s*(\\{.+?\\});/s);
            if(m) try{ return JSON.parse(m[1]); }catch{}
          }
          return null;
        })()
      `) as Record<string, unknown> | null;
      if (data) for (const it of extractYouTubeItemsFromInitialData(data).slice(0, count)) collected.push(it);
    },
  } as never);
  await (crawler as unknown as { run: (urls: string[]) => Promise<void> }).run([`${YT_SEARCH_URL}?search_query=${encodeURIComponent(keyword)}`]);
  return collected;

  function extractYouTubeItemsFromInitialData(data: Record<string, unknown>): YTItem[] {
    const out: YTItem[] = [];
    const walk = (o: unknown) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { for (const v of o) walk(v); return; }
      const rec = o as Record<string, unknown>;
      if (rec.videoId) { out.push(rec as YTItem); return; }
      for (const v of Object.values(rec)) walk(v);
    };
    walk(data);
    return out;
  }
}

// Public entry — used by scraper router
export async function runYoutubeCrawlee(_actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const keywords: string[] = (input.keywords as string[]) || (input.searchQueries as string[]) || [String(input.keyword || input.query || "")].filter(Boolean);
  const count = Number(input.count || input.resultsPerPage || input.maxResults || 30);
  const perKeyword = Math.max(10, Math.ceil(count / Math.max(1, keywords.length)));
  const all: YTItem[] = [];
  for (const kw of keywords.slice(0, 5)) {
    let items: YTItem[] = [];
    // 1) Data API (official, no ban)
    if (process.env.YOUTUBE_API_KEY) {
      try {
        items = await fetchViaYouTubeAPI(kw, perKeyword);
        if (items.length) console.log(`   🕷️  Crawlee YouTube (Data API) "${kw}" → ${items.length} shorts`);
      } catch (e) {
        console.log(`   ⚠️  YouTube Data API failed for "${kw}": ${(e as Error).message}`);
      }
    }
    // 2) ytInitialData fetch (no key, still safe)
    if (!items.length) {
      try {
        items = await fetchViaYtInitialData(kw, perKeyword);
        if (items.length) console.log(`   🕷️  Crawlee YouTube (ytInitialData) "${kw}" → ${items.length} shorts`);
      } catch (e) {
        console.log(`   ⚠️  YouTube fetch failed for "${kw}": ${(e as Error).message}`);
      }
    }
    // 3) Playwright gated
    if (!items.length && String(process.env.CRAWLEE_PLAYWRIGHT_FALLBACK || "true").toLowerCase() === "true" && String(process.env.CRAWLEE_WITH_BROWSER || "true").toLowerCase() !== "false") {
      try {
        items = await crawlYouTubeWithPlaywright(kw, perKeyword);
        if (items.length) console.log(`   🕷️  Crawlee YouTube (Playwright) "${kw}" → ${items.length} items`);
      } catch (e) { console.log(`   ⚠️  YouTube Playwright failed: ${(e as Error).message}`); }
    }
    all.push(...items);
    await sleep(jitter(1000, 800));
  }
  if (!all.length) throw new Error(`YouTube: no Shorts found for "${keywords.join(", ")}" — try YOUTUBE_API_KEY or different keywords`);
  // Normalize to shape expected by scrape-youtube tool (will further normalize to Video)
  return all.slice(0, count * keywords.length).map((it) => ({
    id: it.id, videoId: it.videoId, title: it.title, caption: it.caption,
    channelTitle: it.channelTitle, channelId: it.channelId,
    viewCount: it.viewCount, likeCount: it.likeCount, commentCount: it.commentCount,
    durationSeconds: it.durationSeconds, publishedAt: it.publishedAt,
    url: it.url, videoUrl: it.videoUrl, platform: "youtube",
  }));
}
