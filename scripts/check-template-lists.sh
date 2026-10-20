#!/usr/bin/env bash
# WHICH LISTS A SCENARIO IS MISSING FROM.
#
# 20 Oct 2026. Fabio, after a second round of faults on the two new top up
# templates: "these need to be picked up early."
#
# THE REASON THEY WERE NOT IS COUNTABLE. There are three dozen hard-coded lists
# of scenario names across lib, app and components - which scenarios buy, which
# refinance, which draw a stamp duty box, which get a type chip, which the
# documents checklist treats as a purchase. A new template gets named in about
# nine of them. It is silently absent from the rest, and nothing anywhere says
# which. That is not an oversight on one afternoon; it is two dozen decisions
# nobody is ever shown.
#
# Every one of these shipped because of exactly that:
#   deal-labels.ts      no entry, so a top up wore an "unknown" chip
#   document-rules.ts   not a refinance, therefore treated as a purchase, so it
#                       demanded a contract of sale for a house nobody is buying
#   BCForm.tsx          five box gates, so the purchase fields drew twice
#   BCForm.tsx          a second copy of the buying list that never got updated
#
# IT REPORTS, IT NEVER BLOCKS, and ship.sh does not call it. Most absences are
# correct - a refinance belongs out of the buying list, and a plain top up
# belongs out of every purchase list. The point is that each one is a decision
# somebody has looked at, which takes about two minutes when a template is added
# and costs a week of Fabio finding them on his screen when it is not done.
#
#   ./scripts/check-template-lists.sh top_up
#
# With no argument it lists every scenario and how many lists it is named in.
cd "$(dirname "$0")/.."
exec python3 -I - "$PWD" "${1:-}" <<'PY'
import os, re, sys
root, want = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '')

src = open(os.path.join(root, 'lib/templates.ts')).read()
block = src[src.index('TEMPLATE_LABELS'):]
keys = [k for k in re.findall(r'^\s{2}([a-z_]+):\s+[\'"]', block, re.M) if k != 'custom']

files = []
for base in ('lib', 'app', 'components'):
    for dp, _, fns in os.walk(os.path.join(root, base)):
        if 'node_modules' in dp:
            continue
        for fn in fns:
            if fn.endswith(('.ts', '.tsx')) and '.test.' not in fn:
                files.append(os.path.join(dp, fn))

# A name in quotes inside a list, or an unquoted key in a Record<string, ...>.
keyre = re.compile(r'(?:[\'"](' + '|'.join(keys) + r')[\'"])|(?:\b(' + '|'.join(keys) + r')\s*:)')

lists = []
for f in sorted(files):
    lines = open(f).read().split('\n')
    i = 0
    while i < len(lines):
        # A list may wrap. Keep joining while a bracket is still open.
        chunk, j = lines[i], i
        while (j + 1 < len(lines) and j - i < 25
               and (chunk.count('[') > chunk.count(']') or chunk.count('{') > chunk.count('}'))):
            j += 1
            chunk += ' ' + lines[j]
        found = {a or b for a, b in keyre.findall(chunk)}
        if len(found) >= 2:
            lists.append((os.path.relpath(f, root), i + 1, found, lines[i].strip()[:100]))
            i = j
        i += 1

if not want:
    print(f'{len(lists)} hard-coded lists of scenario names.\n')
    for k in keys:
        n = sum(1 for _, _, found, _ in lists if k in found)
        print(f'  {k:<20} named in {n:>2} of {len(lists)}')
    print('\nRun again with a scenario name to see the ones it is missing from.')
    raise SystemExit(0)

if want not in keys:
    print(f'{want} is not a scenario in lib/templates.ts. Known: {", ".join(keys)}')
    raise SystemExit(1)

absent = [r for r in lists if want not in r[2]]
print(f'{want}: named in {len(lists) - len(absent)} of {len(lists)} lists.\n')
print(f'Absent from these {len(absent)}. Each is a decision, not a bug:\n')
for f, ln, _, text in absent:
    print(f'  {f}:{ln}')
    print(f'      {text}')
print(f'\n{len(absent)} to look at. Nothing here is automatically wrong.')
PY
