#!/bin/bash
# A LIST OF DEALS IS ASKED FOR A PAGE AT A TIME.
#
# 2 Nov 2026. The deals screen asked for every deal in one go. The database
# answered with the newest thousand of 1165 and said nothing about the rest, so
# 149 real deals were not on screen anywhere - board, list or search - and
# Fabio went looking for two of them by name and could not find them.
#
# The dashboard, the settlements list and the credit team's workload all had
# the same line. Every one of them was quietly short.
#
# So: any read of the deals table that can come back as MORE THAN ONE ROW goes
# through everyRow in lib/the-whole-book.ts. One row by id is fine. A count is
# fine. A write is fine. A list is not.
#
# This is a shape check, not a word count: it reads what each query actually
# does, so a new screen cannot ship with a silent cap on the book.

python3 - "$@" <<'PYEOF'
import re, sys, pathlib

ROOTS = ['app', 'components', 'lib']
# Reads that cannot run away.
#
#   the first three  - one row, or a count with no rows at all
#   client_id / applicants - one client's own deals, and a client has a handful
#   SHORT LIST ON PURPOSE - a deliberate cap, written down and explained. The
#     silent cap is the bug; a stated one is a decision. Saying it out loud in
#     the code is the whole difference, so the words have to be there.
ONE_ROW = ['.single()', '.maybeSingle()', 'head: true', ".eq('id'", '.eq("id"',
           ".eq('client_id'", 'fact_find_data->applicants',
           'SHORT LIST ON PURPOSE']
WRITES = ['.insert(', '.update(', '.delete(', '.upsert(']

bad = []
for root in ROOTS:
    for f in sorted(pathlib.Path(root).rglob('*')):
        if f.suffix not in ('.ts', '.tsx') or f.name.endswith('.test.ts'):
            continue
        s = f.read_text()
        for m in re.finditer(r"from\('deals'\)", s):
            after = s[m.end():m.end() + 600]
            before = s[max(0, m.start() - 300):m.start()]
            # The statement ends at the next line that starts a new one.
            if any(w in after[:200] for w in WRITES):
                continue
            if '.select(' not in after[:300]:
                continue
            if any(k in after for k in ONE_ROW):
                continue
            if 'SHORT LIST ON PURPOSE' in before:
                continue
            if 'everyRow' in before:
                continue
            line = s[:m.start()].count('\n') + 1
            bad.append(f'{f}:{line}')

if bad:
    print('NOT SHIPPED - a list of deals is read without paging, so the database')
    print('will quietly return only the first page of it. Use everyRow from')
    print('lib/the-whole-book.ts, or narrow the read to one row.')
    for b in bad:
        print('  ' + b)
    sys.exit(1)
print('Every list of deals is paged.')
PYEOF
