#!/usr/bin/env bash
# Outlook on Windows renders mail through Word, which paints a background only
# from a bgcolor attribute on a <td> or <table>. CSS background on a div, a link
# or a bare cell shows nothing, and rgba() is not understood at all — so an email
# that looks right on a Mac arrives as black text on white for half the clients.
#
# This ran once by hand and found 34 of them across eight templates. It runs on
# every ship now so the next one is caught before a client sees it.
set -uo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import re, io, glob, sys

TAG = re.compile(r'<(td|table|div|a|p|span)\b[^>]*>', re.I)
files = sorted(set(glob.glob('app/api/**/*.ts', recursive=True) + glob.glob('lib/*.ts')))
issues = []
for f in files:
    s = io.open(f, encoding='utf-8').read()
    if '<td' not in s and '<table' not in s and '<div' not in s:
        continue
    for m in TAG.finditer(s):
        tag = m.group(0)
        if not re.search(r'background(-color)?\s*:', tag):
            continue
        colour = re.search(r'background(?:-color)?\s*:\s*([^;"\']+)', tag).group(1).strip()
        if colour in ('transparent', 'none'):
            continue
        line = s[:m.start()].count('\n') + 1
        name = m.group(1).lower()
        if name in ('div', 'a', 'p', 'span'):
            issues.append((f, line, 'colour on a <%s> — Word paints nothing. Use a table cell.' % name))
        elif 'bgcolor=' not in tag:
            issues.append((f, line, 'background %s with no bgcolor attribute' % colour))
    # Word keeps a text colour on a run, and drops one on a paragraph. A colour
    # on a <div>, <p> or <td> holding text arrives black — which is how Kylie's
    # disclaimer came through as black on charcoal. Wrap the text in a span.
    for tag in ('div', 'p', 'td'):
        pat = re.compile(
            r'<%s style="[^"]*?color:\s*([^;"]+)[^"]*">((?:(?!<%s|</%s>).)*?)</%s>'
            % (tag, tag, tag, tag), re.S)
        for m in pat.finditer(s):
            inner = m.group(2)
            if not inner.strip():
                continue
            if re.search(r'<(table|div|td|tr|p)\b', inner, re.I):
                continue                       # holds other blocks, not text
            if '<span style="color:' in inner or inner.strip().startswith('<a '):
                continue                       # already a run-level colour
            issues.append((f, s[:m.start()].count('\n') + 1,
                           'text colour on a <%s> — Word paints it black. Wrap the text in a span.' % tag))

    for m in re.finditer(r'rgba\(', s):
        issues.append((f, s[:m.start()].count('\n') + 1, 'rgba() — Word has no rgba. Use a solid hex.'))

if issues:
    print('EMAIL HTML CHECK FAILED - this will not render in Outlook on Windows.')
    for f, line, why in issues:
        print(f'{f}:{line}: {why}')
    sys.exit(1)
PY
