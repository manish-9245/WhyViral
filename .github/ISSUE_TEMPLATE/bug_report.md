name: Bug report
about: Something is broken in WhyViral — let me know what and how to reproduce
title: "[bug] "
labels: ["bug", "triage"]
assignees: []
---

### What happened

A clear one-liner of the bug.

### How to reproduce

1. `npm run dev` (or `npm start`)
2. Type a keyword like `knee pain`
3. Click **Run**
4. …

### What I expected

### What actually happened

```
<error message or screenshot>
```

### Environment

- WhyViral version: `1.0.0` (or commit SHA)
- Node: `node -v` →
- macOS / Linux / Windows:
- Apify plan (free / paid):
- Gemini model in `.env`: `gemini-3.5-flash` / `gemini-1.5-pro` / other

### Cache + log context

If relevant, attach:
- output of `ls -la output/`
- the relevant log lines from the Console live log
- `/api/keys` response (paste the `message` fields only — never paste keys)

### Severity

- [ ] Blocks a run end-to-end
- [ ] Degrades output but the run completes
- [ ] Cosmetic / UX only
