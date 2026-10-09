// MONEY IS COMMA FORMATTED, AND Number('300,000') IS NaN.
//
// 9 Oct 2026, Lucy Daniel & James McRorie. A buy and sell with $300,000 of the
// clients' own savings on top of the sale. The email said the contribution came
// from "your sale proceeds" and never mentioned the savings - on the build card,
// on the purchase card, and on the deposit label, all three of which read
// Number() straight off a string with a comma in it.
//
// The route's own note above its money import says what to do about this:
// "formatting at the point of DISPLAY means the next leak, wherever it comes
// from, cannot reach anybody." readMoney() is that reader and it was already
// imported in the same file.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { readMoney } from './money'

describe('the trap itself', () => {
  it('is real - this is why the savings went unmentioned', () => {
    expect(Number('300,000')).toBeNaN()
    expect(readMoney('300,000')).toBe(300_000)
  })

  it('still reads a plain number, and still says nothing for a blank', () => {
    expect(readMoney(300000)).toBe(300_000)
    expect(readMoney('')).toBeNull()
    expect(readMoney(undefined)).toBeNull()
  })
})

describe('the buy and sell email', () => {
  const route = readFileSync('app/api/generate-email/route.ts', 'utf8')
  const branch = route.slice(route.indexOf("} else if (template === 'buy_sell')"),
                             route.indexOf("} else if (template === 'oo_lvr_compare')"))

  it('never reads a money field with bare Number() again', () => {
    expect(branch).not.toMatch(/Number\(d\.additionalSavings\)/)
    expect(branch).toContain('readMoney(d.additionalSavings)')
  })

  it('decides once and uses that answer everywhere', () => {
    // Three copies of the same test is three chances to fix two of them.
    expect((branch.match(/readMoney\(d\.additionalSavings\)/g) || []).length).toBe(1)
    expect(branch).toContain('const addedSavings =')
    expect(branch).toContain('const fromWords = addedSavings ?')
    expect(branch).toContain('contributionFrom: fromWords')
  })

  it('names the savings on the build card and on the purchase card alike', () => {
    expect(branch).toContain('sale proceeds and savings')
    expect(branch).toContain('buildStructure(d, buildLending, buildContribute, fromWords)')
  })
})
