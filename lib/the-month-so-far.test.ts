// THE WEEK COUNTS DEALS. THE MONTH COUNTS DOLLARS.
//
// 17 Nov 2026. Fabio: "we always focus on a weekly basis how many deals are we
// lodging, because we can control that. Okay, but it's also good to know how
// are we tracking against our target, which is a dollar figure."
import { describe, it, expect } from 'vitest'
import {
  monthOf, monthName, monthRowKey, monthLodged, lodgedTarget, money,
} from './the-month-so-far'

describe('reading a month', () => {
  it('off a date or a timestamp', () => {
    expect(monthOf('2026-11-17')).toBe('2026-11')
    expect(monthOf('2026-11-17T09:00:00Z')).toBe('2026-11')
  })

  it('and nothing from nothing', () => {
    expect(monthOf('')).toBe('')
    expect(monthOf('sometime')).toBe('')
  })

  it('names it the way a person says it', () => {
    expect(monthName('2026-11')).toBe('November')
    expect(monthName('nope')).toBe('')
  })

  it('and keys it the way the targets table stores it', () => {
    expect(monthRowKey('2026-11')).toBe('2026-11-01')
    expect(monthRowKey('2026-11-17')).toBe('')
  })
})

describe('what was lodged in the month', () => {
  const deals = [
    { lodged_at: '2026-11-03', loan_amount: 500000 },
    { lodged_at: '2026-11-20T00:00:00Z', loan_amount: 300000 },
    { lodged_at: '2026-10-28', loan_amount: 900000 },
    { loan_amount: 400000 },
  ]

  it('adds up only that month', () => {
    expect(monthLodged(deals, '2026-11')).toBe(800000)
  })

  // A figure that shrank as deals progressed would be the strangest bar in
  // the portal.
  it('and a deal that has since settled still counts', () => {
    const settled = [{ lodged_at: '2026-11-03', loan_amount: 500000,
                       settled_at: '2026-11-14', settled_total: 505000 }]
    expect(monthLodged(settled, '2026-11')).toBeGreaterThan(0)
  })

  it('nothing lodged is nothing, not a crash', () => {
    expect(monthLodged([], '2026-11')).toBe(0)
    expect(monthLodged(null as any, '2026-11')).toBe(0)
  })
})

describe('the target', () => {
  const rows = [
    { metric: 'lodged', month: '2026-11-01', broker_key: null, amount: 12000000 },
    { metric: 'settled', month: '2026-11-01', broker_key: null, amount: 25000000 },
    { metric: 'lodged', month: '2026-11-01', broker_key: 'fabio', amount: 5000000 },
    { metric: 'lodged', month: '2026-10-01', broker_key: null, amount: 9000000 },
  ]

  it('is the lodged row for that month, across the whole business', () => {
    expect(lodgedTarget(rows, '2026-11')).toBe(12000000)
  })

  // ONE BROKER'S SHARE IS NOT THE BUSINESS TARGET.
  it('never a single broker\'s share', () => {
    expect(lodgedTarget([rows[2]], '2026-11')).toBe(null)
  })

  it('never the settled target', () => {
    expect(lodgedTarget([rows[1]], '2026-11')).toBe(null)
  })

  it('and nothing where nobody has set one', () => {
    expect(lodgedTarget([], '2026-11')).toBe(null)
    expect(lodgedTarget(rows, '2026-12')).toBe(null)
  })
})

describe('the figure on the bar', () => {
  it('is short enough to sit under a target', () => {
    expect(money(8400000)).toBe('$8.4m')
    expect(money(420000)).toBe('$420k')
    expect(money(null)).toBe('-')
  })
})
