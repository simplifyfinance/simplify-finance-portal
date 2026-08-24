#!/usr/bin/env bash
# The only way changes reach production. Never hand-build a build-and-push chain
# again: piping npm run build into tail throws away its exit code, so a failed
# build looks like a success and gets pushed.
set -euo pipefail

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "usage: ./scripts/ship.sh \"commit message\""
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "REFUSING: on branch '$BRANCH', not main."
  exit 1
fi

echo "Checking broker keys..."
if ! ./scripts/check-broker-keys.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

echo "Building..."
if ! npm run build > /tmp/ship-build.log 2>&1; then
  echo
  echo "BUILD FAILED - nothing committed, nothing pushed."
  echo
  grep -B 6 -A 4 "Type error\|Failed to compile\|Failed to type check" /tmp/ship-build.log | head -40 \
    || tail -25 /tmp/ship-build.log
  exit 1
fi
echo "Build OK."

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to commit."
  exit 0
fi

git add -A
git commit -m "$MSG"
git push origin main
echo
echo "PUSHED TO MAIN: $(git rev-parse --short HEAD)"
