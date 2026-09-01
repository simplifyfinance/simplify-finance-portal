import { describe, it, expect } from 'vitest'
import {
  loanIdRows, applyLoanIds, loanIdStatus, cleanLoanId, sameLoanId, QUIET_DAYS,
} from './loan-id'

const AT = (iso: string) => new Date(iso + 'T00:00:00Z')
const settled = (o: any = {}) => ({ settled_at: '2026-08-01', settled_total: 500000, ...o })

describe('one box per split, one box when there are none', () => {
  it('a single loan gets one box carrying the settled total', () => {
    const rows = loanIdRows(settled())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ label: 'Loan', amount: 500000, loanId: '' })
  })

  it('two splits get two boxes, named and priced', () => {
    const rows = loanIdRows(settled({
      settled_splits: [
        { label: 'Owner occupied P&I', amount: 340000 },
        { label: 'Investment IO', amount: 160000 },
      ],
    }))
    expect(rows.map(r => r.label)).toEqual(['Owner occupied P&I', 'Investment IO'])
    expect(rows.map(r => r.amount)).toEqual([340000, 160000])
  })

  it('an unnamed split is still identifiable', () => {
    const rows = loanIdRows(settled({ settled_splits: [{ amount: 340000 }, { amount: 160000 }] }))
    expect(rows.map(r => r.label)).toEqual(['Split 1', 'Split 2'])
  })

  it('empty rows left behind by the settlement form are not asked about', () => {
    const rows = loanIdRows(settled({
      settled_splits: [{ label: 'Main', amount: 500000 }, { label: '', amount: '' }],
    }))
    expect(rows).toHaveLength(1)
  })
})

describe('writing them back', () => {
  it('keeps each Loan ID on the split it was issued against', () => {
    const deal = settled({ settled_splits: [{ label: 'A', amount: 340000 }, { label: 'B', amount: 160000 }] })
    const out = applyLoanIds(deal, ['4852124', '4852125'])
    expect(out).toEqual([
      { label: 'A', amount: 340000, loanId: '4852124' },
      { label: 'B', amount: 160000, loanId: '4852125' },
    ])
  })

  it('does not disturb the amount, rate or repayment type already recorded', () => {
    const deal = settled({ settled_splits: [{ label: 'A', amount: 340000, rate: '5.94', type: 'P&I' }] })
    expect(applyLoanIds(deal, ['x1'])[0]).toEqual({ label: 'A', amount: 340000, rate: '5.94', type: 'P&I', loanId: 'x1' })
  })

  it('a deal with no splits gets one entry holding the whole loan', () => {
    const out = applyLoanIds(settled(), ['4852124'])
    expect(out).toEqual([{ amount: 500000, loanId: '4852124' }])
  })

  it('round-trips: what is written back is what is read out', () => {
    const deal = settled({ settled_splits: [{ label: 'A', amount: 340000 }, { label: 'B', amount: 160000 }] })
    const next = { ...deal, settled_splits: applyLoanIds(deal, ['4852124', '4852125']) }
    expect(loanIdRows(next).map(r => r.loanId)).toEqual(['4852124', '4852125'])
  })

  it('blanking one out removes it rather than leaving the old number', () => {
    const deal = settled({ settled_splits: [{ label: 'A', amount: 1, loanId: 'old' }] })
    expect(applyLoanIds(deal, [''])[0].loanId).toBe('')
  })
})

describe('what the bank gives you is taken as given', () => {
  it('strips pasted spaces but nothing else', () => {
    expect(cleanLoanId('  485 2124 ')).toBe('4852124')
    expect(cleanLoanId('771-4490223')).toBe('771-4490223')
    expect(cleanLoanId('ANZ/88231')).toBe('ANZ/88231')
  })

  it('matches the same loan written two ways', () => {
    expect(sameLoanId('771-4490223', '7714490223')).toBe(true)
    expect(sameLoanId('anz/88231', 'ANZ 88231')).toBe(true)
  })

  it('never matches nothing against nothing', () => {
    expect(sameLoanId('', '')).toBe(false)
    expect(sameLoanId(null, undefined)).toBe(false)
    expect(sameLoanId('4852124', '4852125')).toBe(false)
  })
})

describe('when it starts asking', () => {
  it('says nothing before the deal settles', () => {
    expect(loanIdStatus({ settled_total: 500000 }).tone).toBe('not_settled')
  })

  it('stays quiet for the first fortnight - the RCTI is a month away', () => {
    const s = loanIdStatus(settled(), AT('2026-08-04'))
    expect(s.tone).toBe('quiet')
    expect(s.label).toBe('Loan ID needed')
    expect(s.days).toBe(3)
  })

  it('the day before the threshold is still quiet', () => {
    const s = loanIdStatus(settled(), AT('2026-08-15'))
    expect(s.days).toBe(14)
    expect(s.tone).toBe('quiet')
  })

  it('goes amber on day 15, leaving a fortnight to chase the bank', () => {
    const s = loanIdStatus(settled(), AT('2026-08-16'))
    expect(s.days).toBe(15)
    expect(QUIET_DAYS).toBe(15)
    expect(s.tone).toBe('amber')
    expect(s.label).toContain('RCTI is due')
  })

  it('counts how many of several splits are still missing', () => {
    const deal = settled({
      settled_splits: [{ label: 'A', amount: 1, loanId: '4852124' }, { label: 'B', amount: 2 }],
    })
    const s = loanIdStatus(deal, AT('2026-08-04'))
    expect(s.missing).toBe(1)
    expect(s.total).toBe(2)
    expect(s.label).toBe('1 of 2 Loan IDs needed')
  })

  it('goes quiet again once every split has one', () => {
    const deal = settled({
      settled_splits: [{ label: 'A', amount: 1, loanId: 'x' }, { label: 'B', amount: 2, loanId: 'y' }],
    })
    expect(loanIdStatus(deal, AT('2026-12-01')).tone).toBe('complete')
  })

  it('a deal settled long ago with nothing entered is amber, not silent', () => {
    expect(loanIdStatus(settled(), AT('2027-01-01')).tone).toBe('amber')
  })
})
