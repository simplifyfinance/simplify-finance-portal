// A REFINANCE THAT NEVER LEAVES THE LENDER, AND A PAYOUT FIGURE THAT DID NOT ADD UP.
//
// 17 Nov 2026. Fabio's broker cut sixty words to one sentence, and the sixty
// contained "$57,200 being paid out" on a file whose fact find recorded
// $395,899.35 owing on that security. Fabio: "Remove the inconsistency."
import { describe, it, expect } from 'vitest'
import {
  sameLenderName, isInternalRefinance, INTERNAL_REFINANCE, recordedOwing, payoutAgrees,
} from './an-internal-refinance'

const deal = (over: any = {}) => ({
  id: 'd1',
  bc_data: {
    template: 'refinance_only', loanTerm: '30',
    securityIds: ['p1'], securityBalances: { p1: '395899.35' },
    ...(over.bc || {}),
  },
  fact_find_data: {
    properties: [{
      id: 'p1', address: '14 Marrack St, Kingswood NSW 2747, Australia', value: '700000',
      loans: [{ lenderName: over.mortgagee ?? 'St George', balance: over.owing ?? '395899.35',
                status: 'To be refinanced' }],
    }],
  },
  lo_data: { recommendedLender: over.to ?? 'St George', lenderOptions: [] },
  compliance_data: {},
  ...(over.deal || {}),
})

describe('the same lender, written two ways', () => {
  it('is still the same lender', () => {
    expect(sameLenderName('St George', 'st george')).toBe(true)
    expect(sameLenderName('St.George', 'St George')).toBe(true)
    expect(sameLenderName('St George Bank', 'St George')).toBe(true)
  })

  it('and two different lenders are not', () => {
    expect(sameLenderName('St George', 'ANZ')).toBe(false)
    expect(sameLenderName('Westpac', 'West')).toBe(true)
  })

  // A BLANK IS NEVER A MATCH. Nobody recording the mortgagee must not read as
  // "it is staying where it is".
  it('and a blank never matches anything', () => {
    expect(sameLenderName('', 'St George')).toBe(false)
    expect(sameLenderName('St George', '')).toBe(false)
    expect(sameLenderName(null, null)).toBe(false)
  })
})

describe('is the loan staying where it is', () => {
  it('same lender in and out', () => {
    expect(isInternalRefinance(deal())).toBe(true)
  })

  it('a different lender is not an internal refinance', () => {
    expect(isInternalRefinance(deal({ to: 'ANZ' }))).toBe(false)
  })

  // ONE SECURITY WITH NO MORTGAGEE RECORDED AND IT IS NOT INTERNAL. The full
  // paragraph is the honest one when the portal cannot say.
  it('and nor is one whose mortgagee nobody recorded', () => {
    expect(isInternalRefinance(deal({ mortgagee: '' }))).toBe(false)
  })

  it('a deal with no securities is not one either', () => {
    const d = deal()
    d.fact_find_data.properties = []
    expect(isInternalRefinance(d)).toBe(false)
  })

  it('and the sentence says what it is', () => {
    expect(INTERNAL_REFINANCE).toContain('internal refinance')
    expect(INTERNAL_REFINANCE).toContain('lender valuation report')
    expect(INTERNAL_REFINANCE, 'nothing is being paid out on an internal refinance')
      .not.toContain('paid out')
  })
})

describe('the typed payout against the recorded balance', () => {
  it('agree, and the note may say so', () => {
    expect(payoutAgrees(deal()).agree).toBe(true)
  })

  // THE FILE THIS WAS WRITTEN FOR.
  it('disagree, and it says neither figure', () => {
    const d = deal()
    d.bc_data.securityBalances = { p1: '57200' }
    const c = payoutAgrees(d)
    expect(c.agree).toBe(false)
    expect(c.typed).toBe(57200)
    expect(Math.round(c.recorded)).toBe(395899)
  })

  it('a dollar of rounding is not a disagreement', () => {
    const d = deal()
    d.bc_data.securityBalances = { p1: '395900' }
    expect(payoutAgrees(d).agree).toBe(true)
  })

  it('and nothing recorded is a gap somewhere else, not a contradiction here', () => {
    const d = deal()
    d.bc_data.securityBalances = {}
    d.fact_find_data.properties[0].loans[0].balance = ''
    expect(payoutAgrees(d).agree).toBe(true)
  })

  it('recordedOwing adds up what the fact find says', () => {
    expect(Math.round(recordedOwing(deal()))).toBe(395899)
  })
})
