#!/usr/bin/env bash
# A CAPITALISED PREMIUM IS PART OF THE LOAN, EVERYWHERE THE WORD "LOAN" APPEARS.
#
# 27 Oct 2026. Fabio, on a client email showing a $912,000 loan in one box and
# a $886,000 loan in the box underneath it: "This HAS BEEN ADDRESSED
# muuuuultiple times". He was right, and here is why it kept coming back.
#
# The rule was set on 24 Sep 2026, in his words, written into lib/build-card.ts
# that day: "when the premium is capitalised there is ONE loan line and it is
# the one they borrow. The base figure is an internal working and does not
# belong in a client's inbox."
#
# It was then applied in TWO places and missed in FOUR:
#
#   applied   the purchase breakdown
#   applied   the split card, but ONLY on templates with no purchase breakdown
#   missed    the split card on every other template
#   missed    the whole of the lending options - nothing there knew about LMI
#   missed    compliance box one, which says in words what somebody is borrowing
#   missed    compliance box four, the same sentence again
#
# And the test written at the time passed throughout, because it checked that
# the function COULD add the premium rather than that anything DID. One of its
# cases - "without the deal passed in it reads exactly as it did before" -
# asserted the bug as correct behaviour and locked it in for five weeks.
#
# So this is a grep, not a test. A test can be written around; a missing call
# cannot hide from a list of the places that must make it.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

# A whole-line comment is not a breach of the rule it describes - the same note
# as scripts/check-email-html.sh and scripts/check-broker-keys.sh.
NOT_A_COMMENT='[0-9]+:[[:space:]]*(//|#|\*)'

# ---------------------------------------------------------------------------
# 1. EVERY FILE THAT STATES A LOAN TO A CLIENT ASKS lib/lmi.ts ABOUT IT.
# ---------------------------------------------------------------------------
#
# Named one by one, because the failure here is always a file that forgot, and
# a file nobody listed cannot forget visibly. Adding a new email means adding
# it here, which is the point.
MUST_ASK=(
  "app/api/generate-email/route.ts"
  "app/api/generate-lo-email/route.ts"
  "lib/build-card.ts"
  "lib/purchase-rows.ts"
  "lib/box-one.ts"
  "lib/box-four.ts"
)

for f in "${MUST_ASK[@]}"; do
  [ -f "$f" ] || continue
  if ! grep -qE "clientLoan\(|totalLoan\(|drawnLoan\(|totalLendingLine\(" "$f"; then
    echo "LMI CHECK FAILED - $f states a loan and never asks whether the premium is in it."
    echo "  Use clientLoan() or drawnLoan() from lib/lmi.ts."
    fail=1
  fi
done

# ---------------------------------------------------------------------------
# 2. THE SPLIT CARD IS NEVER GATED BACK BEHIND A TEMPLATE FLAG.
# ---------------------------------------------------------------------------
#
# This is the exact line that caused it. `lmiOnTheSplit` was true on one
# template out of six, so five drew a split card reading the base loan directly
# under a purchase box reading the loan with the premium in it.
# A TEST ASSERTING A RULE IS NOT A BREACH OF IT, and neither is a comment.
#
# 27 Oct 2026, the fourth guard this has caught out in one day - see the same
# note in check-email-html.sh and check-broker-keys.sh. The two test files that
# hold this rule in place have to NAME the broken line in order to assert it is
# gone, and this check read the name and refused the ship.
gated=$(grep -rn "lmiOnTheSplit && splits.length" --include=*.ts app lib 2>/dev/null \
        | grep -v "\.test\." | grep -vE "$NOT_A_COMMENT" || true)
if [ -n "$gated" ]; then
  echo
  echo "LMI CHECK FAILED - the split card's premium is behind a template flag again."
  echo "One split carries it, whatever the template. Two or more and nothing does."
  echo "$gated"
  fail=1
fi

# ---------------------------------------------------------------------------
# 3. COMPLIANCE SAYS THE LOAN THEY SIGN FOR.
# ---------------------------------------------------------------------------
#
# Boxes one and four both open with "X is borrowing <amount>". That sentence
# goes on the compliance file, so the amount in it has to be the contract.
for f in lib/box-one.ts lib/box-four.ts; do
  [ -f "$f" ] || continue
  if grep -nE "const amount = loanAmount\(deal\)" "$f" | grep -vE "$NOT_A_COMMENT" > /dev/null; then
    echo
    echo "LMI CHECK FAILED - $f states the base loan, not the loan they sign for."
    echo "Use drawnLoan(deal, loanAmount(deal)) from lib/lmi.ts."
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then exit 0; fi
echo
echo "See lib/the-premium-is-in-the-loan.test.ts, which builds the real emails"
echo "and reads the figures back off them."
exit 1
