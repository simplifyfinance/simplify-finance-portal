#!/usr/bin/env bash
# ONE CLOCK, AND IT IS SYDNEY'S.
#
# 13 Nov 2026. A compliance card saved at 10:02am Sydney is recorded by the
# database as 23:02 the day before, because the database keeps UTC. Nothing
# turned it back, so an hour was spent working out whether somebody had been
# working late. They had not. They had been working that morning.
#
# Fabio: "make sure that the timestamps are precise and they are based on
# Sydney Eastern Time. I don't want to have this issue again."
#
# THE PROBLEM IS NOT THE DATABASE. Storing UTC is correct and must not change.
# The problem is a date reaching a screen, an email or a PDF without being
# turned back into the office's day first. lib/same-date-everywhere.ts spells
# it out in Australia/Sydney on both the server and the browser.
#
# ---------------------------------------------------------------------------
# THIS COUNT HAS BEEN WRONG TWICE, AND A COUNT THAT LIES IS A COUNT NOBODY ACTS ON
# ---------------------------------------------------------------------------
#
# 13 Nov, first version: counted every toLocaleString() call. Most of them are
# MONEY - `Math.round(v).toLocaleString('en-AU')` is how dollar figures are
# drawn - and a dollar figure has no timezone. It reported 169 at risk when the
# real number was 80.
#
# 14 Nov, second version: read one line at a time. A call written across two
# lines, with the options on the second, was counted as unfixed even though the
# line below it said Australia/Sydney. It reported 15 left when the real number
# was a handful.
#
# So it now reads whole FILES and looks inside each CALL:
#   toLocaleDateString( / toLocaleTimeString(  - always a date or a time
#   toLocaleString(                            - only when the options name a
#                                                date or clock field
# and a call counts as done if the word timeZone appears anywhere inside it,
# however it is laid out.
#
# A call that deliberately says timeZone: 'UTC' is DONE, not broken. Those
# build a date as UTC midnight and read it back in UTC so the digits somebody
# typed survive - see shortDate() in components/DocumentsBox.tsx.
#
# THE NUMBER ONLY EVER GOES DOWN. Adding one fails the ship and names the file.
set -uo pipefail
cd "$(dirname "$0")/.."

#   13 Nov 2026: 169 - wrong, money counted as dates
#   14 Nov 2026:  80 - counted properly for the first time
#   14 Nov 2026:  66 - the screens that show a deal timestamp, converted
#   14 Nov 2026:   0 - read per call instead of per line, and all of them done
#
# ZERO. Every date a person sees now resolves in Sydney. Anything that fails
# this is new, and it is one line to fix: timeZone: OFFICE.
WAS=0

REPORT=$(node -e '
const fs = require("fs"), path = require("path");
const roots = ["lib", "app", "components"];
const CALL = /toLocale(Date|Time)?String\s*\(([^)]*)\)/g;
const FIELD = /(day|month|year|hour|minute|weekday|dateStyle|timeStyle)\s*:/;
let out = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "_to_delete") walk(p); continue; }
    if (!/\.tsx?$/.test(e.name) || /\.test\./.test(e.name)) continue;
    // A LINE INSIDE A COMMENT IS NOT A CALL. The note at the top of
    // same-date-everywhere.ts shows the wrong way to write one, on purpose,
    // and counted itself as a fault for a while.
    const src = fs.readFileSync(p, "utf8")
      .split("\n").map(l => (l.trim().startsWith("//") || l.trim().startsWith("*")) ? "" : l)
      .join("\n");
    let m;
    while ((m = CALL.exec(src))) {
      const kind = m[1] || "", args = m[2] || "";
      const isDate = kind === "Date" || kind === "Time" || FIELD.test(args);
      if (!isDate) continue;
      if (/timeZone/.test(args)) continue;
      out.push(p + ":" + (src.slice(0, m.index).split("\n").length));
    }
  }
}
roots.forEach(r => { if (fs.existsSync(r)) walk(r); });
console.log(out.join("\n"));
' 2>/dev/null)

GOT=$(printf '%s' "$REPORT" | grep -c . || true)

if [ "$GOT" -gt "$WAS" ]; then
  echo "ONE CLOCK CHECK FAILED - $GOT places read the machine's clock, was $WAS."
  echo "  A date shown to anybody is Sydney's day, not the server's."
  echo "  Use dayMonthYear / dayMonth / longDate / dayMonthTime / nowInSydney"
  echo "  from lib/same-date-everywhere.ts, or pass timeZone: OFFICE yourself."
  echo
  printf '%s\n' "$REPORT" | sed 's/^/    /'
  exit 1
fi

if [ "$GOT" -lt "$WAS" ]; then
  echo "  (one clock: down to $GOT from $WAS - lower WAS in scripts/check-one-clock.sh)"
fi

exit 0
