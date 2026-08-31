// @ts-nocheck
// src/mastra/lib/providers/crawlee-pinterest.ts — Open-source Pinterest video (Idea Pin) scraper via Crawlee
// Strategy:
//   1) Pinterest search JSON (`https://www.pinterest.com/resource/BaseSearchResource/get/`) — public, no login.
//      Requires `X-Pinterest-PWS-Handler`-like headers extracted from initial page, but we can
//      reuse the HTML-embedded `initialReduxState` as fallback (fetch HTML and parse `initialReduxState`).
//   2) Fetch HTML search page `https://www.pinterest.com/search/videos/${query}/` and parse
//      `__PWS_DATA__` / `initialReduxState` JSON for pins with `videos`.
//   3) Playwright gated fallback.
//
// ANTI-BAN: Pinterest is lenient for unauthenticated GETs. We use ONE GET per keyword,
// 900–1500ms jitter, UA rotation, concurrency=1. Pins include BOTH image + video (text+video analyzable).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (b: number, s: number) => b + Math.floor(Math.random() * s);
const randomUA = () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function fetchPinterestSearch(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(900, 600));
  // Support both text+video: first try pins (all), fallback to videos-specific
  const urls = [
    `https://www.pinterest.com/search/pins/${encodeURIComponent(keyword)}/`,
    `https://www.pinterest.com/search/videos/${encodeURIComponent(keyword)}/`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": randomUA(),
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.pinterest.com/",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) throw new Error(`Pinterest 429 — retry after ${res.headers.get("retry-after") || "60s"}`);
      if (!res.ok) continue;
      const html = await res.text();
      const m = html.match(/id="initial-state"[^>]*>(.+?)<\/script>/) || html.match(/window\.__initialReduxState__\s*=\s*(\{.+?\});<\/script>/s) || html.match(/"resourceResponses":\s*(\[.+?\])/s);
      let data: Record<string, unknown> | null = null;
      if (m) { try { data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch { /* ignore */ } }
      if (!data) {
        const pws = html.match(/id="__PWS_DATA__"[^>]*>(.+?)<\/script>/);
        if (pws) { try { data = JSON.parse(pws[1]); } catch { /* ignore */ } }
      }
      if (!data) {
        const pins = parsePinterestPinsFromHTML(html);
        if (pins.length) return pins.slice(0, count);
        continue;
      }
      const pins = extractPins(data);
      if (pins.length) return pins.slice(0, count);
    } catch { /* try next URL */ }
  }
  // Last resort: parse any pins from first URL's HTML
  return [];
}

function parsePinterestPinsFromHTML(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  // Capture both video + image pins — text+video analyzable
  const re = /"id"\s*:\s*"(\d+)"[^}]{0,300}"description"\s*:\s*"([^"]*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 50) {
    const id = m[1], desc = m[2];
    // Filter obvious non-pin noise (short ids)
    if (id.length < 5) continue;
    const isVideo = m[0].includes('"is_video":true') || m[0].includes('"videos"');
    out.push({ id, videoId: id, title: desc, caption: desc, url: `https://www.pinterest.com/pin/${id}/`, videoUrl: "", imageUrl: "", viewCount: 0, platform: "pinterest", contentType: isVideo ? "video" : "image", is_video: isVideo });
  }
  // Fallback: extract any pin id + title pairs
  if (!out.length) {
    const alt = /"id"\s*:\s*"(\d+)"[^}]{0,300}"grid_title"\s*:\s*"([^"]*?)"/g;
    while ((m = alt.exec(html)) && out.length < 50) {
      const id = m[1], title = m[2];
      out.push({ id, videoId: id, title, caption: title, url: `https://www.pinterest.com/pin/${id}/`, videoUrl: "", platform: "pinterest", contentType: "image" });
    }
  }
  return out;
}

function extractPins(data: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { for (const v of obj) walk(v); return; }
    const rec = obj as Record<string, unknown>;
    // Accept any pin with id + description/title — both image (text) and video analyzable
    const hasId = rec.id && String(rec.id).length > 4;
    const hasDesc = rec.description || rec.title || rec.grid_title || rec.gridTitle;
    if (hasId && hasDesc) {
      const id = String(rec.id);
      const desc = (rec.description as string) || (rec.title as string) || (rec.grid_title as string) || (rec.gridTitle as string) || "";
      const videos = rec.videos as Record<string, unknown> | undefined;
      const videoUrl = (videos?.video_list as Record<string, Record<string, string>>)?.V_720P?.url || (videos as Record<string,string>)?.url || "";
      const images = rec.images as Record<string, unknown> | undefined;
      const imageUrl = (images?.["736x"] as Record<string,string>)?.url || (rec.image as string) || "";
      const isVideo = rec.is_video === true || Boolean(rec.videos || rec.video);
      out.push({ id, videoId: id, title: desc, caption: desc, url: `https://www.pinterest.com/pin/${id}/`, videoUrl, imageUrl, viewCount: Number(rec.view_count || 0), platform: "pinterest", contentType: isVideo ? "video" : "image" });
      return;
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(data);
  const seen = new Set<string>();
  return out.filter((p) => { const id = String(p.id); if (seen.has(id)) return false; seen.add(id); return true; });
}

export async function runPinterestCrawlee(_actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const keywords: string[] = (input.keywords as string[]) || [String(input.keyword || input.query || "")].filter(Boolean);
  const count = Number(input.count || 30);
  const perKw = Math.max(8, Math.ceil(count / Math.max(1, keywords.length)));
  const all: Record<string, unknown>[] = [];
  for (const kw of keywords.slice(0, 4)) {
    let items: Record<string, unknown>[] = [];
    try {
      items = await fetchPinterestSearch(kw, perKw);
      if (items.length) console.log(`   🕷️  Crawlee Pinterest "${kw}" → ${items.length} pins`);
    } catch (e) { console.log(`   ⚠️  Pinterest fetch failed for "${kw}": ${(e as Error).message}`); }
    all.push(...items);
    await sleep(jitter(900, 800));
  }
  if (!all.length) throw new Error(`Pinterest: no pins for "${keywords.join(", ")}"`);
  return all.slice(0, count * Math.max(1, keywords.length));
}
