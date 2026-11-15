import { describe, it, expect } from 'vitest'
import {
  bucketOf, sliceFor, settledTarget, businessMonths, againstTarget,
} from './the-settlements-month'

const M = '2026-11'
const BROKERS = [
  { broker_key: 'fabio', name: 'Fabio De Castro', brand_ids: ['simplify'] },
  { broker_key: 'justin', name: 'Justin Cornock', brand_ids: ['sfb'] },
]
const BRANDS = [{ id: 'simplify', name: 'Simplify Finance' }, { id: 'sfb', name: 'Simplify Finance Brokers' }]

const deal = (over: any) => ({ assigned_broker: 'fabio', loan_amount: 500000, ...over })

describe('which bucket a deal is in', () => {
  it('settled, when it settled in the month', () => {
    expect(bucketOf(deal({ settled_at: '2026-11-04' }), M)).toBe('settled')
  })

  // A settled deal is settled whatever else is recorded against it.
  it('and a deal settled in another month is in no bucket at all', () => {
    expect(bucketOf(deal({ settled_at: '2026-10-28' }), M)).toBe(null)
  })

  it('booked, on a confirmed date', () => {
    expect(bucketOf(deal({ formal_approval_at: '2026-10-01', confirmed_settlement_date: '2026-11-24' }), M))
      .toBe('booked')
  })

  // Nobody has accepted an expected date. It is not the same promise.
  it('expected, on an expected date only', () => {
    expect(bucketOf(deal({ formal_approval_at: '2026-10-01', expected_settlement_date: '2026-11-24' }), M))
      .toBe('expected')
  })

  it('and confirmed beats expected where both are set', () => {
    expect(bucketOf(deal({ formal_approval_at: '2026-10-01',
      confirmed_settlement_date: '2026-11-24', expected_settlement_date: '2026-11-30' }), M)).toBe('booked')
  })

  // The same thing the spreadsheet does by hand under "do not include on
  // projections".
  it('a pre-formal refinance is the forecast, not the total', () => {
    expect(bucketOf(deal({ transaction_type: 'refinance', expected_settlement_date: '2026-11-20' }), M))
      .toBe('forecast')
  })

  it('and a pre-formal purchase is nothing at all', () => {
    expect(bucketOf(deal({ transaction_type: 'purchase', expected_settlement_date: '2026-11-20' }), M))
      .toBe(null)
  })

  // A DEAL WITH NO DATE BELONGS TO NO MONTH and is never adopted into this one.
  it('no date is no month', () => {
    expect(bucketOf(deal({ formal_approval_at: '2026-10-01' }), M)).toBe(null)
  })
})

describe('the month added up', () => {
  const deals = [
    deal({ settled_at: '2026-11-04', loan_amount: 300000 }),
    deal({ formal_approval_at: '2026-10-01', confirmed_settlement_date: '2026-11-24', loan_amount: 500000 }),
    deal({ formal_approval_at: '2026-10-01', expected_settlement_date: '2026-11-28', loan_amount: 200000 }),
    deal({ transaction_type: 'refinance', expected_settlement_date: '2026-11-30', loan_amount: 900000 }),
  ]

  it('is settled plus booked plus expected', () => {
    const s = sliceFor(deals, M, [])
    expect(s.settled).toBe(300000)
    expect(s.booked).toBe(500000)
    expect(s.expected).toBe(200000)
    expect(s.onTrack).toBe(1000000)
  })

  // IT MUST NOT FLATTER THE MONTH.
  it('and the forecast is counted but never added in', () => {
    const s = sliceFor(deals, M, [])
    expect(s.forecast).toBe(900000)
    expect(s.onTrack).toBe(1000000)
  })
})

describe('the target', () => {
  const rows = [
    { metric: 'settled', month: '2026-11-01', broker_key: null, amount: 25000000 },
    { metric: 'settled', month: '2026-11-01', broker_key: 'fabio', amount: 18000000 },
    { metric: 'settled', month: '2026-11-01', broker_key: 'justin', amount: 7000000 },
    { metric: 'lodged', month: '2026-11-01', broker_key: null, amount: 12000000 },
  ]

  it('for the whole book is the business-wide row', () => {
    expect(settledTarget(rows, M)).toBe(25000000)
  })

  it('for one business is its brokers added up', () => {
    expect(settledTarget(rows, M, 'simplify', BROKERS)).toBe(18000000)
    expect(settledTarget(rows, M, 'sfb', BROKERS)).toBe(7000000)
  })

  // A ZERO WOULD READ AS "AIMING AT NOTHING".
  it('and nothing where nobody has set one', () => {
    expect(settledTarget([], M)).toBe(null)
    expect(settledTarget(rows, M, 'nobody', BROKERS)).toBe(null)
  })

  it('never the lodged target', () => {
    expect(settledTarget([rows[3]], M)).toBe(null)
  })

  it('and the percentage only where there is one', () => {
    expect(againstTarget({ ...sliceFor([], M, []), onTrack: 5, target: 10 })).toBe(50)
    expect(againstTarget({ ...sliceFor([], M, []), onTrack: 5, target: null })).toBe(null)
  })
})

describe('split by business', () => {
  const deals = [
    deal({ assigned_broker: 'fabio', settled_at: '2026-11-04', loan_amount: 400000 }),
    deal({ assigned_broker: 'justin', settled_at: '2026-11-05', loan_amount: 100000 }),
  ]

  it('each business gets its own, biggest first', () => {
    const out = businessMonths(deals, M, [], BROKERS, BRANDS)
    expect(out.map(b => b.name)).toEqual(['Simplify Finance', 'Simplify Finance Brokers'])
    expect(out[0].slice.settled).toBe(400000)
    expect(out[1].slice.settled).toBe(100000)
  })

  // NOTHING IS COUNTED TWICE. The businesses add up to the book.
  it('and together they are the whole book', () => {
    const out = businessMonths(deals, M, [], BROKERS, BRANDS)
    const sum = out.reduce((t, b) => t + b.slice.onTrack, 0)
    expect(sum).toBe(sliceFor(deals, M, []).onTrack)
  })
})
