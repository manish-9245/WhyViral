#!/usr/bin/env bash
# WhyViral — one-command setup for first-time users.
# Usage: curl -fsSL https://raw.githubusercontent.com/manish-9245/WhyViral/main/scripts/setup.sh | bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node 20+ is required. Install: https://nodejs.org"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node 20+ is required. You have $(node -v)."
  exit 1
fi

REPO="https://github.com/manish-9245/WhyViral.git"
DIR="WhyViral"

if [ -d "$DIR" ]; then
  echo "$DIR already exists. cd into it and run 'npm install'."
  exit 0
fi

git clone "$REPO" "$DIR"
cd "$DIR"
npm install
if [ ! -f .env ]; then cp .env.example .env; fi

cat <<EOF

  ✓ WhyViral cloned to ./$DIR
  ✓ Dependencies installed
  ✓ .env created from .env.example

Next:
  1. Open .env and paste:
       APIFY_TOKEN     — from https://apify.com
       GEMINI_API_KEY  — from https://aistudio.google.com
  2. cd $DIR
  3. npm run all
  4. Open http://localhost:3000

Docs:    $REPO#quick-start
Issues:  $REPO/issues

EOF
