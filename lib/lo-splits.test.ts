import { describe, it, expect } from 'vitest'
import { resolveLenderSplits, seedFromGlobal } from './lo-splits'

// Clementine's refinance, 2 Sep 2026 - the deal that found this.
const globals = [
  { id: 'a', label: 'Existing loan refinanced', amount: '666,000' },
  { id: 'b', label: 'Equity access', amount: '30,000' },
]

describe('a lender with no splits of its own falls back to the deal', () => {
  it('gives the first lender option its splits', () => {
    // Bank of Melbourne, option 1, lenderSplits: []
    const rows = resolveLenderSplits({ lenderSplits: [] }, globals)
    expect(rows.map(r => r.label)).toEqual(['Existing loan refinanced', 'Equity access'])
    expect(rows[1].amount).toBe('30,000')
  })

  it('handles a lender that has never had the field at all', () => {
    expect(resolveLenderSplits({}, globals)).toHaveLength(2)
    expect(resolveLenderSplits(null, globals)).toHaveLength(2)
    expect(resolveLenderSplits(undefined, globals)).toHaveLength(2)
  })

  it('leaves a lender that HAS its own splits completely alone', () => {
    // Macquarie carved the same money up differently. That is the whole reason
    // the per-lender list exists, and the fallback must never overwrite it.
    const own = [{ id: 'a', label: 'One loan', amount: '696,000', lvr: '70%', rate: '6.09', repayment: '4,450', repaymentType: 'P&I' }]
    expect(resolveLenderSplits({ lenderSplits: own }, globals)).toBe(own)
  })

  it('shows nothing when the deal itself has no splits, so the warning is honest', () => {
    expect(resolveLenderSplits({ lenderSplits: [] }, [])).toEqual([])
    expect(resolveLenderSplits({ lenderSplits: [] }, null)).toEqual([])
  })

  it('seeds the per-lender fields empty for the broker to fill', () => {
    const [first] = seedFromGlobal(globals)
    expect(first.id).toBe('a')
    expect(first.lvr).toBe('')
    expect(first.rate).toBe('')
    expect(first.repayment).toBe('')
    expect(first.repaymentType).toBe('P&I')
  })
})

// ---------------------------------------------------------------------------
import { lenderTotal, lenderLvr, combineIntoOneLoan, amountOf } from './lo-splits'

const row = (label: string, amount: string, rate = '6.09', repaymentType = 'P&I') =>
  ({ id: label, label, amount, lvr: '', rate, repayment: '100', repaymentType })

describe('one LVR per lender, never one per split', () => {
  const splits = [row('Existing loan refinanced', '666,000'), row('Equity access', '30,000')]

  it('adds every split up', () => {
    expect(lenderTotal(splits)).toBe(696000)
  })

  it('divides the lot by the property value', () => {
    // Clementine: $696,000 against a $980,000 property.
    expect(lenderLvr(splits, '980,000')).toBe(71.1)
  })

  it('gives the same answer however the lender carved it up', () => {
    const folded = [row('One loan', '696,000')]
    expect(lenderLvr(folded, '980,000')).toBe(lenderLvr(splits, '980,000'))
  })

  it('rounds up, so a hair over 80 is not rounded into "no LMI"', () => {
    expect(lenderLvr([row('a', '800,100')], '1,000,000')).toBeGreaterThan(80)
    expect(lenderLvr([row('a', '800,000')], '1,000,000')).toBe(80)
  })

  it('answers zero rather than dividing by nothing', () => {
    expect(lenderLvr(splits, '')).toBe(0)
    expect(lenderLvr(splits, '0')).toBe(0)
    expect(lenderLvr(splits, null)).toBe(0)
  })
})

describe('folding a lender into one loan', () => {
  it('adds the amounts and calls it one loan', () => {
    const out = combineIntoOneLoan([row('Existing loan refinanced', '666,000'), row('Equity access', '30,000')])
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('One loan')
    expect(out[0].amount).toBe('696,000')
  })

  it('keeps the rate and type when every split already agreed', () => {
    const out = combineIntoOneLoan([row('a', '666,000', '5.94', 'P&I'), row('b', '30,000', '5.94', 'P&I')])
    expect(out[0].rate).toBe('5.94')
    expect(out[0].repaymentType).toBe('P&I')
  })

  it('refuses to pick a rate when the splits disagree', () => {
    // Choosing the first would be inventing one. Blank makes the broker answer.
    const out = combineIntoOneLoan([row('a', '666,000', '5.94', 'P&I'), row('b', '30,000', '6.39', 'Interest only')])
    expect(out[0].rate).toBe('')
    expect(out[0].repaymentType).toBe('P&I')
  })

  it('always clears the repayment, because a merged loan has a new one', () => {
    const out = combineIntoOneLoan([row('a', '666,000'), row('b', '30,000')])
    expect(out[0].repayment).toBe('')
  })

  it('leaves the LVR alone entirely - it is calculated', () => {
    expect(combineIntoOneLoan([row('a', '666,000')])[0].lvr).toBe('')
  })

  it('does nothing to an empty lender', () => {
    expect(combineIntoOneLoan([])).toEqual([])
    expect(combineIntoOneLoan(null)).toEqual([])
  })

  it('reads an amount however it was typed', () => {
    expect(amountOf('$666,000')).toBe(666000)
    expect(amountOf('30000')).toBe(30000)
    expect(amountOf('')).toBe(0)
  })
})
