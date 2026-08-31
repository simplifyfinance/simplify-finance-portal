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

echo "Checking email HTML..."
if ! ./scripts/check-email-html.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

echo "Checking database writes..."
if ! ./scripts/check-writes.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# The refinance figures go straight into a client's email. They were covered by
# tests from the start, but the runner was never installed, so for months the
# checks existed and never ran. They run here now, before anything is built.
echo "Checking the maths..."
if ! npx vitest run > /tmp/ship-test.log 2>&1; then
  echo
  echo "TESTS FAILED - nothing committed, nothing pushed."
  echo
  tail -30 /tmp/ship-test.log
  exit 1
fi
echo "Maths OK - $(grep -oE 'Tests +[0-9]+ passed' /tmp/ship-test.log | tail -1)."

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
