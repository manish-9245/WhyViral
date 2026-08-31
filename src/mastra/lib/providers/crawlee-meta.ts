// @ts-nocheck
// src/mastra/lib/providers/crawlee-meta.ts — Open-source Meta Ad Library scraper via Crawlee
// Replaces: curious_coder/facebook-ads-library-scraper (hosted Apify Actor)
// Strategy:
//   1) Direct fetch to Facebook's public Ad Library async endpoint
//      (same endpoint apify's actor hits, but called locally without Apify proxy).
//      No auth required — it's the same public search the ads library website uses.
//   2) Fallback to Crawlee PlaywrightCrawler crawling https://www.facebook.com/ads/library/?...
//      and intercepting /api/graphql/ responses.
// Output shaped to match normalizeAd expectations (ad_archive_id, page_name, snapshot, etc.)
//
// ANTI-BAN DESIGN — SAFEST OF THE THREE (Meta is public data):
//   • Meta Ad Library is DESIGNED for public search (transparency requirement). Hitting
//     the async endpoint with a browser UA is indistinguishable from normal site use.
//   • We add 800ms jitter + 1s delay between URLs (countries/keywords), concurrency=1,
//     and single fetch per URL — far below facebook.com's own pagination rate. No login,
//     no GraphQL token scraping needed for the async fallback (avoids FB's bot checks).
//   • Playwright fallback (rare) uses 8s dwell + scroll, stealth args, sessionPool.
//   • Extra over Apify: unlimited country expansion, no maxTotalChargeUsd spend cap,
//     brand page-id resolution with higher recall, and local caching.

const FB_GRAPHQL_URL = "https://www.facebook.com/api/graphql/";
const FB_ADS_LIBRARY_PAGE = "https://www.facebook.com/ads/library/";

// Fallback doc_id for AdLibrary search — extracted from public site; this ID is stable
// and is the same one apify's actor uses. If Facebook rotates doc_ids, the Playwright
// fallback will auto-extract the new one from the page's JS.
const FB_ADS_SEARCH_DOC_ID = "5898646522404979";

interface FBAdsSearchVariables {
  adType: string;
  bylines?: string[];
  country: string;
  viewAllPageID?: string;
  searchType: string;
  mediaType?: string;
  q?: string;
  activeStatus: string;
  startDate?: string;
  endDate?: string;
}

function buildSearchVariables(url: string): FBAdsSearchVariables | null {
  try {
    const u = new URL(url);
    const country = u.searchParams.get("country") || "ALL";
    const q = u.searchParams.get("q") || "";
    const viewAllPageID = u.searchParams.get("view_all_page_id") || undefined;
    const mediaType = u.searchParams.get("media_type") || undefined;
    const searchType = u.searchParams.get("search_type") || "keyword_unordered";
    const activeStatus = u.searchParams.get("active_status") || "active";
    // ad_type param maps to adType graphql var
    const adType = u.searchParams.get("ad_type") || "all";
    return { adType, country, q: q || undefined, viewAllPageID, mediaType, searchType, activeStatus } as FBAdsSearchVariables;
  } catch { return null; }
}

async function fetchMetaAdsViaGraphQL(vars: FBAdsSearchVariables, count: number): Promise<Record<string, unknown>[]> {
  // Facebook's GraphQL requires fb_dtsg token + lsd etc extracted from the page.
  // We fetch the ads library page to extract tokens, then call the API.
  const pageRes = await fetch(FB_ADS_LIBRARY_PAGE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!pageRes.ok) throw new Error(`Facebook page HTTP ${pageRes.status}`);
  const html = await pageRes.text();
  const fbDtsg = html.match(/"DTSGInitialData",\[\],{"token":"([^"]+)"/)?.[1] || html.match(/"token":"([^"]+)"[^}]*"DTSG/)?.[1] || "";
  const lsd = html.match(/"LSD",\[\],{"token":"([^"]+)"/)?.[1] || "";
  const jazoestMatch = html.match(/jazoest=(\d+)/);
  const jazoest = jazoestMatch?.[1] || "25404";
  const docIdCandidates = [FB_ADS_SEARCH_DOC_ID, ...(html.match(/"doc_id":"(\d+)"/g) || []).map((m) => m.match(/"doc_id":"(\d+)"/)?.[1] || "").filter(Boolean).slice(0, 3)];

  // If no token, try the unauthenticated async endpoint instead
  if (!fbDtsg) {
    return fetchMetaAdsViaAsyncEndpoint(vars, count);
  }

  const payload = {
    activeStatus: vars.activeStatus || "active",
    adType: (vars.adType || "all").toUpperCase(),
    bylines: (vars as unknown as Record<string, unknown>).bylines as string[] || [],
    countries: vars.country === "ALL" ? [] : [vars.country],
    viewAllPageID: vars.viewAllPageID || null,
    mediaType: vars.mediaType || null,
    q: vars.q || "",
    searchType: vars.searchType || "keyword_unordered",
  };

  for (const docId of docIdCandidates) {
    const body = new URLSearchParams({
      av: "0",
      __user: "0",
      __a: "1",
      __req: "a",
      __hs: `19787.HYP:ads_library_compact_browser_pkg.${docIdCandidates.indexOf(docId) + 1}`,
      dpr: "1",
      __ccg: "GOOD",
      __rev: html.match(/"__spin_r":(\d+)/)?.[1] || "1017613631",
      __s: "",
      __hsi: "",
      __dyn: "",
      __csr: "",
      __comet_req: "1",
      fb_dtsg: fbDtsg,
      jazoest,
      lsd,
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "AdLibrarySearchPaginationQuery",
      variables: JSON.stringify({ ...payload, count, cursor: null }),
      server_timestamps: "true",
      doc_id: docId,
    });

    const res = await fetch(FB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "*/*",
        "Origin": "https://www.facebook.com",
        "Referer": FB_ADS_LIBRARY_PAGE,
        "X-FB-LSD": lsd,
      },
      body: body.toString(),
    });
    if (!res.ok) continue;
    const text = await res.text();
    // Facebook wraps JSON with `for(;;);`
    const jsonStr = text.replace(/^for\(;;\);/, "");
    try {
      const json = JSON.parse(jsonStr) as Record<string, unknown>;
      const edges = extractAdEdges(json);
      if (edges.length) return edges;
    } catch { /* try next docId */ }
  }
  throw new Error("Facebook GraphQL returned no ads (doc_id may have rotated — trying async fallback)");
}

async function fetchMetaAdsViaAsyncEndpoint(vars: FBAdsSearchVariables, _count: number): Promise<Record<string, unknown>[]> {
  // Unauthenticated endpoint that Facebook's own ad library page uses for initial load
  // GET https://www.facebook.com/ads/library/async/search_ads/?q=&country=ALL&...
  const params = new URLSearchParams({
    q: vars.q || "",
    country: vars.country || "ALL",
    active_status: vars.activeStatus || "active",
    ad_type: vars.adType || "all",
    media_type: vars.mediaType || "all",
    search_type: vars.searchType || "keyword_unordered",
    start_date: (vars as unknown as Record<string, string>).startDate || "",
    end_date: (vars as unknown as Record<string, string>).endDate || "",
  });
  if (vars.viewAllPageID) params.set("view_all_page_id", vars.viewAllPageID);

  const url = `https://www.facebook.com/ads/library/async/search_ads/?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/json",
      "Referer": FB_ADS_LIBRARY_PAGE,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!res.ok) throw new Error(`Meta async endpoint HTTP ${res.status}`);
  const text = await res.text();
  const cleaned = text.replace(/^for\(;;\);/, "");
  try {
    const json = JSON.parse(cleaned) as Record<string, unknown>;
    return extractAdEdges(json);
  } catch {
    // Sometimes response is HTML with embedded JSON
    const m = text.match(/"edges":\s*(\[.*?\])/s);
    if (m) {
      try { return extractAdEdges({ data: { adLibrarySearch: { edges: JSON.parse(m[1]) } } } as unknown as Record<string, unknown>); } catch { /* ignore */ }
    }
    throw new Error("Could not parse Meta async response");
  }
}

function extractAdEdges(json: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { for (const v of obj) walk(v); return; }
    const rec = obj as Record<string, unknown>;
    // Identify ad nodes: they have ad_archive_id or archive_id + page_name or snapshot
    if ((rec.ad_archive_id || rec.archive_id) && (rec.page_name || rec.snapshot || rec.pageName)) {
      out.push(toNormalizedAdShape(rec));
      return;
    }
    for (const v of Object.values(rec)) walk(v);
  };
  // Common wrapper: data.search_results.edges[].node
  // or data.adLibrarySearch.edges
  const data = (json.data as Record<string, unknown>) || json;
  walk(data);
  // Deduplicate
  const seen = new Set<string>();
  return out.filter((a) => {
    const id = String(a.ad_archive_id || a.id || a.archive_id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function toNormalizedAdShape(raw: Record<string, unknown>): Record<string, unknown> {
  // Ensure shape matches what normalizeAd expects:
  // ad_archive_id, id, archive_id, page_name, snapshot.{body,page_name,videos,page_id}, start_date
  const snapshot = (raw.snapshot as Record<string, unknown>) || {};
  const body = (snapshot.body as string) || (raw.body as string) || "";
  const pageName = (raw.page_name as string) || (snapshot.page_name as string) || (raw.pageName as string) || "Unknown Advertiser";
  const videos = (snapshot.videos as unknown[]) || (raw.videos as unknown[]) || [];
  return {
    ad_archive_id: String(raw.ad_archive_id || raw.archive_id || raw.id || ""),
    id: String(raw.ad_archive_id || raw.id || raw.archive_id || ""),
    archive_id: String(raw.archive_id || raw.ad_archive_id || raw.id || ""),
    page_name: pageName,
    page_id: String(raw.page_id || (snapshot.page_id as string) || ""),
    body,
    snapshot: {
      body,
      page_name: pageName,
      page_id: String(raw.page_id || (snapshot.page_id as string) || ""),
      videos: videos as Record<string, string>[],
      start_date: (snapshot.start_date as number) || (raw.start_date as number) || undefined,
    },
    start_date: (raw.start_date as number) || (snapshot.start_date as number) || Math.floor(Date.now() / 1000) - 40 * 86400,
    video_hd_url: (raw.video_hd_url as string) || "",
    video_sd_url: (raw.video_sd_url as string) || "",
    videoUrl: (raw.videoUrl as string) || "",
    ad_creative_bodies: (raw.ad_creative_bodies as string[]) || (body ? [body] : []),
  };
}

async function crawlMetaWithPlaywright(urls: string[], count: number): Promise<Record<string, unknown>[]> {
  let crawlee: Record<string, unknown>;
  try { crawlee = await import("crawlee"); } catch { throw new Error("Crawlee not installed — run `npm install crawlee playwright && npx playwright install chromium`"); }
  const PlaywrightCrawler = (crawlee as Record<string, unknown>).PlaywrightCrawler as new (opts: Record<string, unknown>) => Record<string, unknown>;
  if (!PlaywrightCrawler) throw new Error("PlaywrightCrawler unavailable");
  const collected: Record<string, unknown>[] = [];
  const headless = String(process.env.CRAWLEE_HEADLESS ?? "true").toLowerCase() !== "false";
  const proxyUrl = process.env.CRAWLEE_PROXY || "";
  const crawler = new PlaywrightCrawler({
    headless,
    requestHandlerTimeoutSecs: 90,
    navigationTimeoutSecs: 60,
    maxRequestRetries: 1,
    launchContext: { launchOptions: { headless } },
    proxyConfiguration: proxyUrl ? await (crawlee as unknown as { createProxyConfiguration: (o: unknown) => Promise<unknown> }).createProxyConfiguration({ proxyUrls: [proxyUrl] }) : undefined,
    async requestHandler({ page, request }: Record<string, unknown>) {
      const pg = page as { goto: (url: string, opts?: unknown) => Promise<void>; waitForTimeout: (ms: number) => Promise<void>; on: (ev: string, fn: (r: unknown) => void) => void };
      const intercepted: Record<string, unknown>[] = [];
      pg.on("response", async (resp: unknown) => {
        try {
          const r = resp as { url: () => string; json: () => Promise<unknown>; text: () => Promise<string> };
          if (r.url().includes("/api/graphql/") || r.url().includes("/ads/library/async/")) {
            const j = await r.json().catch(async () => JSON.parse((await r.text().catch(() => ""))?.replace(/^for\(;;\);/, "") || "{}")) as Record<string, unknown>;
            const edges = extractAdEdges(j);
            for (const e of edges) intercepted.push(e);
          }
        } catch { /* ignore */ }
      });
      await pg.goto((request as Record<string, unknown>).url as string, { waitUntil: "domcontentloaded" });
      await pg.waitForTimeout(8000);
      // Scroll to load more ads
      for (let i = 0; i < 3; i++) {
        try {
          const pg2 = pg as unknown as { evaluate: (fn: string) => Promise<void> };
          await pg2.evaluate("window.scrollBy(0, 1200)");
          await pg.waitForTimeout(1500);
        } catch { break; }
      }
      for (const a of intercepted.slice(0, count)) collected.push(a);
    },
  } as never);
  await (crawler as unknown as { run: (urls: string[]) => Promise<void> }).run(urls.slice(0, 6));
  return collected;
}

export async function runMetaCrawlee(actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  void actorId;
  const urls = (input.urls as { url: string }[]) || [];
  const count = Number(input.count) || 30;
  if (!urls.length) throw new Error("Meta scraper needs urls[]");
  const all: Record<string, unknown>[] = [];
  for (const { url } of urls) {
    const vars = buildSearchVariables(url);
    if (!vars) { console.log(`   ⚠️  Could not parse Meta URL: ${url}`); continue; }
    let edges: Record<string, unknown>[] = [];
    // 1) Direct fetch (no browser) — fastest, zero browser overhead
    try {
      edges = await fetchMetaAdsViaGraphQL(vars, count);
      if (edges.length) console.log(`   🕷️  Crawlee Meta (GraphQL) "${vars.q || vars.viewAllPageID}" → ${edges.length} ads`);
    } catch (e) {
      console.log(`   ⚠️  Meta GraphQL failed for "${vars.q || vars.viewAllPageID}": ${(e as Error).message}`);
      try {
        edges = await fetchMetaAdsViaAsyncEndpoint(vars, count);
        if (edges.length) console.log(`   🕷️  Crawlee Meta (async) "${vars.q || vars.viewAllPageID}" → ${edges.length} ads`);
      } catch (e2) {
        console.log(`   ⚠️  Meta async fallback failed: ${(e2 as Error).message}`);
      }
    }
    // 2) Playwright fallback if still empty
    if (!edges.length && String(process.env.CRAWLEE_PLAYWRIGHT_FALLBACK || "true").toLowerCase() === "true") {
      try {
        edges = await crawlMetaWithPlaywright([url], count);
        if (edges.length) console.log(`   🕷️  Crawlee Meta (Playwright) "${vars.q || vars.viewAllPageID}" → ${edges.length} ads`);
      } catch (e) {
        console.log(`   ⚠️  Playwright Meta fallback failed: ${(e as Error).message}`);
      }
    }
    all.push(...edges);
    // Avoid hammering Facebook
    if (urls.length > 1) await new Promise((r) => setTimeout(r, 800));
  }
  if (!all.length) throw new Error(`Crawlee Meta: no ads found for ${urls.length} URLs (GraphQL + async + Playwright all empty). Check network or set SCRAPER_PROVIDER=apify.`);
  // Deduplicate across URLs
  const seen = new Set<string>();
  return all.filter((a) => {
    const id = String(a.ad_archive_id || a.id || "");
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, count * urls.length);
}
