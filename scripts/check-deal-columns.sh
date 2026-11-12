#!/usr/bin/env bash
# DOES THIS COLUMN EXIST?
#
# 12 Nov 2026. Three columns the code reads turned out not to exist:
# lodged_date, brand_id and updated_at. Each cost a round trip, and one of them
# had me give Fabio a wrong diagnosis twice before the database said otherwise.
#
# Nothing anywhere checked. The portal reads about a hundred fields off a deal
# and every one of them was a guess that happened to be right.
#
# SO THE REAL LIST IS COMMITTED, and this fails the ship on anything that is
# not on it. Taken straight out of information_schema - see the command at the
# top of docs/deals-columns.txt for how to refresh it after a migration.
#
# WHY A GUESS WITH A FALLBACK IS STILL WRONG. Most of these were written as
#   d.lodged_date || d.lodged_at
# which never breaks, never errors, and never tells anybody the first half is
# dead. A screen like that looks maintained and is not.

set -uo pipefail
cd "$(dirname "$0")/.."

LIST=docs/deals-columns.txt
if [ ! -f "$LIST" ]; then
  echo "DEAL COLUMN CHECK: $LIST is missing. Nothing can be checked."
  exit 1
fi

# The committed columns, one per line, comments and blanks dropped.
known=$(grep -vE '^\s*(#|$)' "$LIST" | tr -d ' \t' | sort -u)

# ONLY THE UNAMBIGUOUS SPELLINGS. `d.` and `row.` are used for brokers, splits,
# officers and half a dozen other shapes, so they would fail on columns that
# are real somewhere else. `deal.` and `dealData.` are always a deal.
# COMMENTS ARE NOT CODE. The first version failed on its own explanation of
# which columns are dead, which is a special kind of stupid.
code() {
  grep -rh --include='*.ts' --include='*.tsx' '' app lib components 2>/dev/null \
    | grep -vE '^[[:space:]]*(//|\*|/\*)'
}

# A COLUMN IS snake_case ALL THE WAY TO THE END. `deal.loanAmount` is a field
# on something the portal built in memory, and stopping the match at the
# capital letter would report a column called "loan" that nobody wrote.
found=$(code \
        | grep -oE '(^|[^A-Za-z0-9_.-])(deal|dealData)\??\.[a-z][a-z0-9_]{2,}([^A-Za-z0-9_]|$)' \
        | sed -E 's/^[^A-Za-z]*//; s/^[a-zA-Z]+\??\.//; s/[^A-Za-z0-9_]$//' | sort -u)

# Methods and the handful of shapes a deal object carries in memory rather than
# in the table.
# ...and the joined tables, which are real on the object and no part of it.
# They are listed in the comments at the top of docs/deals-columns.txt.
NOT_A_COLUMN='^(map|filter|find|length|push|slice|split|join|trim|includes|some|every|reduce|sort|concat|indexOf|toString|valueOf|then|catch|forEach|flatMap|findIndex|keys|values|entries|hasOwnProperty|replace|match|startsWith|endsWith|padStart|toFixed|toLocaleDateString|toLocaleString|toISOString|getTime|clients|lenders|credit_officers|brokers|amount|client)$'

bad=0
while IFS= read -r col; do
  [ -z "$col" ] && continue
  echo "$col" | grep -qE "$NOT_A_COLUMN" && continue
  if ! echo "$known" | grep -qx "$col"; then
    if [ "$bad" -eq 0 ]; then
      echo "DEAL COLUMN CHECK FAILED - the code reads columns that do not exist."
      echo
    fi
    bad=1
    grep -rnE "(deal|dealData)[?]*\.$col([^A-Za-z0-9_]|\$)" \
      --include='*.ts' --include='*.tsx' app lib components 2>/dev/null \
      | grep -v '\.test\.' | head -4 | sed "s/^/  $col  /"
  fi
done <<< "$found"

if [ "$bad" -ne 0 ]; then
  echo
  echo "  Either the column was renamed, or it never existed and a fallback has"
  echo "  been hiding it. If you have just added one, refresh $LIST."
  exit 1
fi

echo "Every deal column the code reads is real."
exit 0
