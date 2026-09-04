import { describe, it, expect } from 'vitest'
import { feeText } from './lender-fees'

// Fabio, 4 Sep 2026: "I have had to go back and change the lender library a few
// times as it keeps dropping off the dollar sign." The fee boxes are free text
// on purpose - "None — government fees only" is a real answer - so a bare number
// went in and a bare number came out, next to another lender's $350.
describe('a fee gets its dollar sign', () => {
  it('adds one to a plain amount', () => {
    expect(feeText('250')).toBe('$250')
    expect(feeText('1,250')).toBe('$1,250')
    expect(feeText('250.00')).toBe('$250.00')
    expect(feeText('0')).toBe('$0')
  })

  it('does not add a second one', () => {
    expect(feeText('$250')).toBe('$250')
    expect(feeText('$395/yr')).toBe('$395/yr')
  })

  it('keeps the unit hanging off the amount', () => {
    expect(feeText('395/yr')).toBe('$395/yr')
    expect(feeText('250 per year')).toBe('$250 per year')
    expect(feeText('120pa')).toBe('$120 pa')
  })

  // The whole reason these boxes are free text. Forcing them through a currency
  // input would lose the answer entirely.
  it('leaves a sentence exactly as it was typed', () => {
    for (const t of ['None — government fees only', 'Free up to $360',
                     'Break cost on fixed, or None', 'None', 'Waived for professional package']) {
      expect(feeText(t)).toBe(t)
    }
  })

  it('leaves an empty box empty rather than printing $0', () => {
    expect(feeText('')).toBe('')
    expect(feeText('   ')).toBe('')
    expect(feeText(null)).toBe('')
    expect(feeText(undefined)).toBe('')
  })

  // Applied on render as well as on save, so the rows already stored bare are
  // repaired without a migration.
  it('is safe to run twice', () => {
    for (const t of ['250', '$250', 'None — government fees only', '395/yr', '']) {
      expect(feeText(feeText(t))).toBe(feeText(t))
    }
  })
})
