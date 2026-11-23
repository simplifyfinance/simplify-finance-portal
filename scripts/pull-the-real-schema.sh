#!/usr/bin/env bash
# WHAT PRODUCTION ACTUALLY LOOKS LIKE, WRITTEN DOWN.
#
# 23 Nov 2026. docs/OUTSTANDING.md has said since September that staging was
# never a copy of production, and that SIXTEEN TABLES EXIST LIVE WITH NO FILE
# ANYWHERE THAT CREATES THEM.
#
# That is the root of two separate problems:
#
#   1. Staging cannot be brought up to date from the repo, because the repo
#      does not describe production.
#   2. The database move to Sydney has to dump from the live database rather
#      than replay our files, for the same reason.
#
# This reads production and writes what it finds into docs/live-schema/. Read
# only. It opens no transaction, writes nothing to the database, and cannot
# change a single row.
#
# AFTER THIS, THE REPO DESCRIBES THE PORTAL. The files it writes are the
# starting point for scripts/bring-staging-up-to-date.sh and for the Sydney
# move. See docs/moving-the-database-to-sydney.md.
set -uo pipefail

OUT="docs/live-schema"
URL="${PRODUCTION_DB_URL:-}"

if [ -z "$URL" ]; then
  cat <<'HELP'
Set the production connection string first, then run this again.

  export PRODUCTION_DB_URL='postgresql://...'
  ./scripts/pull-the-real-schema.sh

Get it from the Supabase dashboard: Project Settings, Database, Connection
string, DIRECT connection - not the pooler. The pooler breaks bulk copies.

Do not paste that string into a chat window, an email, or a commit. It is the
key to every client record the business holds.
HELP
  exit 1
fi

command -v supabase >/dev/null || { echo "The Supabase CLI is not installed."; exit 1; }

mkdir -p "$OUT"
echo "Read only. Nothing is written to the database."
echo

# ROLES FIRST. The grants live here, and a schema restored without them leaves
# tables that exist and nobody can read - or worse, that everybody can.
echo "  roles..."
supabase db dump --remote="$URL" -f "$OUT/roles.sql" --role-only || exit 1

# THEN THE SHAPE. Tables, views, functions, triggers, and - this is the part
# that matters - the row level security policies.
echo "  schema..."
supabase db dump --remote="$URL" -f "$OUT/schema.sql" || exit 1

# AND THE BITS THE DUMP LEAVES BEHIND.
#
# Supabase confirmed on 23 Nov 2026 that `supabase db dump` EXCLUDES the
# managed auth, storage and extension schemas by default. Our storage rules
# live there - including the one that says nobody may read the reading room -
# so without this they would quietly not come across.
echo "  the auth and storage rules the dump leaves out..."
supabase db diff --remote="$URL" > "$OUT/auth-and-storage.sql" 2>/dev/null || true

echo
echo "Written to $OUT/:"
wc -l "$OUT"/*.sql 2>/dev/null | sed 's/^/  /'
echo
echo "WHAT TO DO NOW"
echo
echo "  1. Read $OUT/schema.sql and look for tables you do not recognise."
echo "     Sixteen of them have never been written down anywhere."
echo
echo "  2. Count the policies in it. There should be 114:"
echo "       grep -c 'CREATE POLICY' $OUT/schema.sql"
echo
echo "     IF THAT NUMBER IS NOT 114, STOP. Supabase would not confirm in"
echo "     writing that the dump always emits policies. This is how we find"
echo "     out, and finding out here costs nothing."
echo
echo "  3. Then: ./scripts/bring-staging-up-to-date.sh"
