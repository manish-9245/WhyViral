# Contributing to WhyViral

Thanks for the PR, the issue, or the star. All of it helps.

## Ground rules

- **Local-first.** No telemetry, no third-party analytics, no outbound calls
  beyond Apify + the AI model. Keep it that way.
- **Consumer copy is sacred.** UI strings must never mention internal vendors
  by name (e.g. Mastra, shadcn, Gemini). Call them the model, the framework,
  the UI primitives — or just don't name them.
- **No secrets in commits.** `.env` is gitignored. CI never reads it.

## Setup

```bash
git clone https://github.com/manish-9245/WhyViral.git
cd WhyViral
npm ci
cp .env.example .env
# fill APIFY_TOKEN + GEMINI_API_KEY
npm run dev
```

## Verifying before opening a PR

```bash
npm run typecheck   # tsc --noEmit
npm run build       # next build
```

Both must pass. If your change touches the pipeline (`src/mastra/` or
`src/app/api/`), also run a local keyword end-to-end and confirm
`output/patterns-tiktok.json` looks right.

## Project layout

```
src/
  app/                 # Next.js routes — Console, History, Report, Settings
    api/               # /api/run, /api/state, /api/keys, /api/cache, /api/export, …
  components/          # Shared UI (Logo, Nav, etc.)
  mastra/              # Pipeline agents + helpers
    lib/               # scrape, watch, synth, state, cache
  lib/                 # types, formatting
public/
  logo.svg             # Brand mark
  og-image.png         # GitHub social preview (1280×640)
output/                # All run data lives here, gitignored
docs/
  how-it-works.mmd     # Mermaid source for the pipeline diagram
  screenshots/         # UI captures referenced from the README
```

## Branching

- `main` is always deployable.
- Branch off `main` with `feat/<short-name>`, `fix/<short-name>`, or
  `docs/<short-name>`.

## Commit messages

```
<type>: <imperative summary under 72 chars>

<optional body — wrap at 72, explain what and why, not how>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`,
`build`.

## Review

- A maintainer (Manish) reviews all PRs.
- Small PRs (< ~300 lines) get reviewed fastest.
- If your PR is large, split it. Cite the issue / discussion in the body.

## Security

Found a vulnerability? Please do **not** open a public issue. See
[`SECURITY.md`](./SECURITY.md).
