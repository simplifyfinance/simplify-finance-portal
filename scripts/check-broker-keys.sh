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

frozen=$(grep -rn "select('brokers')" --include=*.ts --include=*.tsx app lib components 2>/dev/null \
         | grep -v "lib/broker-profile.ts" || true)
if [ -n "$frozen" ]; then
  echo
  echo "BROKER KEY CHECK FAILED - reading settings.brokers, which is frozen."
  echo "Brokers live in public.brokers. Only lib/broker-profile.ts may read the old list, as a fallback."
  echo "$frozen"
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
