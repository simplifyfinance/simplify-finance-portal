import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

// THE SAME CALCULATION, WRITTEN OUT TWICE.
//
// This is the fault underneath most of what went wrong on 3 Sep 2026, and it is
// the reason the same bug kept coming back after being fixed:
//
//   30 Jul  "Extract self-employed income calculation into lib/ for reuse" moved
//           the code into a lib, carried the Number() bug with it, and left a
//           second copy in BCForm. Fixing either one alone would have left the
//           other quietly reporting $0 - so it stayed broken for five weeks.
//
//   3 Sep   monthsBetween and totalHistoryMonths existed in the fact find form
//           AND were needed by the still-to-confirm list, so the warning on
//           screen and the checklist could disagree about the same 24 months.
//
// Fabio, 3 Sep 2026: "we covered this a hundred times, why is this not fixed?"
// Because a fix applied to one copy is not a fix. This is the check that says so
// at ship time rather than six weeks later.
//
// It compares function BODIES with the comments and whitespace stripped out, so
// two copies that have drifted in formatting are still caught, and a function
// somebody genuinely rewrote is not.

function sourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    if (['node_modules', '.next', '.git', '_to_delete'].includes(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

const ROOT = process.cwd()
const FILES = ['app', 'lib', 'components'].flatMap(d => sourceFiles(join(ROOT, d)))

if (FILES.length < 20) throw new Error(`Only ${FILES.length} source files found — this guard is looking in the wrong place.`)

// Named function declarations and their bodies, matched by counting braces.
function bodies(text: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = []
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)[^{]*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const open = m.index + m[0].length - 1
    let depth = 0, j = open
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}' && --depth === 0) break
    }
    out.push({ name: m[1], body: text.slice(open + 1, j) })
  }
  return out
}

const normalise = (b: string) =>
  b.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()

// EMPTY, AND MEANT TO STAY EMPTY. There was an allowlist here for a few minutes
// on 3 Sep 2026 while the six duplicates this guard found were collapsed. An
// allowlist is how a guard stops guarding: the entries stop being read, and the
// next duplicate hides among them. If something genuinely has to be written
// twice, put the reason in the code and add it here knowing that.
const ALLOWED = new Set<string>([])

describe('no calculation is written out twice', () => {
  it('finds no function body repeated across two files', () => {
    const seen = new Map<string, { file: string; name: string }[]>()

    for (const f of FILES) {
      for (const { name, body } of bodies(readFileSync(f, 'utf8'))) {
        // Counted in LINES, not semicolons. The first version of this counted
        // semicolons and found nothing, because this codebase does not use
        // them - a guard that silently matches nothing is worse than no guard.
        const lines = body.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
        if (lines.length < 4) continue
        const n = normalise(body)
        const key = createHash('sha1').update(n).digest('hex')
        const at = seen.get(key) || []
        at.push({ file: f.replace(ROOT + '/', ''), name })
        seen.set(key, at)
      }
    }

    const duplicated = [...seen.values()]
      .filter(v => new Set(v.map(x => x.file)).size > 1)
      .filter(v => !v.every(x => ALLOWED.has(x.name)))
      .map(v => v.map(x => `${x.file}:${x.name}`).join('\n     == '))

    expect(duplicated,
      `The same function body appears in more than one file. A fix applied to one\n`
      + `copy is not a fix — that is how self-employed income stayed at $0 for five\n`
      + `weeks. Move it into lib/ and import it in both places:\n\n  ${duplicated.join('\n\n  ')}\n`
    ).toEqual([])
  })
})
