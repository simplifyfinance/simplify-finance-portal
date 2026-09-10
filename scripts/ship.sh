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

# A GATE THAT PASSES BECAUSE IT IS BROKEN IS WORSE THAN NO GATE.
#
# 10 Sep 2026: a mis-quoted line inside check-record-loaders.sh made its search
# find nothing, so it reported success while checking absolutely nothing. Every
# gate is parsed before any of them is trusted.
for g in scripts/check-*.sh; do
  if ! bash -n "$g"; then
    echo "NOT SHIPPED - $g does not parse, so it cannot be trusted to check anything."
    exit 1
  fi
done

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

echo "Checking whole-record writes..."
if ! ./scripts/check-blob-writes.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# Wesley Perrott, 10 Sep 2026. A record written by one screen took another
# screen's tab down, and the first fix missed four of the five ways a record
# reaches a screen. See scripts/check-record-loaders.sh.
echo "Checking record loaders..."
if ! ./scripts/check-record-loaders.sh; then
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

# LAST, BECAUSE IT NEEDS THE BUILD.
#
# Everything above reads the code. This one opens it. Three faults reached the
# team in the week of 3-9 Sep that no code-level check could have seen - the page
# jumping, a ghost in a deal, and letters vanishing as Kylie typed - and every one
# of them would have been caught here in under a minute.
echo "Checking it in a browser..."
if ! ./scripts/check-browser.sh; then
  echo
  echo "NOT SHIPPED - the browser check failed. Something a person would see is broken."
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to commit."
  exit 0
fi

git add -A
git commit -m "$MSG"
git push origin main
echo
echo "PUSHED TO MAIN: $(git rev-parse --short HEAD)"
