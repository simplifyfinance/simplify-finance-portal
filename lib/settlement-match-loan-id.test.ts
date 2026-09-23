import { describe, it, expect } from 'vitest'
import { reconcile, type PortalDeal, type PaidLine } from './settlement-match'

// MATCHING A SETTLED DEAL TO THE MONEY THAT CAME IN.
//
// Until 23 Sep 2026 this was done on the client's NAME, with the lender and the
// settlement amount as backups. The Loan ID - the bank's own number for the
// account, rung for by your team after settlement and printed on the RCTI - was
// collected and read by nothing.
//
// These are behaviour tests, not source checks: they prove the matcher does the
// right thing, not that it contains the right words.

const deal = (o: Partial<PortalDeal> = {}): PortalDeal => ({
  id: 'd1',
  client: 'Thilina Dissanayake Mudiyanselage',
  brokerKey: 'fabio',
  lenderId: 'L-UBANK',
  lender: 'ubank',
  settledOn: '2026-09-03',
  amount: 686700,
  expectedUpfront: 4500,
  expectedReason: null,
  ...o,
})

const line = (o: Partial<PaidLine> = {}): PaidLine => ({
  id: 'p1',
  client: 'DISSANAYAKE, T D',
  brokerKey: 'fabio',
  lenderId: 'L-UBANK',
  lender: 'ubank',
  loanRef: '',
  settlementDate: '2026-09-03',
  settlementAmount: 686700,
  paidExGst: 4500,
  periodMonth: '2026-10',
  ...o,
})

describe('the loan ID decides it', () => {
  it('matches a deal to its payment even when the names look nothing alike', () => {
    const r = reconcile(
      [deal({ loanIds: ['12345678'], client: 'Thilina Dissanayake Mudiyanselage' })],
      [line({ loanRef: '12345678', client: 'SMITH, JOHN', settlementAmount: null })],
    )
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].how).toBe('loan ID')
    expect(r.unpaidDeals).toHaveLength(0)
  })

  it('ignores punctuation and case, because a statement prints them differently', () => {
    const r = reconcile(
      [deal({ loanIds: ['ubk-1234-5678'] })],
      [line({ loanRef: 'UBK12345678', client: 'NOBODY AT ALL', settlementAmount: null })],
    )
    expect(r.matched[0]?.how).toBe('loan ID')
  })

  it('beats a name match on a DIFFERENT line', () => {
    // The name points at one line, the loan ID at another. The ID wins, because
    // everything else in this file is inference and this is the bank's own key.
    const byName = line({ id: 'by-name', loanRef: '', settlementAmount: null })
    const byId   = line({ id: 'by-id', loanRef: '99999', client: 'SOMEONE ELSE', settlementAmount: null })
    const r = reconcile([deal({ loanIds: ['99999'] })], [byName, byId])
    expect(r.matched[0].line.id).toBe('by-id')
    expect(r.unmatchedLines.map(l => l.id)).toEqual(['by-name'])
  })

  it('a loan ID that matches nothing does not stop the name matching', () => {
    const r = reconcile(
      [deal({ loanIds: ['does-not-appear'] })],
      [line({ loanRef: '0000' })],
    )
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].how).not.toBe('loan ID')
  })

  it('a deal with no loan ID recorded behaves exactly as it did before', () => {
    const r = reconcile([deal({ loanIds: [] })], [line()])
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].how).not.toBe('loan ID')
  })

  it('an empty loan ID never matches an empty loan reference', () => {
    // Two blanks are not the same loan. This is the failure that would quietly
    // pair every unreferenced deal with the first unreferenced payment.
    const r = reconcile(
      [deal({ loanIds: [''], client: 'Nobody Here' })],
      [line({ loanRef: '', client: 'Someone Else Entirely', settlementAmount: null })],
    )
    expect(r.matched).toHaveLength(0)
    expect(r.unpaidDeals).toHaveLength(1)
  })

  it('one loan ID per split, and any of them is enough', () => {
    const r = reconcile(
      [deal({ loanIds: ['AAA111', 'BBB222'] })],
      [line({ loanRef: 'BBB222', client: 'UNRECOGNISABLE', settlementAmount: null })],
    )
    expect(r.matched[0]?.how).toBe('loan ID')
  })

  it('does not pay one line to two deals', () => {
    const r = reconcile(
      [deal({ id: 'd1', loanIds: ['SAME'] }), deal({ id: 'd2', loanIds: ['SAME'] })],
      [line({ loanRef: 'SAME', client: 'X', settlementAmount: null })],
    )
    expect(r.matched).toHaveLength(1)
    expect(r.unpaidDeals).toHaveLength(1)
  })
})
