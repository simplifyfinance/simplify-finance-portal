import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { equityBoxes, securedTotalLine } from '../app/api/generate-email/route'

// REFINANCE + EQUITY RELEASE, SECURED BY TWO HOUSES.
//
// 16 Oct 2026 this template was given the Complex refinance layout the moment
// securities were ticked. Fabio: "that is not an approved template." It went
// back to its single-property email and stayed there until this was drawn,
// mocked and approved - 18 Oct, "Ok with mock up lets go".
//
// Rendered and read, not grepped. That is the whole reason this file renders
// HTML: a test that greps the route passes while the email is wrong, which is
// how "Equity released $0" reached a client.

const D = {
  template: 'refinance_equity', loanTerm: '30',
  securityIds: ['p1', 'p2'],
  securityBalances: { p1: '495,000', p2: '506,000' },
  securityReleases: { p2: '290,000' },          // p1 releases nothing
  securityLimits: { p1: '495,000', p2: '796,000' },
  ffProperties: [
    { id: 'p1', address: '10 Example Road, Mango Hill QLD 4509', value: '830,000' },
    { id: 'p2', address: '15 Sample Street, Wynnum West QLD 4178', value: '995,000' },
  ],
  splits: [
    { label: 'Refinanced loan', amount: '495,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: 'p1' },
    { label: 'Refinanced loan', amount: '506,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: 'p2' },
    { label: 'Equity release', amount: '290,000', rate: '6.89', type: 'Interest only', ioYears: '5', securityId: 'p2' },
  ],
}

const readRows = (html: string): string[] =>
  html.replace(/<\/tr>/g, '\n').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&amp;/g, '&')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

describe('two houses, and the equity under the one it comes from', () => {
  const rows = readRows(equityBoxes(D))

  // 12 NOV 2026, AND THIS IS THE SECOND TIME THIS CARD HAS BEEN APPROVED.
  //
  // The 18 October shape is above in the git history: a limit row, then each
  // loan as one row carrying its typed label with the rate and repayment on an
  // italic line underneath. It was sound. What was not sound is that the
  // REFINANCE ONLY card drew the same thing a different way - it inlined the
  // first loan and tacked the rest on - and Karen Terry's second loan went to
  // a client looking like a property. See lib/loans-against-a-house.ts.
  //
  // So both cards now ask one function, and this is what it draws. Fabio was
  // shown the one-loan house and the two-loan house side by side with the
  // October layout before a line of this was changed: "Match the refinance
  // card."
  //
  // THE ONE-LOAN HOUSE LOST A REPEATED FIGURE. It used to print $495,000 as
  // the limit and again as the loan, because with one loan they are the same
  // number.
  it('reads as the mock Fabio approved', () => {
    expect(rows).toEqual([
      '10 Example Road, Mango Hill QLD 4509 — valued at $830,000',
      'Existing loan balance $495,000',
      'Limit against this property $495,000',
      'Indicative rate 6.14% p.a.*',
      'Estimated repayments $2,533',
      'Repayment type Interest only for 5 years, then principal and interest for 25',
      'Loan term 30 years',
      'LVR 59.6%',
      '15 Sample Street, Wynnum West QLD 4178 — valued at $995,000',
      'Existing loan balance $506,000',
      'Equity released $290,000',
      'Limit against this property $796,000',
      'Loan 1 — Refinanced loan',
      'New loan amount $506,000',
      'Indicative rate 6.14% p.a.*',
      'Estimated repayments $2,589',
      'Repayment type Interest only for 5 years, then principal and interest for 25',
      'Loan term 30 years',
      'Loan 2 — Equity release',
      'New loan amount $290,000',
      'Indicative rate 6.89% p.a.*',
      'Estimated repayments $1,665',
      'Repayment type Interest only for 5 years, then principal and interest for 25',
      'Loan term 30 years',
      'LVR 80%',
    ])
  })

  // THE FAULT OF 16 OCTOBER. money(0) is "$0" and rowIf reads that as a figure.
  it('the house releasing nothing has no equity row, not a zero one', () => {
    const first = rows.slice(0, rows.findIndex(r => /Sample Street/.test(r)))
    expect(first.join(' | ')).not.toContain('Equity released')
    expect(rows.join(' | ')).not.toContain('$0')
  })

  // NEITHER IS BURIED, AND EACH IS NAMED AS A LOAN. The typed label is kept
  // where it says something - these two do - and is never the only thing
  // telling a client the row is money. Karen's splits were both named after
  // the house, and that is exactly when a label says nothing at all.
  it('both loans on one house are listed - neither is buried', () => {
    const second = rows.slice(rows.findIndex(r => /Sample Street/.test(r)))
    expect(second).toContain('Loan 1 — Refinanced loan')
    expect(second).toContain('Loan 2 — Equity release')
    expect(second.filter(r => /^New loan amount/.test(r))).toHaveLength(2)
    expect(second).toContain('New loan amount $290,000')
  })

  it('and each house carries its own ratio, not an average', () => {
    expect(rows).toContain('LVR 59.6%')
    expect(rows).toContain('LVR 80%')
  })

  // My mock said 70.8%. 1,291,000 / 1,825,000 is 70.74%. The mock was the thing
  // that was wrong.
  it('with the combined figure in one line underneath', () => {
    expect(readRows(securedTotalLine(D)).join(' ')).toBe(
      'Total lending of $1,291,000 against security of $1,825,000 '
      + '— an overall loan to value ratio of 70.7%.')
  })
})

describe('the branch and the wording', () => {
  const SRC = readFileSync('app/api/generate-email/route.ts', 'utf8')

  it('is chosen by securedByMany, so every single-security deal is untouched', () => {
    expect(SRC).toContain("template === 'refinance_equity' && securedByMany(d)")
    expect(SRC).toContain("} else if (template === 'refinance_equity') {")
  })

  it('opens with the releases added up, not the empty deal-level box', () => {
    expect(SRC).toContain("amt(releaseTotal(d) || '', '[equity amount]')")
  })

  // I invented this sentence writing the mock and refused to ship it until
  // Fabio confirmed it is true of how he writes these - 18 Oct, "yes put the
  // line in". It is his answer, not the portal's inference.
  it('says the properties stand alone, because he confirmed they do', () => {
    expect(SRC).toContain('note(STAND_ALONE_NOTE)')
    const lib = readFileSync('lib/complex-refinance.ts', 'utf8')
    expect(lib).toContain('not cross-collateralised')
    expect(lib).toContain('"yes put the line in."')
  })
})
