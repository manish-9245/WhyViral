# Scraper Provider — Crawlee (open-source) vs Apify (hosted)

WhyViral used to scrape TikTok / Instagram / Meta only via hosted Apify Actors.
The `feat/opensource-scraper` branch makes **Crawlee the default** — Apify's own
open-source engine (https://crawlee.dev, Apache 2.0) — with Apify kept as an
optional fallback. You get everything Apify did, for $0, plus more.

## Why this won't get you banned

Scraping bans come from bursts, fingerprinting, and hammering private APIs.
The Crawlee provider is hardened to stay under every platform's radar:

### 1. TikTok — TikWM cache first (no direct TikTok hits)
- Primary path hits `tikwm.com/api/feed/search` — a public TikTok-CDN cache.
  Your IP never touches `tiktok.com` for search; TikWM fans out once and caches.
  One POST per keyword, 400–1100 ms jitter between keywords, max 30/page.
- Browser fallback (only if TikWM empty) uses Crawlee `PlaywrightCrawler` with:
  `maxConcurrency=1`, `autoscaledPool`, `sessionPool` (cookie rotation),
  `--disable-blink-features=AutomationControlled`, random desktop UA,
  5–7.5 s human dwell + scroll jitter, and exponential backoff on 429 /
  challenge. Gated by `CRAWLEE_WITH_BROWSER=true` — set `false` to disable
  browsers entirely (fetch-only, safest).

### 2. Instagram — fetch-first, concurrency=1, 429-aware
- One request per hashtag/account/search with browser headers
  (`X-IG-App-ID: 936619743392459` — same header IG's web app uses).
  No cookies, looks like a normal page load, not a bot swarm.
- 900–1700 ms jitter between tags/accounts, `Retry-After` respected, hard
  cap ~30 req/min (well below IG's own web rate). Playwright fallback is
  **off by default for IG** (IG detects headless quickly). Enable only with
  `CRAWLEE_WITH_BROWSER=true` + proxy. Keep `CRAWLEE_MAX_CONCURRENCY=1`.

### 3. Meta Ad Library — safest (public transparency data)
- The Ad Library is *required* by law to be publicly searchable. We hit the
  same `async/search_ads` endpoint the website itself uses — with a browser UA,
  `Referer: facebook.com`, and 800 ms jitter between URLs. No auth, no token
  scraping, no login. 1 URL at a time.

### 4. Global safety rails
- **Jitter everywhere**: 400–2000 ms random delay between any two external calls.
- **Concurrency=1 by default**: `CRAWLEE_MAX_CONCURRENCY=1`. Raise to 2–3 only with a proxy.
- **Proxy rotation**: set `CRAWLEE_PROXY=http://user:pass@host:port` (or `APIFY_PROXY_URL`) for residential/datacenter rotation when running many keywords/day.
- **Auto-fallback**: `SCRAPER_PROVIDER=auto` (default) tries Crawlee first, then falls back to Apify if a route is blocked — so you never lose a run. Set `SCRAPER_PROVIDER=crawlee` to go fully local, `apify` to go fully hosted.
- **No private API / no login**: only public search results, same as Apify Actors.

> Tip: For daily high-volume use, keep `CRAWLEE_MAX_CONCURRENCY=1` and add a proxy. For one-off research runs, defaults are already ban-safe without a proxy.

## Provider selection

| Env `SCRAPER_PROVIDER` | Behaviour | Token needed? | Cost |
|---|---|---|---|
| `crawlee` | Always use local Crawlee/fetch (zero cost) | No | $0 |
| `auto` (default) | Try Crawlee, fallback to Apify on failure | Apify optional | $0 when Crawlee succeeds |
| `apify` | Always use hosted Apify Actors | Yes | ~$0.0026 / video |

```bash
# fully open-source, no Apify token needed
SCRAPER_PROVIDER=crawlee

# best of both — safe default while migrating
SCRAPER_PROVIDER=auto
APIFY_TOKEN=apify_api_...   # optional fallback

# legacy — hosted only
SCRAPER_PROVIDER=apify
APIFY_TOKEN=apify_api_...
```

## What "can do everything apify does and more" means

| Capability | Apify (hosted) | Crawlee (local, this branch) |
|---|---|---|
| TikTok search + dedup + rank | ✅ | ✅ (TikWM + Playwright) |
| Instagram hashtag / account / keyword | ✅ | ✅ (web JSON + Playwright) |
| Meta Ad Library keyword + brand | ✅ | ✅ (public async + GraphQL) |
| TikTok video URL resolution | ✅ | ✅ (TikWM detail) |
| Cost | $/run + credit quota | $0, no quota |
| Proxy | Apify Proxy | Any (`CRAWLEE_PROXY`) |
| Stealth / fingerprint | opaque | explicit (`CRAWLEE_STEALTH`) |
| Concurrency control | per-Actor | `CRAWLEE_MAX_CONCURRENCY`, autoscaled |
| Self-hostable / offline | ❌ | ✅ (Docker, local, CI) |
| Pluggable new platform | request an Actor | add one file in `src/mastra/lib/providers/` |
| Future: YouTube Shorts / X | paid Actors | same Crawlee adapter (scaffolded) |

## Install & run (Crawlee path)

```bash
npm install              # pulls crawlee + playwright
npx playwright install chromium   # one-time browser download (~150 MB)

# optional: enable stealth plugin (extra fingerprint evasion)
npm install playwright-extra puppeteer-extra-plugin-stealth
# then set CRAWLEE_STEALTH=true (default)

echo "SCRAPER_PROVIDER=crawlee" >> .env
npm run all
# Check connections: Settings → Check now → expect "crawlee OK" + "TikWM reachable"
```

No Apify token needed for `crawlee`. Keep it in `.env` if you want `auto` fallback.

## Env reference (Crawlee)

| Variable | Default | Notes |
|---|---|---|
| `SCRAPER_PROVIDER` | `auto` | `crawlee` \| `auto` \| `apify` |
| `CRAWLEE_PROXY` | — | `http://user:pass@host:port` or `APIFY_PROXY_URL` |
| `CRAWLEE_HEADLESS` | `true` | `false` = show browser (debug) |
| `CRAWLEE_WITH_BROWSER` | `true` | `false` = fetch-only, no Playwright (safest) |
| `CRAWLEE_PLAYWRIGHT_FALLBACK` | `true` | `false` = never launch browser |
| `CRAWLEE_MAX_CONCURRENCY` | `1` | Keep 1 to stay stealthy |
| `CRAWLEE_STEALTH` | `true` | Hide `AutomationControlled` |
| `CRAWLEE_VERBOSE` | `false` | Extra routing logs |

## Files added in this branch

- `src/mastra/lib/scraper.ts` — provider factory + unified `runActor()` (replaces direct `apify-client` calls)
- `src/mastra/lib/providers/crawlee-tiktok.ts` — TikTok via TikWM + Playwright fallback
- `src/mastra/lib/providers/crawlee-instagram.ts` — IG web JSON + Playwright fallback
- `src/mastra/lib/providers/crawlee-meta.ts` — Meta async/GraphQL + Playwright fallback
- `src/mastra/lib/apify.ts` — now a shim re-exporting from `scraper.ts` (no breaking imports)
- `docs/scraper-provider.md` — this doc

Downstream tools (`scrape-tiktok.ts`, `scrape-instagram.ts`, `scrape-meta.ts`, `check-keys.ts`, `analyze-video.ts`, `api/run`) are unchanged in logic — they now call `scraper.ts` and inherit the provider choice automatically.

## Migrating from main

```bash
git checkout feat/opensource-scraper
npm install
npx playwright install chromium
# Optional: remove APIFY_TOKEN from .env or keep it for fallback
SCRAPER_PROVIDER=crawlee npm run all
```

If a platform returns empty, the logs will say whether TikWM/fetch or Playwright was tried — check `CRAWLEE_VERBOSE=true` for routing details. With `auto`, empty Crawlee automatically retries via Apify.

## Security note

Only public search endpoints are used. No credentials, no private API keys, no account login. Respect `Retry-After`, keep concurrency low, and use a proxy for bulk runs — same guidance as Apify's own docs.
