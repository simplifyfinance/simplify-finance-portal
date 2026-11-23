#!/usr/bin/env bash
# STAGING BECOMES A COPY OF THE PORTAL.
#
# 23 Nov 2026. Fabio: "the point of building a staging is to mimic and test
# things." He is right, and ours has never done it. docs/OUTSTANDING.md has
# said since 16 September that staging was never a copy of production, which
# is why it was parked and why nothing has been tested on it since.
#
# This takes what scripts/pull-the-real-schema.sh read off production and
# builds it into staging. SCHEMA ONLY. No client record goes anywhere near a
# staging database - not a name, not an income, not a document.
#
# ------------------------------------------------------------------------
# IT WILL NOT RUN AGAINST PRODUCTION
# ------------------------------------------------------------------------
#
# This script restores. A restore into the wrong database is the single worst
# thing anybody could do with this repository, and the two connection strings
# differ by a dozen characters in the middle. So it checks, and it refuses.
#
# The check is on the project reference inside the connection string, not on a
# flag somebody could forget. See REFUSE below.
set -uo pipefail

IN="docs/live-schema"
URL="${STAGING_DB_URL:-}"

# The production project. Nothing may ever be restored into this one.
REFUSE="brjytbuirbupatjtauhx"

if [ -z "$URL" ]; then
  cat <<'HELP'
Set the STAGING connection string first, then run this again.

  export STAGING_DB_URL='postgresql://...'
  ./scripts/bring-staging-up-to-date.sh

Get it from the Supabase dashboard for the STAGING project - the one called
"Simplify Finance Portal - Staging". Project Settings, Database, Connection
string, DIRECT connection.

Check the project name at the top of the dashboard before you copy it.
HELP
  exit 1
fi

# ------------------------------------------------------------------------
# THE REFUSAL
# ------------------------------------------------------------------------
if printf '%s' "$URL" | grep -q "$REFUSE"; then
  cat <<'STOP'

  STOP.

  That connection string points at the PRODUCTION portal.

  This script restores a schema over the top of whatever is there. Running it
  against production could destroy every client record the business holds.

  Nothing has been done. Go and get the staging connection string.

STOP
  exit 1
fi

[ -f "$IN/schema.sql" ] || { echo "Run ./scripts/pull-the-real-schema.sh first."; exit 1; }
command -v psql >/dev/null || { echo "psql is not installed."; exit 1; }

POLICIES=$(grep -c 'CREATE POLICY' "$IN/schema.sql" 2>/dev/null || echo 0)
echo "About to build production's schema into staging."
echo "  $POLICIES security policies are in the file."
echo
if [ "$POLICIES" -lt 100 ]; then
  cat <<'THIN'
  WAIT.

  Production has 114 security policies and this file has far fewer. Either the
  dump did not include them, or it did not finish.

  Do not carry on. A schema restored without its policies leaves every table
  readable by anyone holding the public key. That happened once already, on
  12 November, to one table, for six days.

THIN
  exit 1
fi

printf 'Type the word staging to carry on: '
read -r SAID
[ "$SAID" = "staging" ] || { echo "Nothing has been done."; exit 1; }

echo
echo "Restoring. Errors about ownership and roles are EXPECTED - see"
echo "docs/moving-the-database-to-sydney.md, Phase 1, for which ones are normal."
echo

psql --variable ON_ERROR_STOP=0 \
  --file "$IN/roles.sql" \
  --file "$IN/schema.sql" \
  --dbname "$URL" 2>&1 | tee .robot-logs/staging-restore.log

echo
echo "WHAT TO DO NOW"
echo
echo "  1. Read .robot-logs/staging-restore.log. Write down every error and"
echo "     what fixed it. The same ones appear on the real day, and that list"
echo "     is the most useful thing this exercise produces."
echo
echo "  2. Run docs/both-sides-must-match.sql on production AND on staging."
echo "     Ignore the row counts - staging has different data. Everything else"
echo "     must match: 58 tables, 114 policies, 0 tables with security off,"
echo "     and the policy text word for word."
echo
echo "  3. If the policies do not match, stop and tell Fabio. That is the whole"
echo "     risk of the Sydney move, and finding it here costs nothing."
