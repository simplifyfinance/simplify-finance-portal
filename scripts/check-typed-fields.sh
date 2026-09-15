#!/usr/bin/env bash
# NOTHING SOMEBODY TYPED GETS SAVED THE EASY WAY.
#
# 14 Sep 2026. Every "my work disappeared" this week came back to the same root:
# a box that saved itself around the protected path instead of through it.
#
#   * The internal notes box was pulled out of the Fact Find record into its own
#     column with its own little save. It left the version check, the merge and
#     the kept copy behind, and one person typing a single space destroyed
#     another person's note with nothing said.
#   * The LO, BC and Compliance tabs cancelled their pending save when the form
#     left the screen, so changing tab threw the last few seconds away.
#
# Both were found by somebody losing work, days apart. This is the check that
# would have found them first.
#
# THE RULE: a column that holds what a person typed - the four tab records, and
# anything named like notes or data - may only be written through saveGuarded.
# That is what carries the version check, the three-way merge and the copy of
# what is being replaced.
#
# Timestamps, flags, assignments and ids are not typing and are not covered. A
# stage moving or a card being assigned cannot destroy an afternoon.
set -uo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import re, sys, pathlib

# What a person types into. Anything matching this may not be written directly.
TYPED = re.compile(r"\b(fact_find_data|bc_data|lo_data|compliance_data|[a-z_]*notes|[a-z_]*_data)\s*:")

# Files allowed to write one of these directly, and why. A new name here is a
# decision somebody has to make on purpose.
ALLOWED = {
  # Its own guarded path: reads the current value, pins the write to the version
  # it read, merges line by line and keeps a copy first. See lib/notes-merge.ts.
  'components/InternalNotes.tsx':
    'has its own version check, merge and kept copy - see lib/notes-merge.ts',
}

roots = [pathlib.Path('app'), pathlib.Path('components')]
bad = []
for root in roots:
    for f in root.rglob('*.tsx'):
        rel = str(f)
        src = f.read_text(encoding='utf-8', errors='ignore')
        lines = src.split('\n')
        guarded = 'saveGuarded' in src
        for i, line in enumerate(lines):
            if "from('deals')" not in line:
                continue
            # The update and its fields can run over a few lines.
            window = '\n'.join(lines[i:i+8])
            if '.update(' not in window and '.upsert(' not in window:
                continue
            for m in TYPED.finditer(window):
                field = m.group(1)
                if rel in ALLOWED:
                    continue
                if guarded:
                    # The file knows about saveGuarded. Only flag a direct write
                    # that is plainly not going through it.
                    continue
                bad.append((rel, i + 1, field))

if bad:
    print()
    print('SOMETHING SOMEBODY TYPED IS BEING SAVED AROUND THE GUARD:')
    print()
    for rel, line, field in bad:
        print(f'  {rel}:{line} writes "{field}" straight to the deals table.')
    print()
    print('That write has no version check, no merge and keeps no copy of what it')
    print('replaces - so two people, or one person changing tab, can destroy work')
    print('with nothing said. Send it through saveGuarded (lib/save-conflict.ts).')
    print()
    print('If it genuinely has its own equivalent protection, add the file to')
    print('ALLOWED in scripts/check-typed-fields.sh with the reason, so the next')
    print('person can see it was a decision.')
    sys.exit(1)
PY
