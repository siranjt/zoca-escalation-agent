#!/usr/bin/env bash
# One-shot deploy script for zoca-escalation-agent.
# - Copies the project to ~/code/zoca-escalation-agent (excludes any partial node_modules)
# - Installs deps fresh
# - Initializes git, makes the first commit
# - Creates the GitHub repo via `gh` and pushes
# - Opens Vercel new-project page in your browser
#
# Requirements: node + npm + git + gh (logged in)

set -euo pipefail

SRC="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEST="$HOME/code/zoca-escalation-agent"

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }

cyan "==> Project source:    $SRC"
cyan "==> Project dest:      $DEST"

# 0. Sanity checks
for bin in node npm git gh; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    red "Missing required tool: $bin"
    if [ "$bin" = "gh" ]; then
      yellow "Install with: brew install gh   (then: gh auth login)"
    fi
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  red "GitHub CLI is installed but not logged in."
  yellow "Run:  gh auth login"
  exit 1
fi

# 1. Copy
cyan "==> Copying project (excluding node_modules / .next / .vercel)..."
mkdir -p "$DEST"
# rsync: --delete keeps DEST tidy if you re-run; --exclude skips trash
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.vercel' \
  --exclude='.env' \
  --exclude='.env.local' \
  "$SRC/" "$DEST/"

cd "$DEST"

# 2. Install
cyan "==> Installing dependencies (this is the slow part)..."
npm install --no-audit --no-fund

# 3. Git
if [ ! -d .git ]; then
  cyan "==> git init"
  git init -b main >/dev/null
fi

# Configure user.name/email if not set globally
if ! git config user.name >/dev/null 2>&1; then
  git config user.name "$(gh api user --jq .name 2>/dev/null || echo 'Zoca')"
fi
if ! git config user.email >/dev/null 2>&1; then
  git config user.email "$(gh api user --jq .email 2>/dev/null || echo 'noreply@zoca.com')"
fi

git add .
if git diff --cached --quiet; then
  yellow "==> Nothing new to commit."
else
  git commit -m "Initial commit: Zoca escalation agent" >/dev/null
fi

# 4. GitHub
if git remote get-url origin >/dev/null 2>&1; then
  cyan "==> Remote 'origin' already exists; pushing..."
  git push -u origin main
else
  cyan "==> Creating GitHub repo via gh and pushing..."
  gh repo create zoca-escalation-agent --public --source=. --remote=origin --push
fi

REPO_URL="$(gh repo view --json url --jq .url 2>/dev/null || echo '')"
green ""
green "==> GitHub:  ${REPO_URL:-(check 'gh repo view')}"
green ""

# 5. Open Vercel new-project import page
yellow "==> Opening Vercel new-project page in your browser..."
yellow "    Use the env vars below when prompted:"
cat <<EOF
   ANTHROPIC_API_KEY     = (your Anthropic key)
   CHARGEBEE_API_KEY     = live_K26QwUdeX37fHKmMe1pkobqGOZ9jGHWF
   CHARGEBEE_SITE        = zoca
   METABASE_BASE_URL     = https://metabase.zoca.ai
   WEBHOOK_SHARED_SECRET = (optional — make one up if you'll wire webhooks later)
EOF
sleep 1
open "https://vercel.com/new" || true

green "==> Done. Finish the import in your browser, click Deploy."
