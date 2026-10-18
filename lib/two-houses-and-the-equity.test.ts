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

  it('reads as the mock Fabio approved', () => {
    expect(rows).toEqual([
      '10 Example Road, Mango Hill QLD 4509 — valued at $830,000',
      'Existing loan balance $495,000',
      'Limit against this property $495,000',
      'Refinanced loan $495,000',
      '6.14% p.a.* · Interest only for 5 years, then principal and interest for 25 · $2,533 per month',
      'LVR 59.6%',
      '15 Sample Street, Wynnum West QLD 4178 — valued at $995,000',
      'Existing loan balance $506,000',
      'Equity released $290,000',
      'Limit against this property $796,000',
      'Refinanced loan $506,000',
      '6.14% p.a.* · Interest only for 5 years, then principal and interest for 25 · $2,589 per month',
      'Equity release $290,000',
      '6.89% p.a.* · Interest only for 5 years, then principal and interest for 25 · $1,665 per month',
      'LVR 80%',
    ])
  })

  // THE FAULT OF 16 OCTOBER. money(0) is "$0" and rowIf reads that as a figure.
  it('the house releasing nothing has no equity row, not a zero one', () => {
    const first = rows.slice(0, rows.findIndex(r => /Sample Street/.test(r)))
    expect(first.join(' | ')).not.toContain('Equity released')
    expect(rows.join(' | ')).not.toContain('$0')
  })

  it('both loans on one house are listed - neither is buried', () => {
    expect(rows.filter(r => /^Refinanced loan/.test(r))).toHaveLength(2)
    expect(rows).toContain('Equity release $290,000')
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
