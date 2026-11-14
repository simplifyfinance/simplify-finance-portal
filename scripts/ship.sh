#!/usr/bin/env bash
# The only way changes reach production. Never hand-build a build-and-push chain
# again: piping npm run build into tail throws away its exit code, so a failed
# build looks like a success and gets pushed.
set -euo pipefail

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "usage: ./scripts/ship.sh \"commit message\""
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "REFUSING: on branch '$BRANCH', not main."
  exit 1
fi

# HOW LONG EACH STAGE ACTUALLY TAKES.
#
# Fabio, 16 Sep 2026: "the terminal still processing last command, taking longer
# these days." Neither of us knew whether that was the build or the 42 browser
# checks, so we were both guessing at which one to speed up. Now it says.
#
# SECONDS is a bash builtin holding the seconds since the shell started, so this
# costs nothing and cannot fail.
SHIP_START=$SECONDS
LAST=$SECONDS
took() {
  local s=$((SECONDS - LAST))
  LAST=$SECONDS
  if [ $# -gt 0 ]; then
    printf '%s (%dm %02ds)\n' "$1" $((s / 60)) $((s % 60))
  else
    printf ' (%dm %02ds)\n' $((s / 60)) $((s % 60))
  fi
}

# A GATE THAT PASSES BECAUSE IT IS BROKEN IS WORSE THAN NO GATE.
#
# 10 Sep 2026: a mis-quoted line inside check-record-loaders.sh made its search
# find nothing, so it reported success while checking absolutely nothing. Every
# gate is parsed before any of them is trusted.
for g in scripts/check-*.sh; do
  if ! bash -n "$g"; then
    echo "NOT SHIPPED - $g does not parse, so it cannot be trusted to check anything."
    exit 1
  fi
done

# WHAT WAS TESTED IS WHAT GETS COMMITTED.
#
# 12 Nov 2026. Twice in one day a file written WHILE this was running went into
# the commit: the tests pass against the tree as it was, the browser check runs
# for seven minutes, and `git add -A` at the end sweeps up whatever appeared in
# between. The commit then claims to be tested and is not.
#
# Nothing clever. The tree is fingerprinted now and again at the end, and a run
# that finds them different refuses to commit rather than committing something
# nobody checked.
# WHAT THE TREE LOOKED LIKE WHEN THE CHECKING STARTED.
#
# 15 Nov 2026. A ship passed every check - 8301 tests, the build, 42 browser
# tests, 8 minutes - and then refused to commit, because one tracked file had
# changed while it ran:
#
#     docs/last-audit.txt   -2026-11-12   +2026-11-14
#
# That is the two-day sweep's own date stamp, written by scripts/audit.sh when
# the scheduled task fired at 7:49pm, mid-run. Nobody touched the code. The
# guard was right to stop - it cannot tell one file from another - but the
# eight minutes were spent for nothing, and the answer "run it again" invites
# somebody to start deleting guards.
#
# So the stamp is excluded, and ONLY the stamp. It is a date written by a
# reporting script that ship.sh does not call and that changes no behaviour.
# Everything else in the tree still counts, including docs and scripts.
TREE_IGNORES='^docs/last-audit\.txt$'
tree_now() {
  git status --porcelain | awk '{ print $NF }' | grep -vE "$TREE_IGNORES" \
    | sort | shasum -a 256 | cut -d' ' -f1
}
TREE_AT_START=$(tree_now)

echo "Checking broker keys..."
if ! ./scripts/check-broker-keys.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# 12 Nov 2026. Three columns the code read did not exist, and then the database
# said there were seven. Every one was written as a guess with a fallback
# behind it, so none of them ever broke and none of them ever said so - and one
# of them had the client name blank on a whole screen.
echo "Checking the columns are real..."
if ! ./scripts/check-deal-columns.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# 27 Oct 2026. A capitalised premium was in the purchase box and missing from
# the split card under it, from the whole of the lending options, and from the
# two compliance paragraphs that say what somebody is borrowing. Five weeks,
# a green test suite, and Fabio finding it on a client email.
echo "Checking the LMI carries..."
if ! ./scripts/check-lmi-carries.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# A SCREEN ASKS FOR THE WHOLE BOOK, OR IT IS LYING ABOUT WHAT IS IN IT.
#
# 2 Nov 2026. The deals screen asked for every deal in one go. The database
# returned the newest thousand of 1165 and said nothing, so 149 real deals were
# on no screen at all - and Fabio went looking for two of them by name and
# could not find them. The dashboard, the settlements list and the credit
# team's workload had the same line.
echo "Checking the whole book is asked for..."
if ! ./scripts/check-whole-book.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# ONE PLACE READS THE TICKED SECURITIES.
#
# 17 Aug 2026. A deal cloned off a refinance and changed to a purchase kept one
# ticked house. The BC no longer draws the securities block on a purchase, so
# nobody could untick it, and every reader that went at bc.securityIds itself
# went on counting it - PROPERTY VALUE $538,085 and LVR 96.6% on a $650,000
# purchase. Fabio: "where i 538 coming from???"
echo "Checking who reads the ticked securities..."
if ! ./scripts/check-securities.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# A SPLIT'S JOB IS NOT ITS POSITION IN THE LIST.
#
# 30 Oct 2026. Four deals in two days came out wrong the same way: the panel
# edited splits[2] while the tagger looked for a label, the headline on four
# purchase emails quoted splits[0] over two loans, the purchase LVR divided
# splits[0] by the price. Fabio: "these issues need to stop."
echo "Checking how splits are found..."
if ! ./scripts/check-split-position.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

echo "Checking the clock..."
if ! ./scripts/check-one-clock.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

echo "Checking email HTML..."
if ! ./scripts/check-email-html.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

echo "Checking database writes..."
if ! ./scripts/check-writes.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

echo "Checking whole-record writes..."
if ! ./scripts/check-blob-writes.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# Wesley Perrott, 10 Sep 2026. A record written by one screen took another
# screen's tab down, and the first fix missed four of the five ways a record
# reaches a screen. See scripts/check-record-loaders.sh.
echo "Checking record loaders..."
if ! ./scripts/check-record-loaders.sh; then
  echo
  echo "NOT SHIPPED - fix the above first."
  exit 1
fi

# EVERY "MY WORK DISAPPEARED" THIS WEEK CAME BACK TO A BOX THAT SAVED ITSELF
# AROUND THE PROTECTED PATH. The internal notes box destroying a note on one
# keystroke; LO, BC and Compliance throwing away the last few seconds on a tab
# change. Both were found by somebody losing work. This finds the next one first.
echo "Checking nothing typed is saved around the guard..."
if ! ./scripts/check-typed-fields.sh; then
  echo
  echo "NOT SHIPPED - a box would save somebody's typing without the protection."
  exit 1
fi

# The refinance figures go straight into a client's email. They were covered by
# tests from the start, but the runner was never installed, so for months the
# checks existed and never ran. They run here now, before anything is built.
took "Code checks OK."
echo "Checking the maths..."
if ! npx vitest run > /tmp/ship-test.log 2>&1; then
  echo
  echo "TESTS FAILED - nothing committed, nothing pushed."
  echo
  tail -30 /tmp/ship-test.log
  exit 1
fi
printf 'Maths OK - %s.' "$(grep -oE 'Tests +[0-9]+ passed' /tmp/ship-test.log | tail -1)"
took

echo "Building..."
if ! npm run build > /tmp/ship-build.log 2>&1; then
  echo
  echo "BUILD FAILED - nothing committed, nothing pushed."
  echo
  grep -B 6 -A 4 "Type error\|Failed to compile\|Failed to type check" /tmp/ship-build.log | head -40 \
    || tail -25 /tmp/ship-build.log
  exit 1
fi
printf 'Build OK.'
took

# LAST, BECAUSE IT NEEDS THE BUILD.
#
# Everything above reads the code. This one opens it. Three faults reached the
# team in the week of 3-9 Sep that no code-level check could have seen - the page
# jumping, a ghost in a deal, and letters vanishing as Kylie typed - and every one
# of them would have been caught here in under a minute.
echo "Checking it in a browser..."
if ! ./scripts/check-browser.sh; then
  echo
  echo "NOT SHIPPED - the browser check failed. Something a person would see is broken."
  exit 1
fi
printf 'Browser OK.'
took

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing to commit."
  exit 0
fi

TREE_NOW=$(tree_now)
if [ "$TREE_NOW" != "$TREE_AT_START" ]; then
  echo
  echo "NOT COMMITTED - files changed while this was running."
  echo
  echo "  The tests and the browser check ran against the files as they were"
  echo "  when this started. Something has been written since. Committing now"
  echo "  would put code into main that nothing has checked."
  echo
  echo "  Nothing has been committed or pushed. Run it again."
  exit 1
fi

git add -A
git commit -m "$MSG"
git push origin main
echo
echo "PUSHED TO MAIN: $(git rev-parse --short HEAD)"
TOTAL=$((SECONDS - SHIP_START))
printf 'Whole run: %dm %02ds\n' $((TOTAL / 60)) $((TOTAL % 60))
