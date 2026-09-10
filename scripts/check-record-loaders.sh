#!/usr/bin/env bash
# A SAVED RECORD IS NEVER PUT ON A SCREEN UNSHAPED.
#
# 10 Sep 2026. Melissa could not open the compliance tab on Wesley Perrott -
# "This page couldn't load", every other tab fine. His compliance_data was
# {preApproval, securityAddress} and nothing else, because the deal structure
# block (48cacc1, 3 Sep) writes into a column the compliance tab owns and nobody
# had ever opened that tab on him. The render read d.applicants[0] off undefined.
#
# THE FIRST FIX WAS NOT ENOUGH, AND THAT IS THE POINT OF THIS FILE.
#
# c5fc20f guarded the record the page opens with, shipped, and the crash did not
# move - because a deal form takes a record from the database in FIVE places, not
# one:
#
#   1. the record the page was rendered with          (was guarded)
#   2. the re-read on mount, in case somebody saved   (WAS NOT - this was Wesley)
#   3. onAdopt, when nothing is typed yet and somebody else has saved
#   4. onMerge, when somebody else's fields are folded in mid-typing
#   5. useLiveColumn, when somebody else saves while the tab is open
#
# Each one hands a raw JSON column to setD. Any of them can be a record written
# by a different screen, with the sections this screen renders simply absent.
#
# So every form has ONE door - shape() on Compliance and Fact Find, putOnScreen()
# on Lending options - and this refuses to ship if anything walks past it.
#
# Fabio, 10 Sep 2026: "do whatever you need to do now, I cannot have this happen
# again."
set -uo pipefail

fail=0
D='app/(app)/deals/[id]'

say() { echo "  $1"; }

# ---------------------------------------------------------------- 1. the doors
# THE RULE IS ABOUT WHERE A VALUE CAME FROM, NOT HOW IT IS SPELLED.
#
# The first version of this check grepped for the bug's exact wording and was
# fooled the moment the wording changed - I put the bug back to test it and the
# check passed. A record's danger is its PROVENANCE: it came out of the database
# and may have been written by a different screen. There are exactly five places
# that happens, they are all named, and each one must hand it to the form's door.
FORMS="$D/ComplianceForm.tsx $D/FactFindForm.tsx $D/LOForm.tsx $D/BCForm.tsx"
SAFE="shape\(|putOnScreen\(|applyBcData"

# 1-3. The three callbacks that receive a stored record.
for key in "apply:" "onAdopt:" "onMerge:"; do
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    say "$hit"
    say "    ^ this receives a record from the database and does not send it through the door."
    fail=1
  done < <(grep -nE "^ *($key|.*, *$key)" $FORMS 2>/dev/null \
           | grep -E "setD|apply:" \
           | grep -vE "$SAFE" \
           | grep -vE "^[^:]*:[0-9]+: *(//|\*)")
done

# 4. The re-read on mount. The door has to appear inside the .then that follows.
for col in fact_find_data bc_data lo_data compliance_data; do
  while IFS= read -r loc; do
    [ -z "$loc" ] && continue
    file="${loc%%:*}"; rest="${loc#*:}"; line="${rest%%:*}"
    # Comments stripped first. A comment inside the block that MENTIONS the door
    # is not the block using it - that is exactly how this check let the Wesley
    # line through the first time it was tested.
    block=$(sed -n "${line},$((line + 10))p" "$file" | grep -vE "^ *(//|\*|/\*)")
    if ! echo "$block" | grep -qE "$SAFE"; then
      say "$file:$line re-reads $col and puts it on screen without the door."
      fail=1
    fi
  done < <(grep -nE "select\('$col'\)" $FORMS 2>/dev/null)
done

# 5. The record the page was rendered with.
for pair in "ComplianceForm.tsx:compliance_data" "FactFindForm.tsx:fact_find_data"; do
  f="$D/${pair%%:*}"; col="${pair##*:}"
  if [ -f "$f" ] && ! grep -qE "initData *(=|:).*shape\(deal\??\.$col\)" "$f"; then
    say "$f no longer opens with shape(deal.$col)."
    fail=1
  fi
done

# ------------------------------------------------------- 2. the door must exist
# A form that has stopped shaping at all is the same bug with no grep signature.
for pair in "ComplianceForm.tsx:shape" "FactFindForm.tsx:shape" "LOForm.tsx:putOnScreen"; do
  f="$D/${pair%%:*}"; fn="${pair##*:}"
  if [ -f "$f" ] && ! grep -q "$fn(" "$f"; then
    say "$f no longer has $fn() - the one place a stored record is made safe."
    fail=1
  fi
done

# And shape() must be built on the guard, not on hope.
for f in "$D/ComplianceForm.tsx" "$D/FactFindForm.tsx"; do
  if [ -f "$f" ] && ! grep -q "withDefaults" "$f"; then
    say "$f no longer uses withDefaults() - see lib/record-defaults.ts."
    fail=1
  fi
done

# ------------------------------------------- 3. nothing returns a column as-is
for col in fact_find_data bc_data lo_data compliance_data; do
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if grep -nE "return +deal\??\.$col( as [A-Za-z]+)? *$" "$file" > /dev/null 2>&1; then
      say "$file returns $col straight from the database."
      fail=1
    fi
  done < <(grep -rl "deal\.\?*$col" "$D" components 2>/dev/null | grep -E '\.tsx$' | grep -v _to_delete)
done

# ------------------------------------------- 6. no reaching into a stored list
# THE FALL, NOT JUST THE DOOR.
#
# Everything above stops a bad record getting to a screen. This stops a bad
# record KILLING one. A tab that renders one applicant at a time reaches into
# the list by position, and on an empty list the next line reads a name off
# nothing - which is a white screen for what is really a missing answer.
#
# So a list that came out of a JSON column is never indexed bare. Use ?.[i] and
# render an empty state; components/NoApplicants.tsx is the one the Compliance
# and Fact Find tabs use. This applies to forms that do not exist yet, which is
# the point - the loader rules above only know about the four that exist today.
#
# Written in python rather than grep because it has to ignore a TRAILING comment
# and the inside of a comment block, and the grep version that tried to do that
# was mis-quoted, found nothing, and reported success. A gate that passes
# because it is broken is worse than no gate. See the bash -n check in ship.sh.
INDEX_HITS=$(python3 - <<'PYEOF'
import os, re

LISTS = "applicants|lenders|splits|assets|properties|liabilities|refinanceSplits"
# (?<!\.) so the last dot of a `...spread` is not read as a property access:
# `{ ...splits[i] }` is a local array being copied, not a stored list.
BARE  = re.compile(r"(?<!\.)\.(" + LISTS + r")\[")
hits, inblock = [], False

def code_only(line):
    """The line with its comments removed. `//` inside a URL is not a comment."""
    out, i = [], 0
    while i < len(line):
        if line[i:i+2] == "//" and not (i and line[i-1] == ":"):
            break
        out.append(line[i]); i += 1
    return "".join(out)

for root in ("app", "components"):
    for base, _, files in os.walk(root):
        if "_to_delete" in base or "node_modules" in base:
            continue
        for name in files:
            if not name.endswith(".tsx"):
                continue
            path = os.path.join(base, name)
            inblock = False
            for n, raw in enumerate(io_open(path), 1) if False else enumerate(open(path, encoding="utf8"), 1):
                line = raw.rstrip("\n")
                if inblock:
                    if "*/" in line:
                        inblock = False
                        line = line.split("*/", 1)[1]
                    else:
                        continue
                while True:
                    o = line.find("/*")
                    if o == -1:
                        break
                    c = line.find("*/", o + 2)
                    if c == -1:
                        line, inblock = line[:o], True
                        break
                    line = line[:o] + line[c+2:]
                line = code_only(line)
                if BARE.search(line):
                    hits.append("%s:%d:%s" % (path, n, raw.rstrip()))

for h in hits:
    print(h)
PYEOF
)
if [ -n "$INDEX_HITS" ]; then
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    say "$hit"
    say "    ^ reaches into a stored list by position. Use ?.[ ] and show an empty state."
    fail=1
  done <<< "$INDEX_HITS"
fi

if [ $fail -ne 0 ]; then
  echo
  echo "RECORD LOADER CHECK FAILED - a screen would render whatever another screen left behind."
  echo "Send it through the form's one door instead:"
  echo "  Compliance / Fact Find:  setD(shape(value))"
  echo "  Lending options:         putOnScreen(value)"
  echo "Those build the blank record first and lay what is saved over the top, so a"
  echo "missing section is a blank section rather than a page that will not load."
  echo "See lib/record-defaults.ts and its tests."
  exit 1
fi
exit 0
