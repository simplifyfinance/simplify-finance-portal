#!/usr/bin/env bash
# THE TWO-DAY SWEEP.
#
# 16 Oct 2026. Fabio, after a day in which several of my own fixes caused the
# next problem: "every 2 days I want you to do an audit on the system."
#
# WHY A SCRIPT AND NOT A HABIT. The audit that found the most was the one I ran
# once, at lunchtime, over the whole area rather than over what I had just
# changed. It found six faults. I did not run it again after the changes that
# followed, and four of those changes caused the next complaint. A habit I
# remember is not a control. This is the same sweep every time, and the
# scheduled task runs it whether anybody remembers or not.
#
# IT REPORTS, IT NEVER BLOCKS. Every line here can be legitimate in the right
# place. A gate on any of them would be wrong, and a gate somebody routinely
# overrides is worse than no gate. ship.sh does not call this.
#
# Each check is one question that cost a real bug on 15-16 Oct 2026.
set -uo pipefail
cd "$(dirname "$0")/.."

found=0
section () { printf '\n\033[1m%s\033[0m\n' "$1"; }
hit ()     { found=$((found+1)); printf '  %s\n' "$1"; }
clean ()   { printf '  nothing\n'; }

printf '\033[1mPORTAL AUDIT  %s\033[0m\n' "$(date '+%a %d %b %Y, %H:%M')"
printf 'last commit: %s\n' "$(git log --oneline -1 2>/dev/null)"

# 1 --------------------------------------------------------------------------
# money(0) is "$0" and "$0" is truthy, so a zero prints as a figure. This went
# to a client as "Equity released $0" on a refinance releasing nothing.
section '1. A zero printed as a figure  (money() inside rowIf/lineIf)'
out=$(grep -rn "rowIf([^)]*, *money(\|lineIf([^)]*, *money(" app/api/*/route.ts lib/*.ts 2>/dev/null \
      | grep -v '\.test\.' | grep -v ':[0-9]*: *//' || true)
if [ -n "$out" ]; then while IFS= read -r l; do hit "$l"; done <<< "$out"; else clean; fi

# 2 --------------------------------------------------------------------------
# "our typed repayments take over never calculate repayments" (16 Sep) and
# "only IO repayments are to be calculated" (16 Oct). monthlyRepaymentPI is
# legitimate in exactly one place: repaymentMismatch, which warns and never
# writes.
section '2. A P&I repayment worked out anywhere  (should be lib/split-cards.ts only, once)'
out=$(grep -rn "monthlyRepaymentPI(" lib/*.ts app/ --include=*.ts --include=*.tsx 2>/dev/null \
      | grep -v '\.test\.' | grep -v 'lib/refinance-calculations.ts' || true)
n=$(printf '%s' "$out" | grep -c . || true)
if [ "$n" -gt 1 ]; then while IFS= read -r l; do hit "$l"; done <<< "$out"; else clean; fi

# 3 --------------------------------------------------------------------------
# Three gates asked "is this complex refinance" where the question was "can
# this have several securities". That is how the lending options listed every
# split twice.
section '3. Two questions where there should be one  (isComplexRefinance as a gate on a screen)'
# A LABEL CHOSEN BY TEMPLATE IS FINE - "Original purpose of funds" versus
# "What the funds were used for" is a wording question, not a layout gate. What
# this looks for is a BLOCK turned on and off, which is what listed every split
# twice on the lending options.
out=$(grep -rn "isComplexRefinance(" "app/(app)" components --include=*.tsx 2>/dev/null \
      | grep -v ':[0-9]*: *//' | grep -v 'isDebtRecycling' | grep -v '? *"' || true)
if [ -n "$out" ]; then while IFS= read -r l; do hit "$l"; done <<< "$out"; else clean; fi

# 4 --------------------------------------------------------------------------
# These four boxes moved onto the securities. Anything still reading them on a
# multi-security deal is reading one house's figure and calling it the deal's.
section '4. Deal-level boxes that moved onto the securities  (eyes needed, not all are wrong)'
out=$(grep -rn "d\.existingLoanBal\|bc\.existingLoanBal\|d\.equityRelease\|bc\.equityRelease\|d\.propertyValue\|bc\.propertyValue" \
      app/api/*/route.ts 2>/dev/null | grep -v '\.test\.' || true)
n=$(printf '%s' "$out" | grep -c . || true)
printf '  %s reads across the email routes\n' "${n:-0}"
printf '  (each is fine on a single-security deal - the question is what it prints on two)\n'

# 5 --------------------------------------------------------------------------
# A test that greps the route source passes while the rendered email is wrong.
# That is how "Equity released $0" and the wrong suburb both shipped.
section '5. Email templates with no render-based test behind them'
branches=$(grep -o "template === '[a-z_]*'" app/api/generate-email/route.ts | sed "s/.*'\(.*\)'/\1/" | sort -u)
covered=$(grep -rl "from '../app/api/generate-email/route'" lib/*.test.ts 2>/dev/null | xargs cat 2>/dev/null || true)
for b in $branches; do
  if ! printf '%s' "$covered" | grep -q "$b"; then hit "$b  - no test renders this template's HTML"; fi
done
[ -z "$branches" ] && clean

# 6 --------------------------------------------------------------------------
# Total lending over one property's value. Six of these on 16 Oct, including a
# commission band picked off an LVR of 265%.
# row.propertyValue is the deal row's figure, which counts every security since
# 16 Oct. bc-ready lists the boxes an email wants, not an LVR.
section '6. An LVR measured against a single property value'
out=$(grep -rn "lvr\|LVR" lib/*.ts "app/(app)" app/api components --include=*.ts --include=*.tsx 2>/dev/null \
      | grep -v '\.test\.' | grep -v ':[0-9]*: *//' \
      | grep "propertyValue\|purchasePrice" \
      | grep -v "securitiesWithPurchase\|totalsOf\|positionsOf" \
      | grep -v "row\.propertyValue" \
      | grep -v "lib/bc-ready.ts" \
      | awk 'length($0) < 220' || true)
if [ -n "$out" ]; then while IFS= read -r l; do hit "$l"; done <<< "$out"; else clean; fi

# 7 --------------------------------------------------------------------------
# new Date('rubbish') is an Invalid Date. It passes `instanceof Date` and then
# toISOString() THROWS. On 18 Oct 2026 one unreadable settlement-date cell
# refused an entire SFG commission statement with the words "Invalid time
# value" and nothing else. Three other importers had the same line.
section '7. An Invalid Date read as a date  (instanceof Date, then toISOString)'
# Comments explaining the fault are not the fault. Both grep's own separators
# are stripped: file:NN: for a match, file-NN- for a context line.
out=$(grep -rn -A2 "instanceof Date" lib app components --include=*.ts --include=*.tsx 2>/dev/null \
      | grep -v '\.test\.' | grep "toISOString" | grep -v "isNaN" \
      | grep -vE '^[^:]+[:-][0-9]+[:-][[:space:]]*(//|\*)' || true)
if [ -n "$out" ]; then while IFS= read -r l; do hit "$l"; done <<< "$out"; else clean; fi

# 8 --------------------------------------------------------------------------
# A scenario in the picker that the knowledge base has never heard of is a
# template somebody will reach for with no idea what it does. 21 Oct 2026 -
# Fabio asked for one automatic check and this is the only one narrow enough to
# be right every time: five new templates in thirty days, and it would have
# caught all five. It reports; the page is written when he says so, not by a
# script watching commits.
section '8. Scenarios the knowledge base has never mentioned'
out=$(python3 -I - <<'PY2' || true
import re
src = open('lib/templates.ts').read()
labels = re.findall(r"^  ([a-z_]+):\s+'([^']+)'", src, re.M)
kb = open('lib/knowledge-base.ts').read()
# The backlog named in WRITTEN_UP_LATER is a decision somebody made, not a gap.
baseline = kb[kb.index('WRITTEN_UP_LATER'):]
baseline = baseline[:baseline.index(']')].lower()
hay = kb.lower()
for key, label in labels:
    if key == 'custom':
        continue
    plain = label.encode().decode('unicode_escape').lower()
    if plain in baseline or label.lower() in baseline:
        continue
    if plain in hay or label.lower() in hay:
        continue
    print(f'{plain}  ({key})')
PY2
)
if [ -n "$out" ]; then while IFS= read -r l; do hit "$l"; done <<< "$out"; else clean; fi

# 9 --------------------------------------------------------------------------
section '9. The suite itself'
printf '  test files: %s\n' "$(ls lib/*.test.ts | wc -l | tr -d ' ')"
printf '  render-based email tests: %s\n' "$(grep -rl "from '../app/api/generate-email/route'" lib/*.test.ts 2>/dev/null | wc -l | tr -d ' ')"

printf '\n\033[1m%s things to look at.\033[0m\n' "$found"
printf 'Nothing here is automatically a bug. Each one is a question worth asking.\n'
date '+%Y-%m-%d' > docs/last-audit.txt
printf 'Recorded in docs/last-audit.txt\n'
