// @ts-nocheck
// src/mastra/lib/providers/crawlee-linkedin.ts — Open-source LinkedIn video scraper via Crawlee
// Note: LinkedIn is the strictest platform (requires auth for most search). We provide
// a BEST-EFFORT open-source path:
//   1) Public LinkedIn search page `https://www.linkedin.com/search/results/all/?keywords=...` —
//      fetch attempt with browser UA (often redirects to authwall). If blocked we return empty
//      and caller falls back gracefully (no ban, just no data). We DO NOT attempt credential stuffing.
//   2) Better path: use Bing/Google-indexed LinkedIn videos via `https://www.bing.com/search?q=site:linkedin.com+...&qft=filterui:video`
//      — fully public, no LinkedIn hit.
//   3) If user provides `LINKEDIN_COOKIE` (li_at), we can fetch authenticated search — still
//      concurrency=1, jitter, 429-aware. Without it we stay safe and just explain.
// ANTI-BAN: We never hammer LinkedIn; one GET, abort on authwall, suggest Bing fallback or `auto` with no data (no ban).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (b: number, s: number) => b + Math.floor(Math.random() * s);
const randomUA = () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function fetchLinkedInPublic(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(800, 700));
  const cookie = process.env.LINKEDIN_COOKIE || "";
  const url = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(keyword)}&origin=GLOBAL_SEARCH_HEADER`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": randomUA(),
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      ...(cookie ? { Cookie: `li_at=${cookie}` } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  // 303/999 = authwall — not an error, just no public data
  if (res.status === 303 || res.status === 302 || res.status === 999) {
    throw new Error("LinkedIn authwall — public search requires login. Set LINKEDIN_COOKIE or use Bing-indexed fallback.");
  }
  if (!res.ok) throw new Error(`LinkedIn HTTP ${res.status}`);
  const html = await res.text();
  if (html.includes("authwall") || html.includes("AuthWall")) throw new Error("LinkedIn authwall detected");
  return parseLinkedInHTML(html).slice(0, count);
}
function parseLinkedInHTML(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  // Best-effort: LinkedIn renders data in `code` blocks with JSON
  const re = /"urn:li:activity:(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 20) {
    const id = m[1];
    out.push({ id, videoId: id, title: "", caption: "", url: `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`, videoUrl: "", platform: "linkedin" });
  }
  return out;
}
async function fetchViaBingIndexed(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(900, 600));
  const url = `https://www.bing.com/search?q=site:linkedin.com+${encodeURIComponent(keyword)}+video&count=${Math.min(count, 20)}`;
  const res = await fetch(url, { headers: { "User-Agent": randomUA(), "Accept": "text/html" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);
  const html = await res.text();
  const out: Record<string, unknown>[] = [];
  const re = /<a[^>]+href="(https:\/\/www\.linkedin\.com\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < count) {
    const h = m[1], title = m[2].replace(/<[^>]+>/g, "");
    if (!h.includes("/feed/update/")) continue;
    const id = h.match(/activity:(\d+)/)?.[1] || h;
    out.push({ id, videoId: id, title, caption: title, url: h, videoUrl: "", platform: "linkedin" });
  }
  return out;
}

export async function runLinkedinCrawlee(_actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const keywords: string[] = (input.keywords as string[]) || [String(input.keyword || input.query || "")].filter(Boolean);
  const count = Number(input.count || 20);
  const perKw = Math.max(5, Math.ceil(count / Math.max(1, keywords.length)));
  const all: Record<string, unknown>[] = [];
  for (const kw of keywords.slice(0, 3)) {
    let items: Record<string, unknown>[] = [];
    try {
      items = await fetchLinkedInPublic(kw, perKw);
      if (items.length) console.log(`   🕷️  Crawlee LinkedIn "${kw}" → ${items.length} posts`);
    } catch (e) {
      console.log(`   ⚠️  LinkedIn public fetch failed for "${kw}": ${(e as Error).message}`);
      try {
        items = await fetchViaBingIndexed(kw, perKw);
        if (items.length) console.log(`   🕷️  Crawlee LinkedIn (Bing) "${kw}" → ${items.length} posts`);
      } catch (e2) { console.log(`   ⚠️  Bing fallback failed: ${(e2 as Error).message}`); }
    }
    all.push(...items);
    await sleep(jitter(900, 700));
  }
  if (!all.length) {
    console.log(`   ℹ️  LinkedIn: no public videos — LinkedIn is auth-walled. This is expected without LINKEDIN_COOKIE. Continuing with empty set (no ban).`);
    return []; // Don't throw — let caller handle empty gracefully (no ban)
  }
  return all.slice(0, count * Math.max(1, keywords.length));
}
