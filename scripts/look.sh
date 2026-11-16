#!/bin/bash
# TAKE A PHOTOGRAPH OF THE DEAL PAGE.
#
# 16 Nov 2026. Builds what is in the folder, starts it on 3100, opens a deal
# with the login scripts/portal-login.sh already stored, and saves two pictures
# into look/. Nothing is written to the database and nothing is pushed.
set -e
cd "$(dirname "$0")/.."
mkdir -p look
rm -f look/*.png

# PORTAL_TEST_DEAL_ID and nothing else. It lives in .env.local, which git
# ignores, exactly as scripts/check-browser.sh reads it.
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
if [ -z "${PORTAL_TEST_DEAL_ID:-}" ]; then
  echo "PORTAL_TEST_DEAL_ID is not set in .env.local - nothing to photograph."
  exit 1
fi
echo "Building..."
npm run build > /tmp/look-build.log 2>&1 || { tail -20 /tmp/look-build.log; exit 1; }
echo "Starting it on 3100..."
npx next start -p 3100 > /tmp/look-server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 8
echo "Taking the photographs..."
LOOK=1 npx playwright test tests/browser/zz-look.spec.ts --reporter=line --retries=0
echo
echo "Done. The pictures are in:"
ls -la look/
