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

# HOW LONG EACH STAGE ACTUALLY TAKES.
#
# Fabio, 16 Sep 2026: "the terminal still processing last command, taking longer
# these days." Neither of us knew whether that was the build or the 42 browser
# checks, so we were both guessing at which one to speed up. Now it says.
#
# SECONDS is a bash builtin holding the seconds since the shell started, so this
# costs nothing and cannot fail.
SHIP_START=$SECONDS
LAST=$SECONDS
took() {
  local s=$((SECONDS - LAST))
  LAST=$SECONDS
  if [ $# -gt 0 ]; then
    printf '%s (%dm %02ds)\n' "$1" $((s / 60)) $((s % 60))
  else
    printf ' (%dm %02ds)\n' $((s / 60)) $((s % 60))
  fi
}

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

# EVERY "MY WORK DISAPPEARED" THIS WEEK CAME BACK TO A BOX THAT SAVED ITSELF
# AROUND THE PROTECTED PATH. The internal notes box destroying a note on one
# keystroke; LO, BC and Compliance throwing away the last few seconds on a tab
# change. Both were found by somebody losing work. This finds the next one first.
echo "Checking nothing typed is saved around the guard..."
if ! ./scripts/check-typed-fields.sh; then
  echo
  echo "NOT SHIPPED - a box would save somebody's typing without the protection."
  exit 1
fi

# The refinance figures go straight into a client's email. They were covered by
# tests from the start, but the runner was never installed, so for months the
# checks existed and never ran. They run here now, before anything is built.
took "Code checks OK."
echo "Checking the maths..."
if ! npx vitest run > /tmp/ship-test.log 2>&1; then
  echo
  echo "TESTS FAILED - nothing committed, nothing pushed."
  echo
  tail -30 /tmp/ship-test.log
  exit 1
fi
printf 'Maths OK - %s.' "$(grep -oE 'Tests +[0-9]+ passed' /tmp/ship-test.log | tail -1)"
took

echo "Building..."
if ! npm run build > /tmp/ship-build.log 2>&1; then
  echo
  echo "BUILD FAILED - nothing committed, nothing pushed."
  echo
  grep -B 6 -A 4 "Type error\|Failed to compile\|Failed to type check" /tmp/ship-build.log | head -40 \
    || tail -25 /tmp/ship-build.log
  exit 1
fi
printf 'Build OK.'
took

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
printf 'Browser OK.'
took

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to commit."
  exit 0
fi

git add -A
git commit -m "$MSG"
git push origin main
echo
echo "PUSHED TO MAIN: $(git rev-parse --short HEAD)"
TOTAL=$((SECONDS - SHIP_START))
printf 'Whole run: %dm %02ds\n' $((TOTAL / 60)) $((TOTAL % 60))
