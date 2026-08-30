# Security

WhyViral runs locally. Your `.env` and your `output/` folder are yours.
We don't collect telemetry.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security bugs.

Email **manish@buildwithmanish.com** with:
- A short title
- Steps to reproduce
- Impact (what can an attacker reach?)
- Your suggested fix, if you have one

You'll get an acknowledgement within **72 hours**, and a triage decision
within **7 days**.

## Scope

In scope:
- Anything in `src/mastra/` that talks to a third party
- Anything in `src/app/api/` that handles keys or filesystem
- The CI workflow in `.github/workflows/`

Out of scope:
- Bugs in `node_modules/` — please report upstream.
- Issues caused by a compromised local machine (e.g. a leaked `.env`).

## Safe handling of secrets

- `.env` is gitignored. Never commit it.
- Use `.env.example` for the placeholder template.
- Rotate `APIFY_TOKEN` and `GEMINI_API_KEY` if you suspect leakage.
- API responses in the UI mask keys (`apif••••lViM`).
