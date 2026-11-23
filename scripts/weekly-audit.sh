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
say() { # say <PASS|FAIL|WARN> <text>
  # WARN is "this check could not run", not "this check found something".
  # It is printed and not counted, so a missing key never hides a real failure
  # behind a red number - but it is never silent either.
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
  case "$f" in */2fa/send/*|*/2fa/verify/*) continue ;; esac
  if ! grep -q "user_profiles\|onlyStaff" "$f"; then bad="$bad $f"; fi
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
# THESE CANNOT ASK, AND WHY. Every line is a decision, not an oversight -
# the same list lib/every-route-knows-who-you-are.test.ts keeps.
#   2fa/send, 2fa/verify  this IS the sign-in; it runs before there is one
#   version               returns a build number and nothing else
#   ready/answers/proceed/opportunity  reached from a signed link, not a login
for f in $(find app/api -name route.ts 2>/dev/null); do
  case "$f" in
    *ready*|*answers*|*proceed*|*opportunity*|*webhook*|*cron*) continue ;;
    */2fa/send/*|*/2fa/verify/*|*/version/*) continue ;;
  esac
  if ! grep -q "auth.getUser\|requireUser\|onlyStaff" "$f"; then bad="$bad $f"; fi
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

# ---------------------------------------------------------------------------
# WHO CAN REACH THIS PORTAL FROM OUTSIDE IT
# ---------------------------------------------------------------------------
#
# 23 Nov 2026, raised by the ONE by Valora portal and it was right: everything
# above tests the portal. None of it applies to somebody signing in to GitHub,
# Supabase, Vercel, Resend or OneDrive directly.
#
# GitHub is the only one of the five with a genuinely read-only key, so it is
# the only one checked automatically. The key holds Metadata: Read-only and
# nothing else - it cannot read code and it cannot read data. The other four
# are a two-minute look on the first of the month; see docs/who-has-the-keys.md
# for why automating them would be a worse trade than doing them by hand.

APPROVED="docs/approved-access.txt"
KEYCHAIN_ITEM="simplify-audit-github"
REPO="simplifyfinance/simplify-finance-portal"

approved_for() { # approved_for <service>
  [ -f "$APPROVED" ] || return 0
  grep -i "^$1:" "$APPROVED" 2>/dev/null | sed "s/^[^:]*:[[:space:]]*//" | tr -d "\r" | sed "/^$/d"
}

echo
echo "WHO CAN REACH IT FROM OUTSIDE"
echo "-----------------------------"

if [ ! -f "$APPROVED" ]; then
  say FAIL "$APPROVED is missing - nothing to compare against"
else
  TOKEN="$(security find-generic-password -s "$KEYCHAIN_ITEM" -w 2>/dev/null || true)"
  if [ -z "$TOKEN" ]; then
    say WARN "GitHub check not set up - see docs/who-has-the-keys.md to add the key"
  else
    BODY="$(curl -sS -w $'\n%{http_code}' \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/$REPO/collaborators?affiliation=all&per_page=100" 2>/dev/null || true)"
    CODE="$(printf '%s' "$BODY" | tail -n1)"
    JSON="$(printf '%s' "$BODY" | sed '$d')"

    case "$CODE" in
      200)
        WHO="$(printf '%s' "$JSON" | grep -o '"login"[[:space:]]*:[[:space:]]*"[^"]*"' \
               | sed 's/.*"\([^"]*\)"$/\1/' | sort -u)"
        OK="$(approved_for github | sort -u)"
        if [ -z "$OK" ]; then
          say WARN "No github: lines in $APPROVED yet. These have access - approve them:"
          printf '%s\n' "$WHO" | sed 's/^/           /'
        else
          EXTRA="$(comm -23 <(printf '%s\n' "$WHO") <(printf '%s\n' "$OK") 2>/dev/null || true)"
          GONE="$(comm -13 <(printf '%s\n' "$WHO") <(printf '%s\n' "$OK") 2>/dev/null || true)"
          if [ -n "$EXTRA" ]; then
            say FAIL "On GitHub but NOT approved - remove them or add them to $APPROVED:"
            printf '%s\n' "$EXTRA" | sed 's/^/           /'
          else
            say PASS "GitHub access matches the approved list"
          fi
          [ -n "$GONE" ] && echo "       note: approved but not on GitHub: $(printf '%s' "$GONE" | tr '\n' ' ')"
        fi
        ;;
      403)
        say FAIL "GitHub refused the key. A fine-grained token needs Administration: Read-only as well as Metadata: Read-only to list who has access."
        ;;
      401)
        say FAIL "GitHub rejected the key - it has expired or been revoked. See docs/who-has-the-keys.md to renew it."
        ;;
      404)
        say FAIL "GitHub could not find $REPO with that key - check the token's Resource owner and repository."
        ;;
      *)
        say FAIL "GitHub could not be reached (HTTP ${CODE:-none})."
        ;;
    esac
  fi
fi

# THE OTHER FOUR, BY HAND. First run of the month, or any time with --monthly.
DAY="$(date +%-d)"
if [ "${1:-}" = "--monthly" ] || [ "$DAY" -le 7 ]; then
  echo
  echo "BY HAND - first of the month (about two minutes)"
  echo "------------------------------------------------"
  echo "  Supabase  Organization then Team      - full access to every record and file"
  echo "  Vercel    Team then Members           - can change the live portal and read its keys"
  echo "  Resend    Team, and the API keys list - can send email as you"
  echo "  OneDrive  Manage access on the shared deal folders."
  echo "            Check there is no 'Anyone with the link' sharing."
  echo
  echo "  Expected to be there:"
  for svc in supabase vercel resend onedrive; do
    names="$(approved_for "$svc")"
    [ -n "$names" ] && printf '    %-9s %s\n' "$svc" "$(printf '%s' "$names" | tr '\n' ' ')"
  done
  echo
  echo "  Anyone else: remove them FIRST, investigate second. Then check"
  echo "  Supabase's access logs the same day - they are kept for days, not months."
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
