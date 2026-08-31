import { describe, it, expect } from 'vitest'
import { buildClawback, type UpfrontLine } from './clawback'

const CBA = 'lender-cba', ANZ = 'lender-anz'
const monthsByLender = new Map([[CBA, 24], [ANZ, 12]])
const nameByLender = new Map([[CBA, 'CBA'], [ANZ, 'ANZ']])
const TODAY = '2026-08-31'

const line = (o: Partial<UpfrontLine>): UpfrontLine => ({
  loan_ref: 'L1', client_name: 'Smith', broker_key: 'fabio', lender_id: CBA,
  lender_raw: 'Commonwealth Bank', settlement_date: '2026-01-15',
  settlement_amount: 500000, gross_ex_gst: 3250, ...o,
})

const run = (upfronts: UpfrontLine[], clawedBackRefs: (string | null)[] = []) =>
  buildClawback({ upfronts, clawedBackRefs, monthsByLender, nameByLender, today: TODAY })

describe('clawback window', () => {
  it('keeps a loan whose window is still open and dates it from the settlement', () => {
    const { rows } = run([line({})])
    expect(rows).toHaveLength(1)
    expect(rows[0].ends_on).toBe('2028-01-15')      // 24 months
    expect(rows[0].upfront).toBe(3250)
    expect(rows[0].lender).toBe('CBA')
  })

  it('drops a loan whose window has already closed', () => {
    // ANZ is 12 months, settled well over a year ago.
    expect(run([line({ lender_id: ANZ, settlement_date: '2024-06-01' })]).rows).toHaveLength(0)
  })

  it('keeps one settling exactly today and drops one closing yesterday', () => {
    const open = run([line({ lender_id: ANZ, settlement_date: '2025-08-31' })]).rows
    expect(open).toHaveLength(1)
    expect(open[0].days_left).toBe(0)
    expect(run([line({ lender_id: ANZ, settlement_date: '2025-08-30' })]).rows).toHaveLength(0)
  })

  it('adds up two lines on the same loan instead of listing it twice', () => {
    const { rows } = run([
      line({ gross_ex_gst: 3250 }),
      line({ gross_ex_gst: 900, settlement_date: '2026-03-01' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].upfront).toBe(4150)
    expect(rows[0].settled_on).toBe('2026-01-15')   // the window runs from the earliest
  })

  it('leaves out a loan that has already been clawed back', () => {
    expect(run([line({})], ['L1']).rows).toHaveLength(0)
  })

  it('uses the upfront that was actually paid, not one worked out from a rate', () => {
    // A discounted or adjusted upfront must come through untouched.
    expect(run([line({ gross_ex_gst: 1.5 })]).rows[0].upfront).toBe(1.5)
  })

  it('calls an unmatched lender unknown rather than treating it as safe', () => {
    const { rows, unknown } = run([line({ lender_id: null, lender_raw: 'Some Lender Pty Ltd' })])
    expect(rows).toHaveLength(0)
    expect(unknown).toHaveLength(1)
    expect(unknown[0].lender).toBe('Some Lender Pty Ltd')
    expect(unknown[0].reason).toContain('not in the rate register')
  })

  it('calls a line with no settlement date unknown, not zero', () => {
    const { rows, unknown } = run([line({ settlement_date: null })])
    expect(rows).toHaveLength(0)
    expect(unknown[0].reason).toContain('no settlement date')
  })

  it('quietly skips a lender that genuinely has no clawback period', () => {
    const { rows, unknown } = run([line({ lender_id: 'lender-none' })])
    expect(rows).toHaveLength(0)
    expect(unknown).toHaveLength(0)        // nothing to watch is not a problem to report
  })

  it('sorts the closest to clearing first', () => {
    const { rows } = run([
      line({ loan_ref: 'far', settlement_date: '2026-06-01' }),
      line({ loan_ref: 'near', lender_id: ANZ, settlement_date: '2025-10-01' }),
    ])
    expect(rows.map(r => r.loanRef)).toEqual(['near', 'far'])
  })

  it('does not invent a row from a line with no loan account', () => {
    expect(run([line({ loan_ref: null })]).rows).toHaveLength(0)
  })
})
