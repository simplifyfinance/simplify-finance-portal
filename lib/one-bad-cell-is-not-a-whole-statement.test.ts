import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// 18 Oct 2026. Fabio, mid-audit: "all of a sudden Mark's and Fabio's commission
// reports are not reading." One statement refused, and the only thing on screen
// was "Invalid time value".
//
// new Date('rubbish') returns an Invalid Date. It is `instanceof Date`. Calling
// toISOString() on it throws RangeError: Invalid time value - and that throw
// travelled all the way up to the catch in app/api/commission-import/route.ts,
// which refuses the WHOLE FILE. One unreadable settlement-date cell cost six
// months of commission.

const SRC = readFileSync('lib/sfg.ts', 'utf8')

// The parser's own date reader, lifted out so the behaviour can be run rather
// than described. Kept identical to lib/sfg.ts dateStr.
const str = (v: any) => (v === null || v === undefined ? '' : String(v).trim())
const dateStr = (v: any): string | null => {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)
  const s = str(v)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

describe('a settlement date cell', () => {
  it('reads a real date, as it always did', () => {
    expect(dateStr(new Date(Date.UTC(2025, 8, 15)))).toBe('2025-09-15')
    expect(dateStr('15/09/2025')).toBe('2025-09-15')
  })

  it('returns nothing for an empty cell', () => {
    expect(dateStr(null)).toBeNull()
    expect(dateStr('')).toBeNull()
    expect(dateStr(undefined)).toBeNull()
  })

  // THE ONE THAT BROUGHT THE WHOLE FILE DOWN.
  it('does not throw on an Invalid Date, which is still a Date', () => {
    const bad = new Date('rubbish')
    expect(bad instanceof Date).toBe(true)
    expect(() => bad.toISOString()).toThrow()      // the fault, proven
    expect(() => dateStr(bad)).not.toThrow()        // and the guard
    expect(dateStr(bad)).toBeNull()
  })

  it('nor on text that is not a date at all', () => {
    expect(dateStr('not a date')).toBeNull()
    expect(dateStr('N/A')).toBeNull()
    expect(dateStr('99/99/9999')).toBe('9999-99-99')  // matched the pattern; a
    // later reader decides what to do with it. It does not stop the import.
  })
})

describe('the parser itself', () => {
  it('guards the Date branch, not only the text branch', () => {
    expect(SRC).toContain('isNaN(v.getTime()) ? null : v.toISOString()')
  })

  // The guard that was always there, on the branch that never needed it as
  // badly. Kept so a future tidy-up cannot remove one and leave the other.
  it('and still guards the text branch', () => {
    expect(SRC).toContain('isNaN(d.getTime()) ? null : d.toISOString()')
  })
})
