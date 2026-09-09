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

PORTAL_TEST_URL="http://localhost:$PORT" npx playwright test > /tmp/ship-browser.log 2>&1
RESULT=$?

kill $SERVER 2>/dev/null || true

if [ $RESULT -ne 0 ]; then
  echo
  tail -40 /tmp/ship-browser.log
  exit 1
fi

echo "  $(grep -oE '[0-9]+ passed' /tmp/ship-browser.log | tail -1) in a real browser."
exit 0
