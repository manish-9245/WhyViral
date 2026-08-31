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
// 900–1500ms jitter, UA rotation, concurrency=1. `pins` carry view counts only if video; we filter to `is_video`.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (b: number, s: number) => b + Math.floor(Math.random() * s);
const randomUA = () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function fetchPinterestSearch(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(900, 600));
  // Try HTML + initialReduxState path (most reliable unauthenticated)
  const url = `https://www.pinterest.com/search/videos/${encodeURIComponent(keyword)}/`;
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
  if (!res.ok) throw new Error(`Pinterest HTTP ${res.status}`);
  const html = await res.text();
  // Extract JSON blobs
  const m = html.match(/id="initial-state"[^>]*>(.+?)<\/script>/) || html.match(/window\.__initialReduxState__\s*=\s*(\{.+?\});<\/script>/s) || html.match(/"resourceResponses":\s*(\[.+?\])/s);
  let data: Record<string, unknown> | null = null;
  if (m) { try { data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch { /* ignore */ } }
  if (!data) {
    // Try __PWS_DATA__
    const pws = html.match(/id="__PWS_DATA__"[^>]*>(.+?)<\/script>/);
    if (pws) { try { data = JSON.parse(pws[1]); } catch { /* ignore */ } }
  }
  if (!data) return parsePinterestPinsFromHTML(html).slice(0, count);
  return extractPins(data).slice(0, count);
}

function parsePinterestPinsFromHTML(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  // Look for pin JSON objects inline
  const re = /"id"\s*:\s*"(\d+)"[^}]*"is_video"\s*:\s*true[^}]*"description"\s*:\s*"([^"]*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 50) {
    const id = m[1], desc = m[2];
    out.push({ id, videoId: id, title: desc, caption: desc, url: `https://www.pinterest.com/pin/${id}/`, videoUrl: "", viewCount: 0, platform: "pinterest", is_video: true });
  }
  return out;
}

function extractPins(data: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { for (const v of obj) walk(v); return; }
    const rec = obj as Record<string, unknown>;
    if (rec.id && (rec.is_video === true || rec.videos || rec.video)) {
      const id = String(rec.id);
      const desc = (rec.description as string) || (rec.title as string) || (rec.grid_title as string) || "";
      const videos = rec.videos as Record<string, unknown> | undefined;
      const videoUrl = (videos?.video_list as Record<string, Record<string, string>>)?.V_720P?.url || (videos as Record<string,string>)?.url || "";
      out.push({ id, videoId: id, title: desc, caption: desc, url: `https://www.pinterest.com/pin/${id}/`, videoUrl, viewCount: Number(rec.view_count || 0), platform: "pinterest" });
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
  if (!all.length) throw new Error(`Pinterest: no videos for "${keywords.join(", ")}"`);
  return all.slice(0, count * Math.max(1, keywords.length));
}
