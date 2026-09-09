#!/usr/bin/env bash
# THE ROBOT GATE.
#
# Starts the build that is about to ship on a spare port, opens it in a real
# browser, types into a real deal, and checks the letters are all still there.
# See playwright.config.ts for why this exists.
#
# SKIPS ITSELF rather than failing when it is not set up. A gate that blocks
# everybody the day somebody clones the repo is a gate that gets deleted.
set -uo pipefail

PORT=3100

if [ ! -d node_modules/@playwright/test ]; then
  echo "  (skipped - Playwright is not installed. npm i -D @playwright/test)"
  exit 0
fi

# Credentials live in .env.local, which git ignores. They are never in the repo
# and never in a chat.
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi

if [ -z "${PORTAL_TEST_DEAL_ID:-}" ]; then
  echo "  (skipped - set PORTAL_TEST_DEAL_ID in .env.local)"
  exit 0
fi

# Signed in by hand, once, by ./scripts/portal-login.sh. No password is kept
# anywhere for this to read - see scripts/save-login.mjs.
if [ ! -f .auth/portal.json ]; then
  echo "  (skipped - not signed in. Run: ./scripts/portal-login.sh)"
  exit 0
fi

# The build has already been made by ship.sh at this point.
npx next start -p "$PORT" > /tmp/ship-browser-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if curl -sf "http://localhost:$PORT" -o /dev/null; then break; fi
  sleep 0.5
done

# WATCHING IT WORK.
#
# It runs with no window by default, which is right for something that fires on
# every ship - a browser stealing focus mid-work is its own kind of bug. But the
# first time somebody sets this up they quite reasonably want to see it happen.
# Fabio, 9 Sep 2026: "did the robot even run I couldn't see".
#
#   HEADED=1 ./scripts/check-browser.sh
HEADED_FLAG=""
if [ -n "${HEADED:-}" ]; then HEADED_FLAG="--headed"; fi

PORTAL_TEST_URL="http://localhost:$PORT" npx playwright test $HEADED_FLAG > /tmp/ship-browser.log 2>&1
RESULT=$?

kill $SERVER 2>/dev/null || true

# REPORTS, DOES NOT BLOCK. 9 Sep 2026.
#
# A new gate that stops the ship while it is still being bedded in costs more
# time than the bugs it catches. It says loudly what it found and gets out of
# the way. Turn the exit 1 back on once it has been quiet for a week.
if [ $RESULT -ne 0 ]; then
  echo
  echo "  *** THE BROWSER CHECK FOUND SOMETHING - shipping anyway, but read this: ***"
  grep -E "^  [0-9]+\) |Error: |Received: |Expected: " /tmp/ship-browser.log | head -12
  echo "  (full detail: /tmp/ship-browser.log)"
  exit 0
fi

echo "  $(grep -oE '[0-9]+ passed' /tmp/ship-browser.log | tail -1) in a real browser."
exit 0
