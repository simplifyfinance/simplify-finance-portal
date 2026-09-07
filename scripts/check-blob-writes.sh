#!/usr/bin/env bash
# Fails the ship if a whole-record column is written from anywhere but the two
# places that know how to do it safely.
#
# Some columns on a deal hold EVERYTHING for a tab in one lump - the fact find,
# the BC, the lending options, compliance, the document ticks, the handover
# ticks. Saving one field in any of them means writing the whole lump back, and
# whatever the writer built that lump from decides whose work survives. Built
# from the copy on screen, it silently deletes everything anybody else has done
# since the page opened.
#
# That has now happened four times:
#   the four deal tabs         two people, one deal - a lost afternoon, 4 Sep 2026
#   the deal structure block   one person, two tabs - compliance notes wiped
#   the documents box          two people down one document list
#   the handover page          two people picking up one handover
#
# Both safe writers read the record first, apply the change to what the database
# actually holds, and pin the write to the version they read so Postgres refuses
# it if anybody got in between:
#
#   lib/save-conflict.ts     for the four deal tabs, which also merges
#   lib/patch-deal-column.ts for changing one field inside one of these columns
#
# A write that genuinely does not need either may opt out with
#   whole-record write is safe here: <why>
# on the line or in the comment block above it. Writing the reason is the point.
set -uo pipefail
cd "$(dirname "$0")/.."

COLUMNS='bc_data|fact_find_data|lo_data|compliance_data|document_progress|handover_progress'

hits=$(grep -rn --include=*.ts --include=*.tsx \
        -E "\.(update|upsert)\(\{[^}]*($COLUMNS)[[:space:]]*:" \
        app lib components 2>/dev/null \
        | grep -v "^lib/save-conflict.ts:" \
        | grep -v "^lib/patch-deal-column.ts:" \
        | grep -v "\.test\.ts:" || true)

filtered=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  rest="${line#*:}"
  num="${rest%%:*}"
  if echo "$line" | grep -q "whole-record write is safe here:"; then continue; fi
  from=$(( num - 12 )); [ "$from" -lt 1 ] && from=1
  prev=$(( num - 1 ))
  if [ "$prev" -ge 1 ] && sed -n "${from},${prev}p" "$file" 2>/dev/null | grep -q "whole-record write is safe here:"; then continue; fi
  filtered="${filtered}${line}"$'\n'
done <<< "$hits"

if [ -n "${filtered// /}" ] && [ "$filtered" != $'\n' ]; then
  echo "WHOLE-RECORD WRITE CHECK FAILED."
  echo "These columns hold a whole tab in one lump, so writing one from a copy held"
  echo "on screen deletes everything anybody else has done since the page opened."
  echo "Use saveGuarded() from lib/save-conflict.ts for a deal tab, or"
  echo "patchDealColumn() from lib/patch-deal-column.ts to change one field - or"
  echo "mark it"
  echo "  whole-record write is safe here: <why>"
  echo "$filtered"
  exit 1
fi

exit 0
