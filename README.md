# WhyViral

**Answer the only question that matters: *why does this work?***

WhyViral watches real videos from TikTok, Instagram, and Meta — then pins the hooks, visuals, and angles that earn distribution, each with a proof link to the source tape.

Built by [Manish Tiwari](https://github.com/manish-9245) for strategists who need proof, not opinions.

🌐 [buildwithmanish.com](https://buildwithmanish.com) · ⭐ [github.com/manish-9245/WhyViral](https://github.com/manish-9245/WhyViral)

---

## How it works

```mermaid
flowchart TD
    Start([User enters keyword]) --> Choose{Choose platform}
    Choose -->|TikTok| ScrapeTT[Apify: scrape TikTok]
    Choose -->|Instagram| DiscoverIG[Gemini: discover IG hashtags + creators]
    DiscoverIG --> ScrapeIG[Apify: scrape Instagram reels]
    Choose -->|Meta| DeriveBrands[Derive brand list from keyword]
    DeriveBrands --> ScrapeMeta[Apify: scrape Meta Ad Library]
    Choose -->|All| ScrapeAll[Run all three in parallel]

    ScrapeTT --> Pool[(Pool: ~300 raw videos)]
    ScrapeIG --> Pool
    ScrapeMeta --> Pool
    ScrapeAll --> Pool

    Pool --> Prescreen[Pre-screen: caption + language filter]
    Prescreen -->|Keep ~30| Watch{AI watch each video}

    Watch --> CacheCheck{Cached in<br/>output/analyses.json?}
    CacheCheck -->|Yes| Reuse[Reuse cached analysis]
    CacheCheck -->|No| Gemini[Gemini watches video<br/>hook · visuals · spoken line]
    Gemini --> SaveCache[Save to output/analyses.json]
    Reuse --> Next
    SaveCache --> Next[Next video]

    Next --> HaveEnough{Enough videos?}
    HaveEnough -->|No| Watch
    HaveEnough -->|Yes| Synthesize[Synthesize: cluster winning patterns]

    Synthesize --> Report[Write report JSON<br/>output/report-platform.json]
    Report --> Wall[/Wall: render String Board/]
    Wall --> Verify{Verify a cluster}
    Verify -->|Open source link| Tape[Source tape on TikTok/IG/Meta]
    Verify -->|Shoot new piece| Shoot[Create content from proven hook]
    Tape --> Done([Done])
    Shoot --> Done

    classDef ext fill:#fde68a,stroke:#f59e0b,color:#0a0a0b
    classDef ai fill:#0a0a0b,stroke:#0a0a0b,color:#fdfbf7
    classDef store fill:#fdfbf7,stroke:#78716c,color:#0a0a0b
    classDef decision fill:#fff,stroke:#0a0a0b,color:#0a0a0b
    classDef done fill:#f59e0b,stroke:#0a0a0b,color:#0a0a0b

    class ScrapeTT,ScrapeIG,ScrapeMeta,DiscoverIG,DeriveBrands,Tape ext
    class Gemini,Synthesize,Prescreen,Watch ai
    class Pool,Report,SaveCache store
    class Choose,CacheCheck,HaveEnough,Verify decision
    class Start,Done done
```

A static SVG copy is at [`docs/how-it-works.svg`](./docs/how-it-works.svg) for offline use.

---

## Features

- **Multi-platform** — search TikTok, Instagram, and Meta from a single query
- **AI video analysis** — every video is watched; hooks, visuals, and spoken lines are extracted
- **Proof-linked** — every pattern pins to the source video with a direct link
- **Automatic keyword expansion** — discovers related terms to widen the search without drift
- **Local & private** — runs on your machine; your data never leaves it
- **Cost estimator** — transparent, pay-as-you-go pricing before you spend

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/manish-9245/WhyViral.git
cd WhyViral
npm install
```

### 2. Add your API keys

```bash
cp .env.example .env
```

Edit `.env` and add:
- `APIFY_TOKEN` — [get from apify.com](https://apify.com) (scrapes videos)
- `GEMINI_API_KEY` — [get from aistudio.google.com](https://aistudio.google.com) (watches videos)

### 3. Run

```bash
npm run all
```

Opens at **http://localhost:3000**

---

## Usage

1. Enter a 2–3 word keyword (e.g., "magnesium gummies")
2. Pick a platform (TikTok, Instagram, Meta, or all)
3. Set how many videos to analyze
4. Hit **Run** — results appear in the Wall tab

Every cluster of winning patterns links back to its source tape. Verify before you create.

---

## Project structure

```
WhyViral/
├── src/
│   ├── app/              # Next.js app (pages, API routes, components)
│   ├── mastra/           # Workflow agents and tools
│   ├── components/        # UI components
│   └── lib/              # Shared types
├── public/
│   └── logo.svg          # WhyViral logo
├── output/
│   └── analyses.json     # Local analysis cache (created on first run)
└── mastra.config.ts      # Mastra workflow config
```

---

## Configuration

### Environment variables

| Variable | Description |
|---|---|
| `APIFY_TOKEN` | Apify API token for video scraping |
| `GEMINI_API_KEY` | Google Gemini API key for video analysis |

Both are required. No other secrets needed.

### Cost estimator

The cost estimator shows approximate spend per run:
- **Pool** (scraping) — varies by platform
- **Analysis** — per video watched
- **Synthesis** — pattern clustering

All costs are local estimates. No subscription required.

---

## Tech stack

- **Next.js 15** — UI framework (App Router)
- **Tailwind CSS** — styling
- **Mastra** — AI workflow orchestration
- **Apify** — video scraping
- **Google Gemini** — video analysis
- **shadcn/ui** — accessible component primitives

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (port 3000) |
| `npm run all` | Start Next.js + Mastra dev server together |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run lint` | Lint with Next.js |
| `npm run typecheck` | TypeScript check |

---

## Contributing

PRs welcome. For major changes, open an issue first to discuss what you'd change.

---

## Author

**Manish Tiwari** — [github.com/manish-9245](https://github.com/manish-9245) · [buildwithmanish.com](https://buildwithmanish.com)

---

## License

MIT — free to use, modify, and distribute. © 2026 Manish Tiwari.
