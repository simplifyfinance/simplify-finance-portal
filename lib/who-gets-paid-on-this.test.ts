// WHOSE DEAL IS THIS, FOR THE PURPOSE OF WRITING TO SOMEBODY ABOUT IT.
//
// THE FOUR REAL SPLITS, 12 Nov 2026. These are the live arrangements and the
// whole reason this file exists, so they are the fixture rather than invented
// ones - the bug was in the shape of these four, not in a hypothetical.
import { describe, it, expect } from 'vitest'
import {
  dealsFor, linesOf, partiesOf, paysThem, shareOf, splitIdsThatPay, splitsThatPay,
} from './who-gets-paid-on-this'

const NAVIGATE = {
  id: 'nav', name: 'Navigate Advisors', kind: 'referrer',
  lines: [
    { who: 'Justin Cornock', upfront: 60, trail: 40 },
    { who: 'Simplify Finance Brokers', upfront: 20, trail: 20 },
    { who: 'Navigate Advisors', upfront: 20, trail: 40 },
  ],
}
const JUSTIN_REFERRAL = {
  id: 'jref', name: 'Simplify - Justin Cornock referral', kind: 'referrer',
  lines: [
    { who: 'Justin Cornock', upfront: 50, trail: 50 },
    { who: 'Simplify Finance', upfront: 50, trail: 50 },
  ],
}
// THE ONE THAT LOOKS LIKE HIS AND IS NOT.
const SIMPLIFY_NAVIGATE = {
  id: 'snav', name: 'Simplify - Navigate Advisors', kind: 'referrer',
  lines: [
    { who: 'Navigate Advisors', upfront: 20, trail: 50 },
    { who: 'Simplify Finance', upfront: 80, trail: 50 },
  ],
}
const SFB_JUSTIN = {
  id: 'sfbj', name: 'Simplify Finance Brokers - Justin Cornock', kind: 'referrer',
  lines: [
    { who: 'Simplify Finance Brokers', upfront: 20, trail: 20 },
    { who: 'Justin Cornock', upfront: 80, trail: 80 },
  ],
}
const ALL = [NAVIGATE, JUSTIN_REFERRAL, SIMPLIFY_NAVIGATE, SFB_JUSTIN]

describe('writing to Justin', () => {
  // Fabio, 12 Nov 2026: "do not ever send the one that is marked Simplify
  // Navigate Advisors. As you can see on the commissions tab, he doesn't get
  // paid."
  it('never includes Simplify - Navigate Advisors', () => {
    expect(paysThem(SIMPLIFY_NAVIGATE, 'Justin Cornock')).toBe(false)
    expect(splitsThatPay(ALL, 'Justin Cornock').map(s => s.name))
      .not.toContain('Simplify - Navigate Advisors')
  })

  it('includes all three that actually pay him', () => {
    expect(splitsThatPay(ALL, 'Justin Cornock').map(s => s.id))
      .toEqual(['nav', 'jref', 'sfbj'])
  })

  it('carries his share, not the split total', () => {
    expect(shareOf(NAVIGATE, 'Justin Cornock')).toEqual({ upfront: 60, trail: 40 })
    expect(shareOf(SFB_JUSTIN, 'Justin Cornock')).toEqual({ upfront: 80, trail: 80 })
    expect(shareOf(SIMPLIFY_NAVIGATE, 'Justin Cornock')).toBe(null)
  })
})

describe('writing to Navigate', () => {
  // "you need to find all the deals that has Simplify Navigate Advisory as a
  // commission, and also the Navigate Advisory's commissions."
  it('includes both of the Navigate arrangements', () => {
    expect(splitsThatPay(ALL, 'Navigate Advisors').map(s => s.id)).toEqual(['nav', 'snav'])
  })

  it('and nothing of Justin’s own', () => {
    expect(splitsThatPay(ALL, 'Navigate Advisors').map(s => s.name))
      .not.toContain('Simplify - Justin Cornock referral')
  })
})

describe('the rule is the payment lines, never the name', () => {
  // THE WHOLE POINT. Rename a split tomorrow and the right people still get
  // the right deals.
  it('survives a split being renamed', () => {
    const renamed = { ...SIMPLIFY_NAVIGATE, name: 'Justin / Navigate 2027' }
    expect(paysThem(renamed, 'Justin Cornock')).toBe(false)
    expect(paysThem(renamed, 'Navigate Advisors')).toBe(true)
  })

  it('picks up a fifth split nobody told us about', () => {
    const extra = {
      id: 'new', name: 'Whatever This Ends Up Called',
      lines: [{ who: 'Justin Cornock', upfront: 30, trail: 30 }],
    }
    expect(splitsThatPay([...ALL, extra], 'Justin Cornock').map(s => s.id))
      .toEqual(['nav', 'jref', 'sfbj', 'new'])
  })

  it('does not care about case or stray spaces', () => {
    expect(paysThem(NAVIGATE, '  justin   cornock ')).toBe(true)
  })

  it('is not fooled by half a name', () => {
    expect(paysThem(NAVIGATE, 'Justin')).toBe(false)
    expect(paysThem(NAVIGATE, 'Cornock')).toBe(false)
    expect(paysThem(NAVIGATE, '')).toBe(false)
  })
})

describe('the shapes a split can arrive in', () => {
  it('reads the old one-party shape', () => {
    const old = { id: 'o', name: 'An old one', who: 'Justin Cornock', upfront: 20, trail: 20 }
    expect(linesOf(old)).toHaveLength(1)
    expect(paysThem(old, 'Justin Cornock')).toBe(true)
  })

  it('survives a split with no lines at all', () => {
    expect(linesOf({ id: 'x', name: 'Empty' })).toEqual([])
    expect(paysThem({ id: 'x' }, 'Justin Cornock')).toBe(false)
    expect(paysThem(null, 'Justin Cornock')).toBe(false)
  })

  // A MISSING PERCENTAGE IS NOT ZERO. Null means nobody wrote it down, and
  // being named on the split is enough to be told about the deal.
  it('counts somebody named with no percentages written down', () => {
    expect(paysThem({ lines: [{ who: 'Justin Cornock' }] }, 'Justin Cornock')).toBe(true)
  })

  it('does not count a line that is explicitly nothing', () => {
    expect(paysThem({ lines: [{ who: 'Justin Cornock', upfront: 0, trail: 0 }] }, 'Justin Cornock'))
      .toBe(false)
  })

  it('counts upfront-only, which is a real arrangement', () => {
    expect(paysThem({ lines: [{ who: 'Justin Cornock', upfront: 20, trail: 0 }] }, 'Justin Cornock'))
      .toBe(true)
  })
})

describe('everyone a split names', () => {
  it('is offered as a list, once each, in order', () => {
    expect(partiesOf(ALL)).toEqual([
      'Justin Cornock', 'Navigate Advisors', 'Simplify Finance', 'Simplify Finance Brokers',
    ])
  })
})

describe('the deals themselves', () => {
  const deals = [
    { id: 'd1', split: { id: 'nav' } },
    { id: 'd2', split: { id: 'snav' } },
    { id: 'd3', split: { id: 'jref' } },
    { id: 'd4', split: null },
  ]
  const splitOf = (d: any) => d.split

  it('are Justin’s where a split that pays him is on them', () => {
    expect(dealsFor(deals, ALL, 'Justin Cornock', splitOf).map(d => d.id)).toEqual(['d1', 'd3'])
  })

  it('and Navigate’s on the other reading of the same book', () => {
    expect(dealsFor(deals, ALL, 'Navigate Advisors', splitOf).map(d => d.id)).toEqual(['d1', 'd2'])
  })

  it('matches on the name where that is all the deal carries', () => {
    const byName = [{ id: 'd9', split: { name: 'Simplify - Navigate Advisors' } }]
    expect(dealsFor(byName, ALL, 'Navigate Advisors', splitOf).map(d => d.id)).toEqual(['d9'])
    expect(dealsFor(byName, ALL, 'Justin Cornock', splitOf)).toEqual([])
  })

  it('is nothing at all for somebody no split pays', () => {
    expect(dealsFor(deals, ALL, 'Kylie Searle', splitOf)).toEqual([])
    expect(splitIdsThatPay(ALL, 'Nobody At All')).toEqual([])
  })
})
