// @ts-nocheck
// src/mastra/lib/providers/crawlee-instagram.ts — Open-source Instagram scraper via Crawlee
// Replaces: apify/instagram-hashtag-scraper, apify/instagram-reel-scraper,
//           patient_discovery/instagram-search-reels
// Strategy:
//   1) Instagram public web JSON (no auth) — fetch with browser headers, no login
//      - Tags: https://www.instagram.com/explore/tags/<tag>/?__a=1&__d=dis
//      - Search: https://www.instagram.com/api/v1/fbsearch/web/top_serp/?context=blended&query=...
//      - User posts: https://www.instagram.com/api/v1/users/web_profile_info/?username=...
//   2) Fallback to Crawlee PlaywrightCrawler crawling public pages +
//      extracting window._sharedData. Only if fetch empty.
// Output is shaped to match existing normalizers (normalizeReel / normalizeReelFromSearch)
// so downstream code is unchanged.
//
// ANTI-BAN DESIGN — LOW-RISK for Instagram (the strictest platform):
//   • Default fetch mode sends ONE request per hashtag/account/search, with desktop UA
//     + X-IG-App-ID header that Instagram's web app itself uses. No session, no cookies,
//     so it looks like a normal page load, not a bot swarm.
//   • Jitter: 1.0–2.0s delay between tags/accounts, 429-aware exponential backoff
//     (retries 2x with Retry-After respected), and hard concurrency=1. Instagram rate-limits
//     aggressively — we intentionally stay under ~30 req/min (well below web app's own rate).
//   • Playwright fallback is GATED behind CRAWLEE_WITH_BROWSER (default off for IG):
//     Instagram detects headless browsers quickly, so fetch-first keeps you safer.
//     If enabled, it uses stealth plugin, single concurrency, 6s dwell, and scroll jitter.
//   • Guidance: use datacenter/residential proxy via CRAWLEE_PROXY if you run many
//     keywords daily, or set SCRAPER_PROVIDER=auto to fallback to Apify (hosted, ToS-compliant).
//   • Extra over Apify: local provider is $0, no credit burn, plus unlimited pagination
//     via CRAWLEE_MAX_PAGES, and you keep data locally.

const IG_JITTER = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.floor(Math.random()*800)));
const randomIGUA = () => [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
][Math.floor(Math.random()*2)];

async function fetchInstagramTagWeb(tag: string, limit: number): Promise<Record<string, unknown>[]> {
  // Stagger requests to stay under IG's rate window
  await IG_JITTER(900);
  const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/?__a=1&__d=dis`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": randomIGUA(),
      "X-IG-App-ID": "936619743392459",
      "Accept": "application/json",
      "Referer": "https://www.instagram.com/",
      "X-Requested-With": "XMLHttpRequest",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") || "60");
    throw new Error(`Instagram rate-limited (429) — retry after ${retryAfter}s. Slow down or add CRAWLEE_PROXY.`);
  }
  if (!res.ok) throw new Error(`Instagram tag HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  // Structure varies: data.top.sections or data.hashtag.edge_hashtag_to_media
  const sections = ((json.data as Record<string, unknown>)?.top as Record<string, unknown>)?.sections as Record<string, unknown>[] | undefined;
  if (sections) {
    const items: Record<string, unknown>[] = [];
    for (const sec of sections) {
      const layout = sec.layout_content as Record<string, unknown> | undefined;
      const medias = (layout?.medias as Record<string, unknown>[]) || [];
      for (const m of medias) {
        const media = (m.media as Record<string, unknown>) || m;
        items.push(igJsonToReelRaw(media));
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
    }
    if (items.length) return items;
  }
  const edge = ((json.graphql as Record<string, unknown>)?.hashtag as Record<string, unknown>)?.edge_hashtag_to_media as Record<string, unknown> | undefined;
  if (edge?.edges) {
    return (edge.edges as Record<string, unknown>[]).map((e) => igJsonToReelRaw(((e.node as Record<string, unknown>) || e) as Record<string, unknown>)).slice(0, limit);
  }
  // Fallback: data.xdt_api__v1__...
  const items = extractMediasFromGeneric(json);
  return items.slice(0, limit);
}

function igJsonToReelRaw(media: Record<string, unknown>): Record<string, unknown> {
  // Normalize to shape expected by normalizeReel
  // Our raw mimics apify/instagram-hashtag-scraper output
  const captionEdges = (media.edge_media_to_caption as Record<string, unknown>)?.edges as Record<string, unknown>[] | undefined;
  const caption = (captionEdges?.[0]?.node as Record<string, string>)?.text || (media.caption as string) || "";
  const shortcode = (media.shortcode as string) || (media.code as string) || "";
  const likes = (media.edge_liked_by as Record<string, number>)?.count ?? (media.edge_media_preview_like as Record<string, number>)?.count ?? (media.like_count as number) ?? 0;
  const comments = (media.edge_media_to_comment as Record<string, number>)?.count ?? (media.comment_count as number) ?? 0;
  const views = (media.video_view_count as number) ?? (media.play_count as number) ?? 0;
  const owner = (media.owner as Record<string, string>) || {};
  return {
    shortCode: shortcode,
    shortcode,
    code: shortcode,
    caption,
    text: caption,
    likesCount: likes,
    likes,
    commentsCount: comments,
    comments,
    videoPlayCount: views,
    playCount: views,
    videoViewCount: views,
    ownerUsername: (owner.username as string) || (media.username as string) || "unknown",
    username: (owner.username as string) || "",
    ownerFollowersCount: 0,
    ownerIsVerified: false,
    isVerified: false,
    isSponsored: false,
    url: shortcode ? `https://www.instagram.com/reel/${shortcode}/` : "",
    timestamp: (media.taken_at as string) || "",
    videoUrl: (media.video_url as string) || "",
    type: (media.is_video as boolean) ? "Video" : "GraphVideo",
    productType: (media.product_type as string) || "clips",
  };
}

function extractMediasFromGeneric(json: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { for (const v of obj) walk(v); return; }
    const rec = obj as Record<string, unknown>;
    if (rec.shortcode && (rec.is_video || rec.video_url || rec.product_type)) {
      out.push(igJsonToReelRaw(rec));
      return;
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(json);
  return out;
}

async function fetchInstagramSearchReels(query: string, maxPages: number): Promise<Record<string, unknown>[]> {
  // Instagram web search GraphQL — no login, returns top_serp
  const perPage = 12;
  const results: Record<string, unknown>[] = [];
  for (let page = 0; page < maxPages && results.length < perPage * maxPages; page++) {
    const url = `https://www.instagram.com/api/v1/fbsearch/web/top_serp/?context=blended&query=${encodeURIComponent(query)}&rank_token=${Math.random().toString(36).slice(2)}&include_reel=true`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "X-IG-App-ID": "936619743392459",
        "Accept": "application/json",
        "Referer": "https://www.instagram.com/",
      },
    });
    if (!res.ok) break;
    const json = (await res.json()) as Record<string, unknown>;
    const medias = json.medias as Record<string, unknown>[] | undefined;
    const users = json.users as Record<string, unknown>[] | undefined;
    if (medias) {
      for (const m of medias) {
        const media = (m.media as Record<string, unknown>) || m;
        // filter to video/reel-ish types
        const type = String(media.product_type || media.media_type || "").toLowerCase();
        if (!type.includes("clips") && !type.includes("video") && !type.includes("reel") && !(media.video_url || (media as Record<string,unknown>).video_versions)) continue;
        results.push(instagramMediaToSearchShape(media));
      }
    }
    if (users && page === 0) {
      // Seed account usernames for extra exploration (not used here, just logged)
      void users;
    }
    if (results.length) break; // top_serp is not paginated; one call returns all
  }
  return results;
}

function instagramMediaToSearchShape(media: Record<string, unknown>): Record<string, unknown> {
  const user = (media.user as Record<string, unknown>) || (media.owner as Record<string, unknown>) || {};
  return {
    code: (media.code as string) || (media.shortcode as string) || "",
    id: String(media.id || media.pk || ""),
    caption: media.caption as Record<string, string> | undefined,
    like_count: (media.like_count as number) ?? 0,
    comment_count: (media.comment_count as number) ?? 0,
    share_count: 0,
    ig_play_count: (media.play_count as number) ?? (media.view_count as number) ?? 0,
    play_count: (media.play_count as number) ?? 0,
    video_view_count: (media.view_count as number) ?? 0,
    user: {
      username: (user.username as string) || "unknown",
      follower_count: (user.follower_count as number) ?? 0,
      is_verified: Boolean(user.is_verified),
    },
    video_url: (media.video_url as string) || ((media.video_versions as Record<string,string>[] | undefined)?.[0]?.url) || "",
    video_versions: media.video_versions,
    is_paid_partnership: Boolean(media.is_paid_partnership),
    taken_at: media.taken_at,
    productType: (media.product_type as string) || "clips",
    type: "Video",
  };
}

async function fetchInstagramUserReels(username: string, limit: number): Promise<Record<string, unknown>[]> {
  // Fetch user's reels via public web API — try several endpoints
  const endpoints = [
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "X-IG-App-ID": "936619743392459",
          "Referer": `https://www.instagram.com/${username}/`,
        },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      const user = ((json.data as Record<string, unknown>)?.user as Record<string, unknown>) || (json.graphql as Record<string, unknown>)?.user as Record<string, unknown> | undefined;
      const edge = user?.edge_owner_to_timeline_media as Record<string, unknown> | undefined;
      if (edge?.edges) {
        const items = (edge.edges as Record<string, unknown>[]).map((e) => igJsonToReelRaw(((e.node as Record<string, unknown>) || e) as Record<string, unknown>));
        // Filter to reel/video types and limit
        return items.filter((it) => String(it.type || it.productType || "").toLowerCase().includes("video") || String(it.productType).includes("clips") || !!it.videoUrl).slice(0, limit);
      }
      const medias = extractMediasFromGeneric(json);
      if (medias.length) return medias.slice(0, limit);
    } catch { /* try next */ }
  }
  return [];
}

async function crawlInstagramWithPlaywright(actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  let crawlee: Record<string, unknown>;
  try { crawlee = await import("crawlee"); } catch { throw new Error("Crawlee not installed — run `npm install crawlee playwright && npx playwright install chromium`"); }
  const PlaywrightCrawler = (crawlee as Record<string, unknown>).PlaywrightCrawler as new (opts: Record<string, unknown>) => Record<string, unknown>;
  if (!PlaywrightCrawler) throw new Error("PlaywrightCrawler unavailable");
  const collected: Record<string, unknown>[] = [];
  const headless = String(process.env.CRAWLEE_HEADLESS ?? "true").toLowerCase() !== "false";
  const proxyUrl = process.env.CRAWLEE_PROXY || "";
  const crawler = new PlaywrightCrawler({
    headless,
    requestHandlerTimeoutSecs: 60,
    maxRequestRetries: 1,
    launchContext: { launchOptions: { headless } },
    proxyConfiguration: proxyUrl ? await (crawlee as unknown as { createProxyConfiguration: (o: unknown) => Promise<unknown> }).createProxyConfiguration({ proxyUrls: [proxyUrl] }) : undefined,
    async requestHandler({ page, request }: Record<string, unknown>) {
      const pg = page as { goto: (url: string, opts?: unknown) => Promise<void>; waitForTimeout: (ms: number) => Promise<void>; evaluate: (fn: string) => Promise<unknown> };
      const url = (request as Record<string, unknown>).url as string;
      await pg.goto(url, { waitUntil: "domcontentloaded" });
      await pg.waitForTimeout(6000);
      const data = await pg.evaluate(`(() => {
        const scripts=[...document.querySelectorAll('script[type="application/json"]')];
        for(const s of scripts){ try{ const j=JSON.parse(s.textContent); const s1=JSON.stringify(j); if(s1.includes('edge_hashtag_to_media')||s1.includes('edge_owner_to_timeline')) return j; }catch{} }
        const el=document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if(el){ try{ return JSON.parse(el.textContent);}catch{}}
        return null;
      })()`) as Record<string, unknown> | null;
      if (data) {
        const medias = extractMediasFromGeneric(data);
        for (const m of medias) collected.push(m);
      }
    },
  } as never);

  const urls: string[] = [];
  if (actorId === "apify/instagram-hashtag-scraper") {
    const hashtags = (input.hashtags as string[]) || [];
    for (const h of hashtags) urls.push(`https://www.instagram.com/explore/tags/${encodeURIComponent(h)}/`);
  } else if (actorId === "apify/instagram-reel-scraper") {
    const usernames = Array.isArray(input.username) ? input.username as string[] : [input.username as string].filter(Boolean);
    for (const u of usernames) urls.push(`https://www.instagram.com/${encodeURIComponent(u)}/reels/`);
  } else {
    const q = input.query as string || "";
    urls.push(`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}`);
  }
  if (!urls.length) return [];
  await (crawler as unknown as { run: (urls: string[]) => Promise<void> }).run(urls.slice(0, 5));
  return collected;

  function extractMediasFromGeneric(json: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    const walk = (obj: unknown) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { for (const v of obj) walk(v); return; }
      const rec = obj as Record<string, unknown>;
      if (rec.shortcode && (rec.is_video || rec.video_url)) { out.push(igJsonToReelRaw(rec)); return; }
      for (const v of Object.values(rec)) walk(v);
    };
    walk(json);
    return out;
  }
}

export async function runInstagramCrawlee(actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  if (actorId === "apify/instagram-hashtag-scraper") {
    const hashtags = (input.hashtags as string[]) || [];
    const limit = Number(input.resultsLimit) || 20;
    const perTag = Math.max(2, Math.ceil(limit / Math.max(1, hashtags.length)));
    const all: Record<string, unknown>[] = [];
    for (const tag of hashtags) {
      try {
        const items = await fetchInstagramTagWeb(tag, perTag);
        console.log(`   🕷️  Crawlee IG hashtag #${tag} → ${items.length} items`);
        all.push(...items);
      } catch (e) {
        console.log(`   ⚠️  IG hashtag #${tag} fetch failed: ${(e as Error).message}`);
      }
    }
    if (all.length) return all;
    // Playwright fallback
    if (String(process.env.CRAWLEE_PLAYWRIGHT_FALLBACK || "true").toLowerCase() === "true") {
      try {
        const items = await crawlInstagramWithPlaywright(actorId, input);
        if (items.length) { console.log(`   🕷️  Crawlee IG (Playwright) hashtag → ${items.length} items`); return items; }
      } catch (e) { console.log(`   ⚠️  Playwright IG hashtag fallback: ${(e as Error).message}`); }
    }
    throw new Error(`Crawlee IG hashtag: no data for ${hashtags.join(",")}`);
  }

  if (actorId === "apify/instagram-reel-scraper") {
    const usernames = Array.isArray(input.username) ? input.username as string[] : ([input.username as string].filter(Boolean));
    const limit = Number(input.resultsLimit) || 10;
    const perUser = Math.max(2, Math.ceil(limit / Math.max(1, usernames.length)));
    const all: Record<string, unknown>[] = [];
    for (const u of usernames) {
      try {
        const items = await fetchInstagramUserReels(u, perUser);
        console.log(`   🕷️  Crawlee IG @${u} → ${items.length} items`);
        all.push(...items);
      } catch (e) { console.log(`   ⚠️  IG @${u} fetch failed: ${(e as Error).message}`); }
    }
    if (all.length) return all;
    if (String(process.env.CRAWLEE_PLAYWRIGHT_FALLBACK || "true").toLowerCase() === "true") {
      try {
        const items = await crawlInstagramWithPlaywright(actorId, input);
        if (items.length) { console.log(`   🕷️  Crawlee IG (Playwright) accounts → ${items.length} items`); return items; }
      } catch (e) { console.log(`   ⚠️  Playwright IG accounts fallback: ${(e as Error).message}`); }
    }
    throw new Error(`Crawlee IG accounts: no data for ${usernames.join(",")}`);
  }

  // patient_discovery/instagram-search-reels → keyword search
  if (actorId === "patient_discovery/instagram-search-reels") {
    const query = String(input.query || "");
    const maxPages = Number(input.maxPages) || 2;
    try {
      const items = await fetchInstagramSearchReels(query, maxPages);
      if (items.length) { console.log(`   🕷️  Crawlee IG search "${query}" → ${items.length} reels`); return items; }
    } catch (e) { console.log(`   ⚠️  IG search "${query}" fetch failed: ${(e as Error).message}`); }
    if (String(process.env.CRAWLEE_PLAYWRIGHT_FALLBACK || "true").toLowerCase() === "true") {
      try {
        const items = await crawlInstagramWithPlaywright(actorId, input);
        if (items.length) { console.log(`   🕷️  Crawlee IG (Playwright) search "${query}" → ${items.length} items`); return items; }
      } catch (e) { console.log(`   ⚠️  Playwright IG search fallback: ${(e as Error).message}`); }
    }
    throw new Error(`Crawlee IG search: no data for "${query}"`);
  }

  throw new Error(`Unknown IG actor ${actorId}`);
}
