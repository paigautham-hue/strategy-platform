#!/usr/bin/env bash
# sync-to-github.sh
# Syncs the current Manus project state to paigautham-hue/strategy-platform on GitHub.
# Uses a PAT with `workflows` scope so .github/workflows/ci.yml is included.
#
# Usage:
#   bash scripts/sync-to-github.sh
#
# Run this after every webdev_save_checkpoint to keep GitHub in sync.

set -euo pipefail

# Set GITHUB_TOKEN env var before running:
#   export GITHUB_TOKEN=<your-pat>
: "${GITHUB_TOKEN:?GITHUB_TOKEN must be set}"

REPO="https://${GITHUB_TOKEN}@github.com/paigautham-hue/strategy-platform.git"
BRANCH="main"

echo "==> Ensuring 'github' remote exists..."
if ! git remote get-url github &>/dev/null; then
  git remote add github "$REPO"
  echo "    Added remote."
else
  git remote set-url github "$REPO"
  echo "    Remote URL updated."
fi

echo "==> Fetching from GitHub..."
git fetch github --quiet

echo "==> Creating sync branch from GitHub HEAD..."
SYNC_BRANCH="sync-$(date +%Y%m%d-%H%M%S)"
GITHUB_HEAD=$(git rev-parse github/main 2>/dev/null || echo "")

if [ -z "$GITHUB_HEAD" ]; then
  git checkout -b "$SYNC_BRANCH"
else
  git checkout -b "$SYNC_BRANCH" "$GITHUB_HEAD"
fi

# Overlay all files from Manus main (including workflow files — PAT has workflows scope)
git checkout main -- .

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit — GitHub is already up to date."
else
  git commit -m "chore: sync from Manus checkpoint $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

echo "==> Pushing to GitHub $BRANCH..."
git push github "$SYNC_BRANCH:$BRANCH" --force

echo "==> Cleaning up sync branch..."
git checkout main
git branch -D "$SYNC_BRANCH"

echo ""
echo "✅  GitHub sync complete: https://github.com/paigautham-hue/strategy-platform"
