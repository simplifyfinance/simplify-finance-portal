import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { totalCost, fundsToContribute, landFundingOf, isLandPurchase } from './construction'

// A MISSING ANSWER MEANT "BEING PURCHASED", AND NOBODY WAS TOLD.
//
// 9 Oct 2026. A construction deal where the clients already owned their land
// with a loan on it. Two boxes, two fields apart on the same screen:
//
//   Total cost (calculated)        $1,731,000   right
//   Funds to contribute (calc)       $880,000   wrong - should be $761,000
//
// The email, built from the same two functions, said $761,000. So the
// arithmetic was never in doubt; the INPUTS were.
//
//   Total cost passed   { landFunding, landValue, landLoanBalance,
//                         constructionCost, stampDuty }
//   Funds passed        { landValue, constructionCost, stampDuty }
//
// landFundingOf() returns 'purchase' for anything that is not 'owned' or
// 'owned_with_loan' - including undefined. That default is right for a blank
// new deal and lethal for an object that simply forgot to carry the field: the
// whole land value went in as a cost and the $331,000 payout fell out.
// Overstated by $119,000, which is exactly the clients' equity in the land.
//
// Fabio: "we have covered this before." He is right - it is the same shape as
// the loan amount on 8 Oct. A figure computed from a hand-assembled object,
// one field short, and nothing to notice.

const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

// The deal above, to the dollar.
const OWNED_WITH_LOAN = {
  landFunding: 'owned_with_loan',
  landValue: '450,000',
  landLoanBalance: '331,000',
  constructionCost: '1,400,000',
  stampDuty: '',
}
const SPLITS = [{ amount: '333,500' }, { amount: '636,500' }]

describe('land the clients already own is not a cost', () => {
  it('counts the build and the payout, not the land value', () => {
    expect(totalCost(OWNED_WITH_LOAN)).toBe(1_731_000)
    expect(fundsToContribute(OWNED_WITH_LOAN, SPLITS)).toBe(761_000)
  })

  it('and dropping how the land is held turns it into a purchase', () => {
    // The exact fault, written down so it reads as a deliberate default rather
    // than an accident waiting to be repeated.
    const short = { landValue: '450,000', constructionCost: '1,400,000', stampDuty: '' }
    expect(landFundingOf(short)).toBe('purchase')
    expect(isLandPurchase(short)).toBe(true)
    expect(totalCost(short)).toBe(1_850_000)
    expect(fundsToContribute(short, SPLITS)).toBe(880_000)
  })
})

describe('and a saved email cannot look healthy while the scenario moves', () => {
  it('the stamp watches the scenario figures the email is built from', () => {
    // The other half of the same morning. The saved client email said "you
    // already own the land, so the only funding required is the build itself"
    // long after the BC said the land carried a loan being paid out - and
    // nothing flagged it, because every figure on the watch list came from the
    // fact find, the splits or the lending options.
    const figures = readFileSync('lib/deal-figures.ts', 'utf8')
    for (const named of [
      'the construction cost', 'the land value', 'the land loan being paid out',
      'the "as if complete" valuation', 'how the land is held',
      'the purchase price', 'the deposit', 'the stamp duty',
    ]) {
      expect(figures, `${named} is not watched, so changing it leaves a saved\n`
        + 'email and the compliance boxes looking current').toContain(named)
    }
  })

  it('names them one at a time, so a stale box says which figure moved', () => {
    const figures = readFileSync('lib/deal-figures.ts', 'utf8')
    expect(figures, 'the scenario figures were folded into one hash, which tells\n'
      + 'somebody that something moved without telling them what')
      .toContain('SCENARIO_FIGURES')
  })
})

describe('every box on the BC passes the whole answer', () => {
  it('the funds to contribute box carries how the land is held', () => {
    expect(bc, 'the funds box builds its figures without landFunding again, so a\n'
      + 'client who owns their land is asked for their own equity back')
      .toContain('const d = { landFunding, landValue, landLoanBalance, constructionCost, stampDuty }')
  })

  it('and so does the total cost box, which always did', () => {
    expect(bc).toContain('totalCost({ landFunding, landValue, landLoanBalance, constructionCost, stampDuty })')
  })

  it('no box on this screen builds a construction figure from a shorter set', () => {
    // The two boxes above are the only places this screen assembles an object
    // for lib/construction.ts. A third, one field short, is this bug again.
    const calls = bc.match(/(?:totalCost|fundsToContribute|constructionLvr)\(\s*(?:d|\{)/g) || []
    const withoutLandFunding = (bc.match(/\{\s*landValue,\s*constructionCost/g) || [])
    expect(withoutLandFunding, 'a construction figure is being worked out from an\n'
      + 'object with no landFunding in it. Pass all five fields.').toEqual([])
    expect(calls.length).toBeGreaterThan(0)
  })
})
