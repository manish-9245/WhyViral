<p align="center">
  <a href="https://github.com/manish-9245/WhyViral">
    <img src="public/og-image.png" alt="WhyViral — AI watches every video, then tells you exactly why it worked" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://github.com/manish-9245/WhyViral/stargazers"><img src="https://img.shields.io/github/stars/manish-9245/WhyViral?style=for-the-badge&logo=github&color=f59e0b" alt="Stars"></a>
  <a href="https://github.com/manish-9245/WhyViral/network/members"><img src="https://img.shields.io/github/forks/manish-9245/WhyViral?style=for-the-badge&logo=github&color=fbbf24" alt="Forks"></a>
  <a href="https://github.com/manish-9245/WhyViral/issues"><img src="https://img.shields.io/github/issues/manish-9245/WhyViral?style=for-the-badge&logo=github" alt="Issues"></a>
  <a href="https://github.com/manish-9245/WhyViral/blob/main/LICENSE"><img src="https://img.shields.io/github/license/manish-9245/WhyViral?style=for-the-badge&color=10b981" alt="License"></a>
  <a href="https://www.npmjs.com/package/whyviral"><img src="https://img.shields.io/badge/TypeScript-100%25-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js 15"></a>
  <a href="https://github.com/manish-9245/WhyViral/actions"><img src="https://img.shields.io/github/actions/workflow/status/manish-9245/WhyViral/ci.yml?style=for-the-badge&logo=github-actions&logoColor=white" alt="CI"></a>
  <a href="https://github.com/manish-9245/WhyViral/releases"><img src="https://img.shields.io/github/v/release/manish-9245/WhyViral?style=for-the-badge&color=blue" alt="Release"></a>
</p>

# WhyViral

> **Answer the only question that matters: *why does this work?***

WhyViral watches real videos from **9 platforms** — then pins the **hooks**, **visuals**, and **angles** that earn distribution, each with a **proof link** to the source tape.

<p align="center">
  <a href="https://www.tiktok.com"><img src="https://cdn.simpleicons.org/tiktok/000000" height="28" alt="TikTok" /></a>&nbsp;&nbsp;
  <a href="https://www.instagram.com"><img src="https://cdn.simpleicons.org/instagram/E4405F" height="28" alt="Instagram" /></a>&nbsp;&nbsp;
  <a href="https://www.facebook.com/ads/library"><img src="https://cdn.simpleicons.org/facebook/0866FF" height="28" alt="Meta" /></a>&nbsp;&nbsp;
  <a href="https://www.youtube.com"><img src="https://cdn.simpleicons.org/youtube/FF0000" height="28" alt="YouTube Shorts" /></a>&nbsp;&nbsp;
  <a href="https://x.com"><img src="https://cdn.simpleicons.org/x/000000" height="28" alt="X / Twitter" /></a>&nbsp;&nbsp;
  <a href="https://www.pinterest.com"><img src="https://cdn.simpleicons.org/pinterest/E60023" height="28" alt="Pinterest" /></a>&nbsp;&nbsp;
  <a href="https://www.reddit.com"><img src="https://cdn.simpleicons.org/reddit/FF4500" height="28" alt="Reddit" /></a>&nbsp;&nbsp;
  <a href="https://www.linkedin.com"><img src="https://cdn.simpleicons.org/linkedin/0A66C2" height="28" alt="LinkedIn" /></a>&nbsp;&nbsp;
  <a href="https://www.snapchat.com"><img src="https://cdn.simpleicons.org/snapchat/FFFC00" height="28" alt="Snapchat" /></a>
</p>

<p align="center">
  <em>TikTok · Instagram · Meta · YouTube Shorts · X/Twitter · Pinterest · Reddit · LinkedIn · Snapchat</em>
</p>

> **No Apify token needed.** Fully open-source via [Crawlee](https://crawlee.dev) + Playwright — public search, jitter + concurrency=1, ban-safe. See [`docs/scraper-provider.md`](./docs/scraper-provider.md).

Built by [**Manish Tiwari**](https://github.com/manish-9245) for strategists who need proof, not opinions.

🌐 [buildwithmanish.com](https://buildwithmanish.com) · ⭐ [github.com/manish-9245/WhyViral](https://github.com/manish-9245/WhyViral) · 📺 [Watch a 60s demo](#) · 💬 [Discussions](https://github.com/manish-9245/WhyViral/discussions)

---

## Table of contents

- [Why WhyViral](#why-whyviral)
- [How it works](#how-it-works)
- [Features](#features)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Tech stack](#tech-stack)
- [Roadmap](#roadmap)
- [Project structure](#project-structure)
- [Commands](#commands)
- [Contributing](#contributing)
- [Author](#author)
- [License](#license)
- [Star history](#star-history)

---

## Why WhyViral

Most "viral" tools show you numbers. **WhyViral shows you the *why*.**

For every keyword you search, it:

1. **Scrapes** the top videos on 9 platforms (TikTok, Instagram, Meta, YouTube Shorts, X/Twitter, Pinterest, Reddit, LinkedIn, Snapchat — or `All` at once).
2. **Watches** every video with a vision-capable model — extracting the hook, the visual pattern, the spoken line, and the angle.
3. **Clusters** the patterns that show up repeatedly across winners.
4. **Pins** every cluster to the source tape so you can verify before you create.

No hand-wavy heuristics. No opaque scores. Just the patterns that **actually earned distribution** — with the receipts.

> **Platform matrix** — all 9 use the same open-source [Crawlee](https://crawlee.dev) providers (no per-video fee, no ban risk). TikTok via TikWM cache, YouTube via Data API / ytInitialData, X via guest-token + Nitter, Pinterest/Reddit via public JSON/HTML, LinkedIn/Snapchat best-effort (auth-wall-aware, returns empty gracefully). Details: [`docs/scraper-provider.md`](./docs/scraper-provider.md).

---

## How it works

```mermaid
flowchart TD
    Start([User enters keyword]) --> Choose{Choose platform}
    Choose -->|TikTok| ScrapeTT[Crawlee: TikTok via TikWM]
    Choose -->|Instagram| DiscoverIG[Discover IG hashtags + creators]
    DiscoverIG --> ScrapeIG[Crawlee: IG search/hashtag/reels]
    Choose -->|Meta| DeriveBrands[Derive brand list from keyword]
    DeriveBrands --> ScrapeMeta[Crawlee: Meta Ad Library]
    Choose -->|YouTube| ScrapeYT[Crawlee: YouTube Shorts<br/>Data API → ytInitialData]
    Choose -->|X| ScrapeTW[Crawlee: X guest-token + Nitter]
    Choose -->|Pinterest| ScrapePin[Crawlee: Pinterest search]
    Choose -->|Reddit| ScrapeRD[Crawlee: Reddit search.json]
    Choose -->|LinkedIn/Snap| ScrapeLS[Crawlee: LinkedIn/Snap best-effort]
    Choose -->|All| ScrapeAll[Run all 9 in parallel]

    ScrapeTT --> Pool[(Pool: ~300 raw videos)]
    ScrapeIG --> Pool
    ScrapeMeta --> Pool
    ScrapeYT --> Pool
    ScrapeTW --> Pool
    ScrapePin --> Pool
    ScrapeRD --> Pool
    ScrapeLS --> Pool
    ScrapeAll --> Pool

    Pool --> Prescreen[Pre-screen: caption + language filter]
    Prescreen -->|Keep ~30| Watch{AI watch each video}

    Watch --> CacheCheck{Cached in<br/>output/analyses.json?}
    CacheCheck -->|Yes| Reuse[Reuse cached analysis]
    CacheCheck -->|No| Gemini[AI watches video<br/>hook · visuals · spoken line]
    Gemini --> SaveCache[Save to output/analyses.json]
    Reuse --> Next
    SaveCache --> Next[Next video]

    Next --> HaveEnough{Enough videos?}
    HaveEnough -->|No| Watch
    HaveEnough -->|Yes| Synthesize[Synthesize: cluster winning patterns]

    Synthesize --> Report[Write report JSON<br/>output/report-platform.json]
    Report --> Wall[/Wall: render String Board/]
    Wall --> Verify{Verify a cluster}
    Verify -->|Open source link| Tape[Source tape on TikTok/IG/YouTube/...]
    Verify -->|Shoot new piece| Shoot[Create content from proven hook]
    Tape --> Done([Done])
    Shoot --> Done

    classDef ext fill:#fde68a,stroke:#f59e0b,color:#0a0a0b
    classDef ai fill:#0a0a0b,stroke:#0a0a0b,color:#fdfbf7
    classDef store fill:#fdfbf7,stroke:#78716c,color:#0a0a0b
    classDef decision fill:#fff,stroke:#0a0a0b,color:#0a0a0b
    classDef done fill:#f59e0b,stroke:#0a0a0b,color:#0a0a0b

    class ScrapeTT,ScrapeIG,ScrapeMeta,ScrapeYT,ScrapeTW,ScrapePin,ScrapeRD,ScrapeLS,DiscoverIG,DeriveBrands,Tape ext
    class Gemini,Synthesize,Prescreen,Watch ai
    class Pool,Report,SaveCache store
    class Choose,CacheCheck,HaveEnough,Verify decision
    class Start,Done done
```

A static SVG copy is at [`docs/how-it-works.svg`](./docs/how-it-works.svg) for offline use.

---

## Features

| | |
|---|---|
| 🎯 **9 platforms + All** | <img src="https://cdn.simpleicons.org/tiktok/000000" height="14" alt="TikTok" /> TikTok · <img src="https://cdn.simpleicons.org/instagram/E4405F" height="14" alt="IG" /> Instagram · <img src="https://cdn.simpleicons.org/facebook/0866FF" height="14" alt="Meta" /> Meta · <img src="https://cdn.simpleicons.org/youtube/FF0000" height="14" alt="YT" /> YouTube Shorts · <img src="https://cdn.simpleicons.org/x/000000" height="14" alt="X" /> X · <img src="https://cdn.simpleicons.org/pinterest/E60023" height="14" alt="Pinterest" /> Pinterest · <img src="https://cdn.simpleicons.org/reddit/FF4500" height="14" alt="Reddit" /> Reddit · <img src="https://cdn.simpleicons.org/linkedin/0A66C2" height="14" alt="LinkedIn" /> LinkedIn · <img src="https://cdn.simpleicons.org/snapchat/FFFC00" height="14" alt="Snapchat" /> Snapchat — one query, in parallel |
| 🕷️ **Open-source scraper** | [Crawlee](https://crawlee.dev) + Playwright — public search, jitter + concurrency=1, ban-safe. No Apify token needed. Apify retained as optional fallback (`SCRAPER_PROVIDER=auto`). See [`docs/scraper-provider.md`](./docs/scraper-provider.md) |
| 🤖 **AI video analysis** | Every video is watched; hooks, visuals, spoken lines are extracted |
| 🔗 **Proof-linked** | Every pattern pins to the source video with a direct link |
| 🧠 **Auto keyword expansion** | Discovers related terms to widen the search without drift |
| 🧱 **Granular pipeline** | Scrape → prescreen → watch → deep → synth, resumable from any stage |
| 💾 **Local & private** | Runs on your machine; data never leaves it |
| 💸 **Transparent cost** | Real per-stage cost in the UI before and after a run (`$0` scrape with Crawlee) |
| 🗂️ **Flat-file storage** | All reports in `output/` as JSON — diffable, version-controllable |
| 🧰 **REST API** | Programmatic access via `POST /api/run`, `GET /api/state`, `GET /api/cache` |
| ⌨️ **Keyboard friendly** | Console + History + Report + Settings — full UI in plain HTML |
| 🎨 **Real brand icons** | Official logos via [Simple Icons](https://simpleicons.org) + [`react-icons`](https://react-icons.github.io/react-icons) (`PlatformIcon` component) on every platform picker, wall, and report |

---

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/manish-9245/WhyViral.git
cd WhyViral
npm install
npx playwright install chromium   # one-time browser download (~150 MB) for Crawlee fallback
```

### 2. Add your API keys

```bash
cp .env.example .env
```

Edit `.env` and add:
- `GEMINI_API_KEY` — [get from aistudio.google.com](https://aistudio.google.com) (watches videos) — **required**
- `YOUTUBE_API_KEY` — [get from console.cloud.google.com](https://console.cloud.google.com) (YouTube Shorts, optional — fallback scrapes without it)
- `APIFY_TOKEN` — [get from apify.com](https://apify.com) (optional fallback when `SCRAPER_PROVIDER=auto`)

> **No Apify token needed** for the default `SCRAPER_PROVIDER=crawlee` — all 9 platforms are scraped open-source. See [`docs/scraper-provider.md`](./docs/scraper-provider.md) for anti-ban details.

### 3. Run

```bash
npm run all
```

Opens at **http://localhost:3000** — enter a keyword like `magnesium gummies`, pick a platform (now with real brand icons <img src="https://cdn.simpleicons.org/tiktok/000000" height="12" alt="TikTok" /> <img src="https://cdn.simpleicons.org/youtube/FF0000" height="12" alt="YT" /> <img src="https://cdn.simpleicons.org/x/000000" height="12" alt="X" /> etc.), hit **Run**.

> First run takes a few minutes (the AI is watching real videos). After that, the local cache makes re-runs nearly free.

---

## Usage

1. Enter a 2–3 word keyword (e.g., `magnesium gummies`, `knee pain`, `ai agents`).
2. Pick a platform — <img src="https://cdn.simpleicons.org/tiktok/000000" height="13" alt="TikTok" /> TikTok · <img src="https://cdn.simpleicons.org/instagram/E4405F" height="13" alt="IG" /> Instagram · <img src="https://cdn.simpleicons.org/facebook/0866FF" height="13" alt="Meta" /> Meta · <img src="https://cdn.simpleicons.org/youtube/FF0000" height="13" alt="YT" /> YouTube Shorts · <img src="https://cdn.simpleicons.org/x/000000" height="13" alt="X" /> X · <img src="https://cdn.simpleicons.org/pinterest/E60023" height="13" alt="Pinterest" /> Pinterest · <img src="https://cdn.simpleicons.org/reddit/FF4500" height="13" alt="Reddit" /> Reddit · <img src="https://cdn.simpleicons.org/linkedin/0A66C2" height="13" alt="LinkedIn" /> LinkedIn · <img src="https://cdn.simpleicons.org/snapchat/FFFC00" height="13" alt="Snapchat" /> Snapchat, or **All** (all 9 in parallel) — each pill now shows its real brand icon.
3. Set how many videos to analyze (5 / 10 / 20 / 30 / 50 / 100).
4. Hit **Run** — the Wall tab shows clusters of winning patterns, each pinned to its source tape.

### Programmatic

```bash
# Start a run
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{"keyword":"magnesium gummies","platform":"tiktok","videoCount":10}'

# Poll the pipeline state
curl http://localhost:3000/api/state?platform=tiktok

# Inspect a report
curl http://localhost:3000/api/report?platform=tiktok
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `SCRAPER_PROVIDER` | `auto` | `crawlee` (open-source, $0), `auto` (Crawlee + Apify fallback), `apify` (hosted only). See [`docs/scraper-provider.md`](./docs/scraper-provider.md) |
| `APIFY_TOKEN` | — | Apify API token (only needed if `SCRAPER_PROVIDER=apify` or for `auto` fallback) |
| `GEMINI_API_KEY` | — | **required.** Gemini API key |
| `YOUTUBE_API_KEY` | — | YouTube Data API v3 key (optional — Shorts fallback scrapes `ytInitialData` without it, zero ban risk vs quota) |
| `LINKEDIN_COOKIE` | — | `li_at` cookie for LinkedIn auth search (optional — without it LinkedIn returns empty gracefully, no ban) |
| `CRAWLEE_PROXY` | — | `http://user:pass@host:port` — residential/datacenter proxy for high-volume runs |
| `CRAWLEE_MAX_CONCURRENCY` | `1` | Keep `1` to stay stealthy/ban-safe; `2–3` only with proxy |
| `CRAWLEE_HEADLESS` | `true` | `false` = show browser (debug) |
| `CRAWLEE_WITH_BROWSER` | `true` | `false` = fetch-only, no Playwright (safest, especially for IG) |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Model used to watch videos |
| `VIDEO_COUNT` | `5` | Videos per run |
| `RANK_BY` | `engagement` | `engagement` / `reach` / `views` |
| `VIEW_FLOOR` | `100000` | Skip tapes below this view count (YouTube floor is 1K) |
| `LANGUAGE` | `en` | `en` / `id` / `any` |
| `COUNTRY` | `US` | `US` / `GB` / `AU` / `IN` / `CA` / `ALL` |
| `DEEP_COUNT` | `8` | How many tapes get a deep read (0 = off) |

The in-app **Settings** page (`/settings`) writes these to `.env` and calls **Check Connections** to verify Crawlee (9 platforms + anti-ban: jitter + concurrency=1) + Apify (if token) + Gemini + YouTube API (if key) are reachable — with real brand icons.

---

## Tech stack

- [**Next.js 15**](https://nextjs.org) — UI framework (App Router)
- [**Tailwind CSS**](https://tailwindcss.com) — styling
- **TypeScript** — strict, end-to-end
- [**Crawlee**](https://crawlee.dev) + [**Playwright**](https://playwright.dev) — open-source scraping engine (9 platforms, Apache 2.0) — TikWM cache, ytInitialData, X guest-token + Nitter, Pinterest/Reddit JSON, LinkedIn/Snapchat best-effort; jitter + concurrency=1, ban-safe. Apify retained only as optional fallback.
- [**Simple Icons**](https://simpleicons.org) + [`react-icons`](https://react-icons.github.io/react-icons) — real brand icons for all 9 platforms via `PlatformIcon` (`src/components/PlatformIcon.tsx`)
- **Vision-capable model** (Gemini / Vertex) — watches every video

---

## Roadmap

- [x] Multi-platform scrape (TikTok / Instagram / Meta)
- [x] **Open-source Crawlee provider** — replaces hosted Apify, `$0`, ban-safe (jitter + `concurrency=1` + stealth) — `src/mastra/lib/scraper.ts` + `docs/scraper-provider.md`
- [x] **9 platforms** — <img src="https://cdn.simpleicons.org/tiktok/000000" height="12" alt="TikTok" /> TikTok · <img src="https://cdn.simpleicons.org/instagram/E4405F" height="12" alt="Instagram" /> Instagram · <img src="https://cdn.simpleicons.org/facebook/0866FF" height="12" alt="Meta" /> Meta · <img src="https://cdn.simpleicons.org/youtube/FF0000" height="12" alt="YouTube" /> YouTube Shorts · <img src="https://cdn.simpleicons.org/x/000000" height="12" alt="X" /> X · <img src="https://cdn.simpleicons.org/pinterest/E60023" height="12" alt="Pinterest" /> Pinterest · <img src="https://cdn.simpleicons.org/reddit/FF4500" height="12" alt="Reddit" /> Reddit · <img src="https://cdn.simpleicons.org/linkedin/0A66C2" height="12" alt="LinkedIn" /> LinkedIn · <img src="https://cdn.simpleicons.org/snapchat/FFFC00" height="12" alt="Snapchat" /> Snapchat + `All` (parallel) — see `src/mastra/lib/providers/` + `src/mastra/tools/scrape-*.ts`
- [x] **Real brand icons** everywhere — `PlatformIcon` (`src/components/PlatformIcon.tsx`) via `react-icons`/`Simple Icons` on Console, History, Reports, README
- [x] Per-video AI analysis with caching
- [x] Proof-linked wall of winning patterns
- [x] Granular pipeline with resume
- [x] Local cost estimator (`$0` scrape with Crawlee)
- [x] REST API for headless use
- [x] Pluggable Crawlee adapters (add a file in `src/mastra/lib/providers/` — see `docs/scraper-provider.md`)
- [ ] Multi-keyword batch runs
- [ ] Webhook notifications on pipeline completion
- [ ] Facebook Reels / Snapchat Spotlight deep extraction (currently best-effort)

See [open issues](https://github.com/manish-9245/WhyViral/issues) for the full list.

---

## Platform support

| Platform | Icon | Provider | Method | Ban-safe? | Needs key? |
|---|---|---|---|---|---|
| TikTok | <img src="https://cdn.simpleicons.org/tiktok/000000" height="16" alt="TikTok" /> | `crawlee-tiktok` | TikWM cache → Playwright XHR intercept | ✅ jitter + `concurrency=1` | No |
| Instagram | <img src="https://cdn.simpleicons.org/instagram/E4405F" height="16" alt="Instagram" /> | `crawlee-instagram` | Web JSON (`X-IG-App-ID`) → Playwright | ✅ fetch-first, IG `concurrency=1` | No |
| Meta | <img src="https://cdn.simpleicons.org/facebook/0866FF" height="16" alt="Meta" /> | `crawlee-meta` | Ad Library `async/search_ads` → GraphQL | ✅ public data, 800 ms jitter | No |
| YouTube Shorts | <img src="https://cdn.simpleicons.org/youtube/FF0000" height="16" alt="YouTube" /> | `crawlee-youtube` | Data API v3 → `ytInitialData` → Playwright + Piped resolver | ✅ Data API quota or jitter | `YOUTUBE_API_KEY` optional |
| X / Twitter | <img src="https://cdn.simpleicons.org/x/000000" height="16" alt="X" /> | `crawlee-twitter` | Guest-token `adaptive.json` → Nitter HTML | ✅ Nitter fallback, no login | No |
| Pinterest | <img src="https://cdn.simpleicons.org/pinterest/E60023" height="16" alt="Pinterest" /> | `crawlee-pinterest` | `search/videos` HTML → `initialReduxState` | ✅ one GET, 900 ms jitter | No |
| Reddit | <img src="https://cdn.simpleicons.org/reddit/FF4500" height="16" alt="Reddit" /> | `crawlee-reddit` | `search.json` → `reddit_video.fallback_url` | ✅ public JSON, 700 ms jitter | No |
| LinkedIn | <img src="https://cdn.simpleicons.org/linkedin/0A66C2" height="16" alt="LinkedIn" /> | `crawlee-linkedin` | Public → Bing `site:linkedin.com` | ✅ returns empty gracefully | `LINKEDIN_COOKIE` optional |
| Snapchat | <img src="https://cdn.simpleicons.org/snapchat/FFFC00" height="16" alt="Snapchat" /> | `crawlee-snapchat` | `spotlight` → Bing fallback | ✅ returns empty gracefully | No |

All icons via `PlatformIcon` (`src/components/PlatformIcon.tsx`) using [`react-icons/si`](https://react-icons.github.io/react-icons) (Simple Icons).

## Project structure

```
WhyViral/
├── src/
│   ├── app/                 # Next.js routes (Console, History, Report, Settings)
│   │   └── api/             # REST endpoints
│   ├── components/
│   │   ├── PlatformIcon.tsx # Real brand icons for all 9 platforms (react-icons)
│   │   └── ...              # Shared UI (Logo, Nav, etc.)
│   ├── lib/
│   │   └── types.ts         # Platform union (9) + Video/Analysis types
│   └── mastra/
│       ├── lib/
│       │   ├── scraper.ts             # Unified Crawlee + Apify router (9 platforms, ALL_PLATFORMS)
│       │   ├── apify.ts               # Shim → scraper.ts (back-compat)
│       │   └── providers/             # Crawlee providers (one per platform)
│       │       ├── crawlee-tiktok.ts
│       │       ├── crawlee-instagram.ts
│       │       ├── crawlee-meta.ts
│       │       ├── crawlee-youtube.ts
│       │       ├── crawlee-twitter.ts
│       │       ├── crawlee-pinterest.ts
│       │       ├── crawlee-reddit.ts
│       │       ├── crawlee-linkedin.ts
│       │       └── crawlee-snapchat.ts
│       ├── tools/           # Mastra tools (one per platform)
│       │   ├── scrape-tiktok.ts / scrape-instagram.ts / scrape-meta.ts
│       │   ├── scrape-youtube.ts / scrape-twitter.ts / ...
│       │   └── analyze-video.ts (Piped resolver for YouTube)
│       ├── workflows/archive-workflow.ts # Handles all 9 + all
│       └── agents/          # video-analyst, synthesizer, ig-discover
├── public/
│   ├── logo.svg             # Brand mark
│   └── og-image.png         # Social preview (1280×640)
├── docs/
│   ├── scraper-provider.md  # Crawlee anti-ban guide (per-platform)
│   ├── how-it-works.mmd     # Mermaid source
│   ├── how-it-works.svg     # Static diagram
│   └── screenshots/         # UI captures
├── output/                  # All run data, gitignored
├── .github/
│   ├── ISSUE_TEMPLATE/      # Bug, feature, question
│   ├── workflows/           # CI, release, stale, labeler
│   ├── FUNDING.yml          # GitHub Sponsors
│   ├── CODEOWNERS
│   ├── SECURITY.md
│   ├── CONTRIBUTING.md
│   └── dependabot.yml
├── LICENSE                  # MIT
└── README.md                # you are here
```

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (clears `.next` first) |
| `npm run all` | Start Next.js + workflow dev together |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run clean` | Clear `.next`, `.turbo`, `node_modules/.cache` |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | Lint `src/` |

---

## Contributing

We love PRs. Read [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) first, then:

1. Fork & branch off `main` (`feat/<short-name>` or `fix/<short-name>`).
2. Make your change. Run `npm run typecheck && npm run build`.
3. If your change touches the pipeline, do a real local run on a keyword.
4. Open a PR — fill in the [PR template](./.github/PULL_REQUEST_TEMPLATE.md).

> First-time contributor? Look for issues labelled [`good first issue`](https://github.com/manish-9245/WhyViral/issues?q=is%3Aopen+label%3A%22good+first+issue%22).

---

## Show your support

If WhyViral saved you a research sprint, give it a ⭐ — it helps more than you think.

<a href="https://github.com/manish-9245/WhyViral">
  <img src="https://img.shields.io/github/stars/manish-9245/WhyViral?style=social" alt="Star WhyViral">
</a>

---

## Author

**Manish Tiwari** — [@manish-9245](https://github.com/manish-9245) · [buildwithmanish.com](https://buildwithmanish.com)

WhyViral is one of several open-source tools from Manish. Browse them all at [buildwithmanish.com](https://buildwithmanish.com).

---

## License

[MIT](./LICENSE) — free to use, modify, and distribute. © 2026 Manish Tiwari.

---

## Star history

<a href="https://star-history.com/#manish-9245/WhyViral&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=manish-9245/WhyViral&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=manish-9245/WhyViral&type=Date" />
    <img alt="Star history" src="https://api.star-history.com/svg?repos=manish-9245/WhyViral&type=Date" />
  </picture>
</a>

<sub>Built with patience and far too much coffee by <a href="https://buildwithmanish.com">Manish Tiwari</a>.</sub>
