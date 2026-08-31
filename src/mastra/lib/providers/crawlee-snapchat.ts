// @ts-nocheck
// src/mastra/lib/providers/crawlee-snapchat.ts — Open-source Snapchat Spotlight/scraper via Crawlee
// Note: Snapchat is heavily auth-walled (snapchat.com/spotlight search requires session).
// We provide best-effort paths that are ban-safe:
//   1) Snapchat Spotlight public web search is limited; we try `https://www.snapchat.com/spotlight?q=...`
//      with browser UA — often empty without session, so we expect empty.
//   2) Better path: Bing-indexed Snapchat videos `site:snapchat.com spotlight`
//   3) We return empty gracefully (no throw) — app continues with other platforms.
// ANTI-BAN: One GET, abort on empty, no hammering.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (b: number, s: number) => b + Math.floor(Math.random() * s);
const randomUA = () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function fetchSnapchatSpotlight(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(800, 600));
  const url = `https://www.snapchat.com/spotlight?q=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: { "User-Agent": randomUA(), "Accept": "text/html" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Snapchat HTTP ${res.status}`);
  const html = await res.text();
  const out: Record<string, unknown>[] = [];
  // Very best-effort: look for spotlight snap IDs
  const re = /"snapId"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < count) {
    const id = m[1];
    out.push({ id, videoId: id, title: "", caption: "", url: `https://www.snapchat.com/spotlight/${id}`, videoUrl: "", platform: "snapchat" });
  }
  return out;
}
async function fetchViaBing(keyword: string, count: number): Promise<Record<string, unknown>[]> {
  await sleep(jitter(900, 500));
  const url = `https://www.bing.com/search?q=site:snapchat.com+spotlight+${encodeURIComponent(keyword)}&count=${Math.min(count, 20)}`;
  const res = await fetch(url, { headers: { "User-Agent": randomUA() }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);
  const html = await res.text();
  const out: Record<string, unknown>[] = [];
  const re = /<a[^>]+href="(https:\/\/www\.snapchat\.com\/[^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < count) {
    const h = m[1];
    const id = h.split("/").pop() || h;
    out.push({ id, videoId: id, title: "", caption: "", url: h, videoUrl: "", platform: "snapchat" });
  }
  return out;
}

export async function runSnapchatCrawlee(_actorId: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const keywords: string[] = (input.keywords as string[]) || [String(input.keyword || input.query || "")].filter(Boolean);
  const count = Number(input.count || 20);
  const perKw = Math.max(5, Math.ceil(count / Math.max(1, keywords.length)));
  const all: Record<string, unknown>[] = [];
  for (const kw of keywords.slice(0, 3)) {
    let items: Record<string, unknown>[] = [];
    try {
      items = await fetchSnapchatSpotlight(kw, perKw);
      if (items.length) console.log(`   🕷️  Crawlee Snapchat "${kw}" → ${items.length}`);
    } catch (e) { console.log(`   ⚠️  Snapchat fetch failed: ${(e as Error).message}`); }
    if (!items.length) {
      try {
        items = await fetchViaBing(kw, perKw);
        if (items.length) console.log(`   🕷️  Crawlee Snapchat (Bing) "${kw}" → ${items.length}`);
      } catch { /* ignore */ }
    }
    all.push(...items);
    await sleep(jitter(800, 600));
  }
  if (!all.length) { console.log(`   ℹ️  Snapchat: no public spotlight data (expected — heavily auth-walled). Continuing.`); return []; }
  return all.slice(0, count * Math.max(1, keywords.length));
}
