import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// NOBODY WRITES THEIR OWN MONEY FORMATTER AGAIN.
//
// Number('146,380') is NaN. Every hand-written money helper in this codebase has
// had that fault in it, and each one was found the same way - a client, a lender
// or Fabio reading a figure that said $0 or nothing at all:
//
//   lib/income-calculations.ts   a self-employed income assessed at zero
//   BCForm.tsx  fmtMoney()       "Linked loan: Pepper Money - Balance $0", eight
//                                times, on half a million dollars of debt each,
//                                in an email that went to the client
//   summary/page.tsx fmtMoney()  the same three lines again
//   reports/page.tsx fmtMoney()  and again, in a file that already imported the
//                                correct reader and then ignored it
//
// WHAT THIS LOOKS FOR, AND WHY IT IS NARROW.
//
// The first version of this test flagged anything that ran Number() near a
// toLocaleString, and it caught twelve places that were all perfectly correct -
// broker targets, monthly actuals, the statement analysis - because those format
// a value that is ALREADY A NUMBER, straight out of a numeric database column.
// Number() on a number is harmless. A gate that cries wolf twelve times is a
// gate somebody switches off.
//
// The fault only exists when a helper takes ANYTHING (`v: any`), which in this
// codebase means a stored value, and runs Number() over it without first
// stripping the commas and the dollar sign. That is the shape of all four real
// ones, and of none of the twelve false alarms.
//
// A genuine exception may say so with
//   hand-rolled money is fine here: <why>
// on the line or in the comment block above it.

const SKIP = new Set(['node_modules', '.next', '.git', '_to_delete'])
const ROOT = join(__dirname, '..')

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sources(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

describe('one way to read money', () => {
  it('has no helper that takes a stored value and runs Number() over it', () => {
    const offenders: string[] = []
    for (const file of sources(ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!/toLocaleString\(['"]en-AU['"]/.test(line)) return
        // The helper's signature and body, as far back as it can reasonably be.
        const window = lines.slice(Math.max(0, i - 8), i + 1).join('\n')
        // The parameter that takes anything, and then Number() run over THAT
        // parameter itself. Not over one of its fields: `(r: any) => Number(r.amount)`
        // is somebody reading a numeric database column, which is fine, and
        // demanding otherwise is how a gate ends up crying wolf.
        const param = window.match(/\(\s*(\w+)\s*:\s*any\b/)
        const usesNumberOnIt = !!param && new RegExp(`\\bNumber\\s*\\(\\s*${param[1]}\\s*[),]`).test(window)
        const stripsFirst = /\.replace\s*\(/.test(window) || /readMoney/.test(window)
        const excused = /hand-rolled money is fine here:/.test(window)
        if (usesNumberOnIt && !stripsFirst && !excused) {
          offenders.push(`${file.replace(ROOT + '/', '')}:${i + 1}`)
        }
      })
    }
    expect(offenders, 'use money() / readMoney() from lib/money.ts').toEqual([])
  })

  // The gate has to still catch the thing it was built for.
  it('would catch the formatter that told a client she owed nothing', () => {
    const theBug = [
      'function fmtMoney(v: any): string {',
      '  const n = Number(v)',
      "  if (!v || isNaN(n)) return '0'",
      "  return n.toLocaleString('en-AU')",
      '}',
    ]
    const line = theBug.findIndex(l => /toLocaleString\(['"]en-AU['"]/.test(l))
    const window = theBug.slice(0, line + 1).join('\n')
    const param = window.match(/\(\s*(\w+)\s*:\s*any\b/)
    expect(param).not.toBeNull()
    expect(new RegExp(`\\bNumber\\s*\\(\\s*${param![1]}\\s*[),]`).test(window)).toBe(true)
    expect(/\.replace\s*\(/.test(window)).toBe(false)
  })

  // And has to leave a figure that is already a number alone - twelve of these
  // were flagged by the first version of this test and every one was correct.
  it('leaves a real number from the database alone', () => {
    const fine = [
      "    const rs: Row[] = (t.data || []).map((r: any) => ({",
      "      id: r.id, amount: Number(r.amount),",
      "    }))",
      "    setVals(rs.map(r => r.amount.toLocaleString('en-AU')))",
    ].join('\n')
    const param = fine.match(/\(\s*(\w+)\s*:\s*any\b/)
    expect(param).not.toBeNull()
    // Number() is run over r.amount, not over r. Not a money formatter.
    expect(new RegExp(`\\bNumber\\s*\\(\\s*${param![1]}\\s*[),]`).test(fine)).toBe(false)
  })
})
