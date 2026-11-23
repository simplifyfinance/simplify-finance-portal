import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// NOBODY ASKS FOR MORE THAN A THOUSAND ROWS AND BELIEVES THE ANSWER.
//
// 23 Nov 2026. Supabase caps every Data API response at 1,000 rows - the "max
// rows" setting - and says nothing about the rows it did not send. A query that
// asks for 50,000 gets 1,000 and no error. The screen renders. The figures are
// wrong.
//
// IT HAS NOW HAPPENED TWICE.
//
//   2 Nov 2026. Fabio: "can you help me find deal cards for andrew leigh and
//   sangeeta gudigar I dont seem to be able to locate it but they were there
//   yesterday." They were. The deals screen asked for every deal, newest first,
//   and was handed the newest thousand. 241 real deals; he could see 92.
//   lib/the-whole-book.ts was written that day.
//
//   23 Nov 2026. Portfolio Review's plan read four months of trail - about
//   8,700 lines - and got 1,000. Most loans found no line and came back with no
//   balance, on a page whose figures go to clients.
//
// THE SECOND ONE EXISTED BECAUSE THE FIRST FIX WAS APPLIED WHERE THE BUG WAS,
// not everywhere the shape was. That is what this test is for. It is the same
// lesson as the security audit of the same morning: fix the class, not the
// instance.
//
// WHAT IT REFUSES: `.limit(n)` with n above 1,000. Either the read fits inside
// the cap - in which case say so with a smaller number - or it must page
// through with everyRow() from lib/the-whole-book.ts.

const ROOTS = ['app', 'components', 'lib']
const CAP = 1000

function filesUnder(dir: string): string[] {
  const out: string[] = []
  let entries: string[] = []
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { out.push(...filesUnder(full)); continue }
    if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

// COMMENTS ARE NOT CODE. This file explains the fault in prose that contains
// the very numbers it forbids, and a test that trips on its own explanation
// teaches people to delete it.
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('nobody asks for more than a thousand rows and believes the answer', () => {
  const files = ROOTS.flatMap(r => filesUnder(join(process.cwd(), r)))

  it('is reading the code at all', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('no query asks for more rows than the server will ever send', () => {
    const over: string[] = []

    for (const f of files) {
      const code = codeOnly(readFileSync(f, 'utf-8'))
      for (const m of code.matchAll(/\.limit\(\s*(\d+)\s*\)/g)) {
        const asked = Number(m[1])
        if (asked > CAP) {
          const line = code.slice(0, m.index || 0).split('\n').length
          over.push(`${f.replace(process.cwd() + '/', '')}:${line} asks for ${asked}`)
        }
      }
    }

    expect(over,
      'These ask for more rows than Supabase will send, and will be handed 1,000 '
      + 'with no error:\n  ' + over.join('\n  ')
      + '\n\nEither lower the number below 1,000 because the read genuinely fits, '
      + 'or page through it with everyRow() from lib/the-whole-book.ts.').toEqual([])
  })

  it('and the pager still asks for a page no bigger than the cap', () => {
    // everyRow asks for ASK rows a page. If ASK ever climbs above the server's
    // cap, the pager inherits the same silent truncation it exists to prevent.
    const book = readFileSync(join(process.cwd(), 'lib', 'the-whole-book.ts'), 'utf-8')
    const ask = Number((book.match(/export const ASK\s*=\s*(\d+)/) || [])[1])
    expect(ask).toBeGreaterThan(0)
    expect(ask).toBeLessThanOrEqual(CAP)
  })
})
