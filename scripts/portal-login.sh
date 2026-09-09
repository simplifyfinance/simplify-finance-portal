#!/usr/bin/env bash
# Sign the robot in, by hand, once. See scripts/save-login.mjs.
set -euo pipefail
PORT=3100

if [ ! -d node_modules/@playwright/test ]; then
  echo "Playwright is not installed. Run: npm i -D @playwright/test"
  exit 1
fi

echo "Starting the portal on http://localhost:$PORT ..."
npx next dev -p "$PORT" > /tmp/portal-login-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$PORT" -o /dev/null; then break; fi
  sleep 1
done

PORTAL_TEST_URL="http://localhost:$PORT" node scripts/save-login.mjs
