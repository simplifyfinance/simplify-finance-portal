#!/usr/bin/env bash
# Fails the ship if broker identity is compared raw, or if the frozen
# settings.brokers list is read again. Both have caused live breakage.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

raw=$(grep -rn "assigned_broker ===\|broker_key ===\|broker_slug ===\|\.eq('broker_slug'\|\.eq('assigned_broker'" \
      --include=*.ts --include=*.tsx app lib components 2>/dev/null \
      | grep -v "lib/broker-key.ts" || true)
if [ -n "$raw" ]; then
  echo "BROKER KEY CHECK FAILED - broker identity compared raw."
  echo "Use sameBroker()/brokerKey() from lib/broker-key.ts, or .ilike() for a query."
  echo "$raw"
  fail=1
fi

# A lowercased comparison looks careful and is not: brokerKey() takes the FIRST
# WORD and strips punctuation, so "Fabio De Castro".toLowerCase() never equals
# "fabio". Two of these sat on the dashboard and this check walked straight past
# them, because it only looked for a bare ===.
lower=$(grep -rnE "(assigned_broker|broker_key|broker_slug)[^=]*\.toLowerCase\(\)[[:space:]]*===" \
        --include=*.ts --include=*.tsx app lib components 2>/dev/null \
        | grep -v "lib/broker-key.ts" || true)
if [ -n "$lower" ]; then
  echo
  echo "BROKER KEY CHECK FAILED - broker identity compared by lower-casing it."
  echo "brokerKey() takes the first word; a full name will never match a key this way."
  echo "Use sameBroker() from lib/broker-key.ts."
  echo "$lower"
  fail=1
fi

frozen=$(grep -rn "select('brokers')" --include=*.ts --include=*.tsx app lib components 2>/dev/null \
         | grep -v "lib/broker-profile.ts" || true)
if [ -n "$frozen" ]; then
  echo
  echo "BROKER KEY CHECK FAILED - reading settings.brokers, which is frozen."
  echo "Brokers live in public.brokers. Only lib/broker-profile.ts may read the old list, as a fallback."
  echo "$frozen"
  fail=1
fi

# The key is the join, not a label. Printing it straight into JSX is how every
# screen came to say "fabio" and "kylie". Use the register: useBrokerNames() in a
# client component, or brokerLabel() where only a tidied key is possible.
# A screen that deliberately shows the key itself marks the line "shows-the-key:".
raw_shown=$(grep -rnE "(^|[^=$])\{[A-Za-z_$][A-Za-z0-9_.$?]*\.(assigned_broker|broker_key)\}" \
        --include=*.tsx app components 2>/dev/null || true)

# The marker usually reads better on the line above, so look back a little.
shown=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  f="${line%%:*}"; r="${line#*:}"; n="${r%%:*}"
  if echo "$line" | grep -q "shows-the-key:"; then continue; fi
  from=$(( n - 3 )); [ "$from" -lt 1 ] && from=1
  prev=$(( n - 1 ))
  if [ "$prev" -ge 1 ] && sed -n "${from},${prev}p" "$f" 2>/dev/null | grep -q "shows-the-key:"; then continue; fi
  shown="${shown}${line}"$'\n'
done <<< "$raw_shown"

if [ -n "${shown// /}" ] && [ "$shown" != $'\n' ]; then
  echo
  echo "BROKER KEY CHECK FAILED - a broker key is being rendered to the screen."
  echo "It is lower case by design. Show the name from the register instead."
  echo "$shown"
  fail=1
fi

lender=$(grep -rn "\.eq('lender'," --include=*.ts --include=*.tsx app lib components 2>/dev/null || true)
if [ -n "$lender" ]; then
  echo
  echo "IDENTITY CHECK FAILED - matching a lender by its typed name."
  echo "Deals carry lender_id and commission_rates carry lender_id. Join on the id."
  echo "$lender"
  fail=1
fi

exit $fail
