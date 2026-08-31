#!/usr/bin/env bash
# Fails the ship if a database write is fired and never checked.
#
# CLAUDE.md calls this the single most repeated failure here, and it has now
# happened five times. Postgres returns zero rows and NO error when a policy
# blocks a write, so `.then(() => {})` and `.catch(() => {})` do not merely skip
# error handling - they hide a total failure while the screen says it worked.
# The most recent one lost lo_sent_at on every Lending Options email, leaving
# deals stuck on "Waiting on: Broker to review and send" after they had been sent.
#
# A write that genuinely does not matter may opt out by putting
#   fire-and-forget: <why>
# on the line or the line above. Writing the reason is the point.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

hits=$(grep -rn --include=*.ts --include=*.tsx \
        -E "\.(update|insert|upsert|delete)\(.*\.(then|catch)\(\(\) *=> *\{\}\)" \
        app lib components 2>/dev/null || true)

# Allow a line that says why, or whose preceding line does.
filtered=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  rest="${line#*:}"
  num="${rest%%:*}"
  prev=$((num - 1))
  if echo "$line" | grep -q "fire-and-forget:"; then continue; fi
  # The reason usually needs a sentence or two, so look back over a short comment
  # block rather than a single line.
  from=$(( num - 4 )); [ "$from" -lt 1 ] && from=1
  if [ "$prev" -ge 1 ] && sed -n "${from},${prev}p" "$file" 2>/dev/null | grep -q "fire-and-forget:"; then continue; fi
  filtered="${filtered}${line}"$'\n'
done <<< "$hits"

if [ -n "${filtered// /}" ] && [ "$filtered" != $'\n' ]; then
  echo "WRITE CHECK FAILED - a database write is not checked."
  echo "Postgres returns zero rows and no error when a policy blocks a write, so"
  echo "this can fail completely while the screen reports success."
  echo "Await it, .select() it, and check rows.length - or mark it"
  echo "  fire-and-forget: <why it does not matter>"
  echo "$filtered"
  fail=1
fi

exit $fail
