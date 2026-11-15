// "EVERYHTIG PASSES THROUGH FORMAL." — Fabio, 17 Nov 2026.
//
// He first said it depended - the offer figures on a purchase, the lending
// options on a refinance - then corrected himself a minute later: "actually
// formal approval tab is always the data to be used sorry."
//
// The two answers were never different. The formal snapshot already starts from
// the offer rather than from lodgement, so on a purchase it IS the offer
// figures, and on a refinance it is the lending options.
import { describe, it, expect } from 'vitest'
import {
  formalSnapshot, expectedFromFormal, borrowersOf, securityOf, checkedAgainst, NO_FORMAL,
} from './what-formal-approval-said'

const rows = [
  { stage: 'lodged', lender: 'CBA', splits: [{ label: 'Split 1', amount: '420000', rate: '6.40', type: 'P&I' }] },
  { stage: 'formal', lender: 'CBA', splits: [
    { label: 'Split 1', amount: '340600', rate: '6.14', type: 'Interest only' },
    { label: 'Split 2', amount: '57600', rate: '6.14', type: 'P&I' },
  ] },
]

const deal = {
  formal_approval_at: '2026-11-11T04:00:00Z',
  bc_data: { template: 'refinance_only', splits: [
    { id: 's1', label: 'Split 1', amount: '340600', rate: '6.14', termYears: '30', ioYears: '5' },
    { id: 's2', label: 'Split 2', amount: '57600', rate: '6.14', termYears: '30', ioYears: '' },
  ] },
  fact_find_data: {
    applicants: [{ firstName: 'Daniel', lastName: 'Okafor' }, { firstName: 'Priya', lastName: 'Raman' }],
    properties: [{ id: 'p1', address: '14 Marrack St, Kingswood NSW 2747, Australia',
      loans: [{ lenderName: 'CBA', balance: '395899', status: 'To be refinanced' }] }],
  },
  lo_data: { recommendedLender: 'CBA', lenders: [] },
  compliance_data: {},
}

describe('the formal snapshot', () => {
  it('is picked out of whatever the table handed back', () => {
    const s = formalSnapshot(rows)!
    expect(s.lender).toBe('CBA')
    expect(s.splits).toHaveLength(2)
  })

  // THE LODGED ONE IS A PREAPPROVAL FIGURE AND IS NOT WHAT A CONTRACT IS
  // MEASURED AGAINST.
  it('and never the lodged one', () => {
    expect(formalSnapshot(rows)!.splits![0].amount).toBe('340600')
  })

  it('nothing recorded is null, and it says so rather than falling back', () => {
    expect(formalSnapshot([{ stage: 'lodged', splits: [] }])).toBe(null)
    expect(formalSnapshot(null)).toBe(null)
    expect(NO_FORMAL).toContain('nothing to check the contract against')
  })
})

describe('what the deal says each loan should be', () => {
  const want = expectedFromFormal(deal, formalSnapshot(rows))

  it('one per split on the snapshot, in its order', () => {
    expect(want).toHaveLength(2)
    expect(want[0].label).toBe('Split 1')
    expect(want[1].label).toBe('Split 2')
  })

  it('carrying the amount, rate and repayment type off the snapshot', () => {
    expect(want[0].amount).toBe('340600')
    expect(want[0].rate).toBe('6.14')
    expect(want[0].repayment).toBe('Interest only')
  })

  // THE SNAPSHOT DOES NOT HOLD A TERM, and Fabio asked for the term to be
  // checked. It comes off the deal's own splits.
  it('and the term and interest only period off the deal', () => {
    expect(want[0].loanTerm).toBe('30')
    expect(want[0].ioTerm).toBe('5')
    expect(want[1].ioTerm).toBe('')
  })

  it('the security and the borrowers are the same on every split', () => {
    expect(want[0].security).toContain('14 Marrack St')
    expect(want[0].borrowers).toEqual(['Daniel Okafor', 'Priya Raman'])
    expect(want[1].borrowers).toEqual(want[0].borrowers)
  })

  it('and with no formal approval there is nothing to check against', () => {
    expect(expectedFromFormal(deal, null)).toEqual([])
  })
})

describe('the pieces it reads', () => {
  it('everyone on the deal, as a contract would name them', () => {
    expect(borrowersOf(deal)).toEqual(['Daniel Okafor', 'Priya Raman'])
    expect(borrowersOf({})).toEqual([])
  })

  it('the security, or all of them where there are several', () => {
    expect(securityOf(deal)).toBe('14 Marrack St, Kingswood NSW 2747')
  })

  // SO NOBODY HAS TO WONDER WHAT IT WAS MEASURED AGAINST.
  it('and the screen says what it checked against, and when', () => {
    expect(checkedAgainst(deal, () => '11 Nov')).toBe(
      'Checked against the formal approval recorded on 11 Nov.')
    expect(checkedAgainst({}, () => '')).toBe('Checked against the formal approval.')
  })
})
