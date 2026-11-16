#!/usr/bin/env bash
# NO SCREEN ASKS FOR THE WHOLE BOOK, WHOLE.
#
# 18 Nov 2026. Today took ten seconds to load. Not because there are a lot of
# deals - 280 - but because the page said select('*') and five JSON columns are
# 3,099 kB of the 3,575 kB that came back. Four facts were read out of them.
#
# A screen that lists deals names its columns, and the five big ones are fetched
# separately for the deals that can still be acted on. See
# lib/the-columns-a-screen-needs.ts.
#
# THIS IS A SPEED GUARD, not a correctness one, and it exists because speed
# rots quietly: nobody notices the day a select('*') goes back in, and six
# months later the morning screen takes fifteen seconds.

set -uo pipefail
cd "$(dirname "$0")/.."

# The list screens. A single deal by id may select whatever it likes - one row
# is one row, and the deal page genuinely reads the blobs.
watched="app/(app)/dashboard/page.tsx app/(app)/settlements/page.tsx app/(app)/lodgements/page.tsx"

bad=0
for f in $watched; do
  [ -f "$f" ] || continue
  if grep -nE "from\('deals'\)[[:space:]]*$|from\('deals'\)" "$f" >/dev/null 2>&1; then
    if grep -nE "\.select\('\*" "$f" >/dev/null 2>&1; then
      echo "DEAL WEIGHT: $f asks for every column of every deal."
      grep -nE "\.select\('\*" "$f" | head -3
      bad=1
    fi
  fi
done

if [ "$bad" = "1" ]; then
  echo ""
  echo "Name the columns instead - LIGHT_SELECT in lib/the-columns-a-screen-needs.ts,"
  echo "with the heavy five fetched for the deals that still need them."
  exit 1
fi

echo "No list screen asks for every column."
