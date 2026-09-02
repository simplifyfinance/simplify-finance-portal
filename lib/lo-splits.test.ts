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
