#!/bin/bash
# ONE PLACE READS THE TICKS.
#
# 17 Aug 2026. A deal cloned off a refinance and changed to a purchase kept one
# ticked security in its record. The BC had stopped drawing the securities
# block so nobody could untick it, and every screen that read bc.securityIds
# for itself went on counting the old house: the deal structure strip printed
# PROPERTY VALUE $538,085 and LVR 96.6% against a $650,000 purchase.
#
# securityIdsOf() in lib/securities.ts asks the scenario before it hands back a
# tick. Anything that reads the array itself is a second answer to the same
# question, and this codebase has paid for that often enough.
#
# Fabio: "the logic is ALWAYS THE SAME BC sets the tone structure."
set -e
cd "$(dirname "$0")/.."

python3 - <<'PY'
import re, sys, pathlib

# WHERE IT IS ALLOWED, AND WHY.
#
#   lib/securities.ts   is securityIdsOf itself.
#   lib/top-up.ts       cannot import it: securities.ts reads lendingAgainst()
#                       out of top-up.ts, so asking would be a circle. Every
#                       one of its reads is already behind isTopUp(), and both
#                       top up scenarios can hold securities, so the answer
#                       would be identical. Revisit if that ever changes.
ALLOWED = {'lib/securities.ts', 'lib/top-up.ts'}

# The form owns its own useState, which is not a record being read.
ALLOWED_PREFIX = ('app/(app)/deals/[id]/BCForm.tsx',)

RAW = re.compile(r'(?:bc|bcNow|d|deal\?\.bc_data|s)\??\.securityIds')
bad = []
for p in pathlib.Path('.').rglob('*.ts*'):
    s = str(p)
    if 'node_modules' in s or '.next' in s: continue
    if s.endswith('.test.ts') or s.endswith('.test.tsx'): continue
    if s in ALLOWED or s.startswith(ALLOWED_PREFIX): continue
    try: text = p.read_text()
    except Exception: continue
    for n, line in enumerate(text.split('\n'), 1):
        if line.strip().startswith('//') or line.strip().startswith('*'): continue
        if RAW.search(line):
            bad.append(f'{s}:{n}: {line.strip()[:110]}')

if bad:
    print('These read the ticked securities themselves instead of asking securityIdsOf():')
    print()
    for b in bad: print('  ' + b)
    print()
    print('securityIdsOf(bc) in lib/securities.ts is the one answer. It returns nothing')
    print('on a scenario that cannot hold securities, which is what a cloned deal needs.')
    sys.exit(1)
PY

echo "The ticks are read in one place."
