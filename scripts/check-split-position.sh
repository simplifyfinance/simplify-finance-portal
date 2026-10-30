#!/usr/bin/env bash
# A SPLIT'S JOB IS NOT ITS POSITION IN THE LIST.
#
# 30 Oct 2026. Fabio, after the fourth deal in two days came out wrong: "audit
# all other splits, these issues need to stop."
#
# Every one of them was the same habit - reading what a split IS from WHERE it
# sits. The New purchase panel edited splits[2] while the tagger looked for a
# label and left the purchase against no security. The headline on four
# purchase emails quoted splits[0] while the cards underneath printed two
# loans. The purchase LVR divided splits[0] by the price, which is the fault
# that told a construction client there was no LMI to think about. The equity
# release LVR called the first two splits "the refinance".
#
# THE PORTAL KNOWS WHAT EACH SPLIT IS. securityId says which house it is
# against, purpose says what the money does, and findPurchaseSplit() names the
# one that buys. Position is what you reach for when you have not asked.
#
# SO THIS IS A GREP, NOT A TEST, for the same reason check-lmi-carries.sh is:
# a test can be written around; a count cannot hide. Adding a splits[0]
# anywhere fails the ship and names the file. Taking one away is free - lower
# the number here and say why in the commit.
#
# THE ONES THAT ARE LEFT, AND WHY THEY ARE ALLOWED:
#
#   lib/bc-ready.ts            splitAmount / split2Amount - the readiness check
#                              names two fields a person fills in, and they are
#                              the first two boxes on the form by definition.
#   lib/deal-facts.ts          guarded by splits.length === 1.
#   lib/loan-id.ts             guarded by "no real splits".
#   BCForm.tsx                 bridging: the end debt is the second of two that
#                              the template seeds and the form draws.
#   generate-email/route.ts    bridging, family pledge and the LVR-comparison
#                              emails, where the template IS two loans in a
#                              fixed order and says so in its headings.
#
# None of those produces a wrong figure today. Every one of them is wrong the
# moment somebody adds or reorders a split, so if you are touching one, take
# the chance to ask the split what it is instead.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

# file=how many non-comment lines may mention a split by position
LOCKED=(
  "lib/bc-ready.ts=4"
  "lib/deal-facts.ts=1"
  "lib/loan-id.ts=2"
  "app/(app)/deals/[id]/BCForm.tsx=2"
  "app/api/generate-email/route.ts=20"
)

count_in() {
  grep -nE "splits(\?)?\.?\[[0-9]\]" "$1" 2>/dev/null \
    | grep -vE "^[0-9]+: *(//|\*|/\*)" | wc -l | tr -d ' '
}

for entry in "${LOCKED[@]}"; do
  f="${entry%=*}"
  want="${entry##*=}"
  [ -f "$f" ] || continue
  got=$(count_in "$f")
  if [ "$got" -gt "$want" ]; then
    echo "SPLIT POSITION CHECK FAILED - $f reads a split by position $got times, was $want."
    echo "  A split says what it is: securityId for the house, purpose for the money,"
    echo "  findPurchaseSplit() in lib/split-security-tag.ts for the one that buys."
    echo "  If it genuinely has to be positional, raise the number here and say why."
    grep -nE "splits(\?)?\.?\[[0-9]\]" "$f" | grep -vE "^[0-9]+: *(//|\*|/\*)" | sed 's/^/    /'
    fail=1
  elif [ "$got" -lt "$want" ]; then
    echo "  ($f is down to $got from $want - lower the number in scripts/check-split-position.sh)"
  fi
done

# AND ANY FILE NOT ON THE LIST AT ALL.
#
# The list above is the whole of what is allowed. A new file that reads a split
# by position is the next one of these, so it is refused on sight.
while IFS= read -r f; do
  case "$f" in
    *.test.ts|*.test.tsx) continue ;;
  esac
  listed=0
  for entry in "${LOCKED[@]}"; do
    [ "$f" = "${entry%=*}" ] && listed=1
  done
  [ "$listed" -eq 1 ] && continue
  got=$(count_in "$f")
  [ "$got" -eq 0 ] && continue
  echo "SPLIT POSITION CHECK FAILED - $f reads a split by position and is not on the list."
  grep -nE "splits(\?)?\.?\[[0-9]\]" "$f" | grep -vE "^[0-9]+: *(//|\*|/\*)" | sed 's/^/    /'
  fail=1
done < <(grep -rlE "splits(\?)?\.?\[[0-9]\]" --include=*.ts --include=*.tsx lib app components 2>/dev/null)

if [ "$fail" -eq 0 ]; then exit 0; fi
echo
echo "See lib/one-answer-to-which-split-buys-it.test.ts for what asking looks like."
exit 1
