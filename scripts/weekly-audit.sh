#!/usr/bin/env bash
# ===========================================================================
# THE MONDAY MORNING AUDIT - THE HALF THAT READS THE CODE
# ===========================================================================
#
# 23 Nov 2026. Fabio: "Security is the number one priority of this portal."
#
# docs/weekly-audit.sql asks the database what is open. This asks the code the
# questions a database cannot answer - which routes let somebody past without
# checking who they are.
#
# RUN IT:   ./scripts/weekly-audit.sh
# It writes nothing, changes nothing, and takes about two seconds.
#
# Every line says PASS or FAIL. Send Claude the FAIL lines.

set -uo pipefail
cd "$(dirname "$0")/.."

fails=0
say() { # say <PASS|FAIL> <text>
  if [ "$1" = "FAIL" ]; then fails=$((fails+1)); fi
  printf '%-6s %s\n' "$1" "$2"
}

echo
echo "THE CODE SIDE"
echo "-------------"

# 1. A ROUTE THAT USES THE MASTER KEY WITHOUT CHECKING WHO IS ASKING.
#    createSupabaseAdmin ignores every rule in the database. A route holding it
#    must decide for itself whether the caller is staff. "Signed in" is not
#    that decision - that is the fault found on 23 Nov 2026.
bad=""
for f in $(grep -rl "createSupabaseAdmin" app/api 2>/dev/null); do
  if ! grep -q "user_profiles\|requireStaff" "$f"; then bad="$bad $f"; fi
done
if [ -n "$bad" ]; then
  say FAIL "Routes using the master key without checking for a staff record:"
  for f in $bad; do echo "           $f"; done
else
  say PASS "Every route using the master key checks for a staff record"
fi

# 2. A ROUTE WITH NO SIGN-IN CHECK AT ALL.
#    Client-facing routes are allowed this - they are reached from a signed
#    link, not a login. Everything else is not.
bad=""
for f in $(find app/api -name route.ts 2>/dev/null); do
  case "$f" in
    *ready*|*answers*|*proceed*|*opportunity*|*webhook*|*cron*) continue ;;
  esac
  if ! grep -q "auth.getUser\|requireUser\|requireStaff" "$f"; then bad="$bad $f"; fi
done
if [ -n "$bad" ]; then
  say FAIL "Routes with no sign-in check (check each is meant to be public):"
  for f in $bad; do echo "           $f"; done
else
  say PASS "Every staff route checks the caller is signed in"
fi

# 3. A SECRET TYPED INTO THE CODE.
#    Keys belong in Vercel, never in a file that goes to GitHub.
if grep -rn "eyJhbGciOiJIUzI1NiIs" --include=*.ts --include=*.tsx --include=*.js \
     app lib components scripts 2>/dev/null | grep -v "\.test\." | head -5 | grep -q .; then
  say FAIL "A key appears to be written into the code - look above"
else
  say PASS "No keys written into the code"
fi

# 4. THE GUARD TESTS STILL EXIST.
#    These are the tests that fail the ship when somebody undoes a fix. A
#    deleted guard is how a fixed fault comes back.
missing=""
for t in lib/nothing-restores-over-production.test.ts \
         lib/the-reading-room-is-emptied.test.ts \
         lib/nobody-is-deleted.test.ts; do
  [ -f "$t" ] || missing="$missing $t"
done
if [ -n "$missing" ]; then
  say FAIL "A guard test has gone missing:$missing"
else
  say PASS "The guard tests are all still here"
fi

echo
echo "THE DATABASE SIDE"
echo "-----------------"
echo "Open docs/weekly-audit.sql, paste it into the Supabase SQL editor on LIVE"
echo "and press run. It writes nothing. Send Claude any line that says FAIL."
echo
if [ "$fails" -gt 0 ]; then
  echo "$fails code check(s) FAILED. Send these to Claude."
else
  echo "Code side clean."
fi
echo
