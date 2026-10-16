import { describe, it, expect } from 'vitest'
import { refinanceBoxes, securedTotalLine } from '../app/api/generate-email/route'

// THE FIRST EMAIL TEST IN THIS CODEBASE THAT READS THE RENDERED HTML.
//
// 16 Oct 2026. Every other test of these emails reads the route as SOURCE TEXT
// - "does the file contain this string". That is why a layout fault reaches
// Fabio rather than the ship: a branch can contain every string a test looks
// for and still print "Equity released $0" to a client.
//
// This renders the boxes and reads the rows back out of them.
//
// The deal is Sindy Avard's shape: a straight refinance of two houses, nothing
// released. The mock of this output was approved on 16 Oct before a line of it
// was written - "the html is perfect" - so these assertions are that mock.

const AVARD = {
  template: 'refinance_only', loanTerm: '30',
  securityIds: ['p1', 'p2'],
  securityBalances: { p1: '127,090', p2: '237,392' },
  securityLimits: { p1: '129,000', p2: '240,000' },
  securityReleases: {},
  ffProperties: [
    { id: 'p1', address: '15 Lister Ave, Beresfield NSW 2322, Australia', value: '500,000' },
    { id: 'p2', address: '39 Weingartner Avenue, Tarro NSW 2322', value: '450,000' },
  ],
  splits: [
    { label: 'Refinanced Loan', amount: '129,000', rate: '6.14', type: 'P&I', repayment: '935', securityId: 'p1' },
    { label: 'Refinanced Loan', amount: '240,000', rate: '6.14', type: 'P&I', repayment: '1,739', securityId: 'p2' },
  ],
}

// The rows, as a person reads them off the page.
const readRows = (html: string): string[] =>
  html.replace(/<\/tr>/g, '\n').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&amp;/g, '&')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

describe('two securities, two boxes', () => {
  const rows = readRows(refinanceBoxes(AVARD))

  it('is the approved card, twice, each headed with its property', () => {
    expect(rows).toEqual([
      'Refinanced Loan — 15 Lister Ave, Beresfield NSW 2322, Australia',
      'Existing loan balance $127,090',
      'New loan amount $129,000',
      'Indicative rate 6.14% p.a.*',
      'Estimated repayments $935',
      'Repayment type P&I',
      'Loan term 30 years',
      'LVR 25.8%',
      'Refinanced Loan — 39 Weingartner Avenue, Tarro NSW 2322',
      'Existing loan balance $237,392',
      'New loan amount $240,000',
      'Indicative rate 6.14% p.a.*',
      'Estimated repayments $1,739',
      'Repayment type P&I',
      'Loan term 30 years',
      'LVR 53.3%',
    ])
  })

  // THE THREE ROWS THAT MADE THE SHIPPED VERSION READ AS A DIFFERENT TEMPLATE.
  it('has no equity, limit or drawn row - this is a dollar-for-dollar refinance', () => {
    const all = rows.join(' | ')
    expect(all).not.toContain('Equity released')
    expect(all).not.toContain('$0')
    expect(all).not.toContain('Limit against this property')
    expect(all).not.toContain('Drawn against this property')
  })

  it('and each LVR is that house’s own, not an average of the two', () => {
    expect(rows).toContain('LVR 25.8%')
    expect(rows).toContain('LVR 53.3%')
  })

  it('with the combined figure in one line underneath, not a card', () => {
    const line = readRows(securedTotalLine(AVARD)).join(' ')
    expect(line).toBe('Total lending of $369,000 against security of $950,000 '
      + '— an overall loan to value ratio of 38.8%.')
  })

  // AFTER e4839ff THE PORTAL DOES NOT WORK OUT A P&I REPAYMENT. An empty box
  // drops its row and leaves the rest of the card alone.
  it('a repayment nobody typed simply has no row', () => {
    const bare = { ...AVARD, splits: AVARD.splits.map(s => ({ ...s, repayment: '' })) }
    const out = readRows(refinanceBoxes(bare))
    expect(out.join(' | ')).not.toContain('Estimated repayments')
    expect(out).toContain('New loan amount $129,000')
    expect(out).toContain('LVR 25.8%')
  })

  it('a house with no value on the fact find shows no LVR rather than a zero', () => {
    const noValue = { ...AVARD,
      ffProperties: AVARD.ffProperties.map(x => ({ ...x, value: '' })) }
    expect(readRows(refinanceBoxes(noValue)).join(' | ')).not.toContain('LVR')
    expect(securedTotalLine(noValue)).toBe('')
  })

  // A second split on one house used to vanish, which is the fault this whole
  // area keeps being fixed for.
  it('a second split on one house is not dropped', () => {
    const extra = { ...AVARD, splits: [...AVARD.splits,
      { label: 'Fixed portion', amount: '50,000', rate: '5.89', type: 'P&I', securityId: 'p1' }] }
    expect(readRows(refinanceBoxes(extra)).join(' | ')).toContain('Fixed portion $50,000')
  })
})
