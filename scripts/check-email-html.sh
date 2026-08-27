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

    # Text on a dark cell is the bug that bit twice: Word paints the background
    # from the bgcolor attribute and then throws away the pale colour that made
    # the text readable on it, so it arrives black on charcoal. The rule is that
    # a dark cell holds artwork and nothing else.
    consts = dict(re.findall(r"const (\w+)\s*=\s*'(#[0-9a-fA-F]{6})'", s))
    def dark(v):
        v = consts.get(v.strip('${}'), v)
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', v or ''):
            return False
        r, g, bl = (int(v[i:i+2], 16) for i in (1, 3, 5))
        return (0.299 * r + 0.587 * g + 0.114 * bl) < 110
    # Scanned from each opening tag rather than as a matched pair: a wrapping
    # cell's match swallowed the charcoal one and the first version of this rule
    # sailed straight past the very bug it was written for.
    for m in re.finditer(r'<td[^>]*bgcolor="([^"]+)"[^>]*>', s):
        if not dark(m.group(1)):
            continue
        rest = s[m.end():]
        close = rest.find('</td>')
        if close < 0:
            continue
        inner = rest[:close]
        if '<td' in inner:
            continue                      # holds cells of its own, not text
        inner = re.sub(r'<img[^>]*>', '', inner)
        inner = re.sub(r'<[^>]+>', '', inner)
        inner = inner.replace('&nbsp;', '').replace('${logoBlock}', '').strip()
        if inner:
            issues.append((f, s[:m.start()].count('\n') + 1,
                           'text on a dark cell (%s) — Word drops the pale colour and paints it '
                           'black. Dark cells hold artwork only.' % m.group(1)))

    for m in re.finditer(r'rgba\(', s):
        issues.append((f, s[:m.start()].count('\n') + 1, 'rgba() — Word has no rgba. Use a solid hex.'))

if issues:
    print('EMAIL HTML CHECK FAILED - this will not render in Outlook on Windows.')
    for f, line, why in issues:
        print(f'{f}:{line}: {why}')
    sys.exit(1)
PY
