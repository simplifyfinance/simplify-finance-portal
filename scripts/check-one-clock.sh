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
# turned back into the office's day first.
#
#   toLocaleDateString()  answers in whatever zone the machine is running in.
#                         The servers run on UTC. The office does not.
#   lib/same-date-everywhere.ts  spells it out in Australia/Sydney, always, on
#                         both the server and the browser.
#
# 14 NOV 2026 - THIS COUNT USED TO BE WRONG, AND IT MATTERED.
#
# The first version of this script counted every toLocaleString() call. Most of
# them are MONEY - `Math.round(v).toLocaleString('en-AU')` is how every dollar
# figure outside money() is drawn - and a dollar figure has no timezone. So it
# reported 169 places at risk when the real number was 80, and a number that
# cannot be trusted is a number nobody acts on.
#
# So it now counts only what is genuinely a date or a time:
#   toLocaleDateString(  - always a date
#   toLocaleTimeString(  - always a time
#   toLocaleString(      - ONLY when the options name a date or clock field
#
# THIS IS A GREP, NOT A TEST, for the same reason check-split-position.sh is: a
# test can be written around, a count cannot hide. The number only ever goes
# DOWN. Adding one fails the ship and names the file. Taking one away is free -
# convert it, lower the number here, and say so in the commit.
set -uo pipefail
cd "$(dirname "$0")/.."

# How many places still ask the machine what day it is.
#   13 Nov 2026: 169 - wrong, money counted as dates
#   14 Nov 2026:  80 - counted properly for the first time
#   14 Nov 2026:  66 - the screens that show a deal timestamp, converted
WAS=66

hits() {
  grep -rn "toLocaleDateString(\|toLocaleTimeString(\|toLocaleString(" \
    lib app components --include=*.ts --include=*.tsx 2>/dev/null \
    | grep -v "\.test\." \
    | grep -v "_to_delete" \
    | grep -v "timeZone" \
    | grep -E "toLocaleDateString\(|toLocaleTimeString\(|toLocaleString\([^)]*(day|month|year|hour|minute|weekday):"
}

GOT=$(hits | wc -l | tr -d ' ')

if [ "$GOT" -gt "$WAS" ]; then
  echo "ONE CLOCK CHECK FAILED - $GOT places read the machine's clock, was $WAS."
  echo "  A date shown to anybody is Sydney's day, not the server's."
  echo "  Use dayMonthYear / dayMonth / longDate / dayMonthTime / nowInSydney"
  echo "  from lib/same-date-everywhere.ts, or pass timeZone: OFFICE yourself."
  echo
  hits | tail -20 | sed 's/^/    /'
  exit 1
fi

if [ "$GOT" -lt "$WAS" ]; then
  echo "  (one clock: down to $GOT from $WAS - lower WAS in scripts/check-one-clock.sh)"
fi

exit 0
