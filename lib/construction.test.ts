import { describe, it, expect } from 'vitest'
import {
  totalCost, totalLending, fundsToContribute, constructionLvr, landEquity,
  landFundingOf, isLandPurchase, dutyApplies, landLoanPayout, LAND_FUNDING,
  repaymentDuringConstruction,
} from './construction'

// LAND VALUE WAS DOING TWO JOBS: what the project costs, and what the security
// is worth. On a purchase it is both. On land somebody already owns it is only
// the second, and the arithmetic could not tell - so a client who needed to
// contribute nothing was told to find $900,000.

const BUYING = {
  landFunding: 'purchase',
  landValue: '1000000', constructionCost: '1000000', stampDuty: '40000',
  asIfCompleteValue: '2200000',
}
const BUYING_SPLITS = [{ amount: '800000' }, { amount: '800000' }]

const OWNED = {
  landFunding: 'owned',
  landValue: '900000', constructionCost: '600000', stampDuty: '',
  asIfCompleteValue: '1700000',
}
const OWNED_SPLITS = [{ amount: '600000' }]

const OWNED_LOAN = {
  landFunding: 'owned_with_loan',
  landValue: '900000', landLoanBalance: '300000',
  constructionCost: '600000', asIfCompleteValue: '1700000',
}
const OWNED_LOAN_SPLITS = [{ amount: '300000' }, { amount: '600000' }]

// THE GUARD ON EVERYTHING ELSE IN THIS FILE.
//
// $440,000 is Fabio's own figure, 2 Sep 2026, on the land-purchase case: "should
// be 440K". A fix that got the new cases right and quietly moved this one would
// be worse than the bug it was fixing.
describe('a land purchase is untouched', () => {
  it('still costs what it cost', () => {
    expect(totalCost(BUYING)).toBe(2_040_000)
  })

  it('and still contributes $440,000', () => {
    expect(fundsToContribute(BUYING, BUYING_SPLITS)).toBe(440_000)
  })

  // EVERY DEAL WRITTEN BEFORE TODAY has no answer recorded, and every one of
  // them was a purchase. They must behave to the dollar as they did.
  it('with nothing recorded at all, which is every deal already in the book', () => {
    const { landFunding, ...noAnswer } = BUYING
    expect(landFundingOf(noAnswer)).toBe('purchase')
    expect(totalCost(noAnswer)).toBe(2_040_000)
    expect(fundsToContribute(noAnswer, BUYING_SPLITS)).toBe(440_000)
  })

  it('and an answer nobody recognises falls back to a purchase, not to nothing', () => {
    expect(landFundingOf({ landFunding: 'something_else' })).toBe('purchase')
    expect(landFundingOf({ landFunding: null })).toBe('purchase')
  })

  it('the land is not equity, because it is not theirs yet', () => {
    expect(landEquity(BUYING)).toBe(0)
  })

  it('and duty applies', () => {
    expect(dutyApplies(BUYING)).toBe(true)
    expect(isLandPurchase(BUYING)).toBe(true)
  })
})

describe('land already owned outright', () => {
  // THE BUG, AS A NUMBER. This was $900,000.
  it('costs the build and nothing else', () => {
    expect(totalCost(OWNED)).toBe(600_000)
  })

  it('and the client contributes nothing', () => {
    expect(fundsToContribute(OWNED, OWNED_SPLITS)).toBe(0)
  })

  it('their land is equity, and that is what carries the LVR', () => {
    expect(landEquity(OWNED)).toBe(900_000)
    expect(constructionLvr(OWNED.asIfCompleteValue, OWNED_SPLITS)).toBe(35.3)
  })

  // NO PURCHASE, NO DUTY - and that is different from duty nobody has typed in.
  it('has no duty, so nothing may ask for one', () => {
    expect(dutyApplies(OWNED)).toBe(false)
  })

  it('and a duty figure left behind on the deal changes nothing', () => {
    // Somebody switches a deal from purchase to owned. The old duty is still
    // sitting in the box; it must not creep back into the total.
    expect(totalCost({ ...OWNED, stampDuty: '40000' })).toBe(600_000)
  })

  it('same for a land value - it is the security, never a cost', () => {
    expect(totalCost({ ...OWNED, landValue: '5000000' })).toBe(600_000)
  })
})

describe('land already owned, with a loan on it', () => {
  it('the payout is a cost, because the facility has to fund it', () => {
    expect(landLoanPayout(OWNED_LOAN)).toBe(300_000)
    expect(totalCost(OWNED_LOAN)).toBe(900_000)
  })

  it('and the client still contributes nothing', () => {
    expect(fundsToContribute(OWNED_LOAN, OWNED_LOAN_SPLITS)).toBe(0)
  })

  it('their equity is the land less what is owed on it', () => {
    expect(landEquity(OWNED_LOAN)).toBe(600_000)
  })

  it('the LVR counts both splits', () => {
    expect(totalLending(OWNED_LOAN_SPLITS)).toBe(900_000)
    expect(constructionLvr(OWNED_LOAN.asIfCompleteValue, OWNED_LOAN_SPLITS)).toBe(53)
  })

  it('a balance typed against land that is being purchased is ignored', () => {
    // The box only exists on one answer. A figure left over from a change of
    // mind must not quietly become a cost on a purchase.
    expect(landLoanPayout({ ...BUYING, landLoanBalance: '300000' })).toBe(0)
    expect(totalCost({ ...BUYING, landLoanBalance: '300000' })).toBe(2_040_000)
  })

  it('and a loan bigger than the land does not make equity negative', () => {
    expect(landEquity({ ...OWNED_LOAN, landLoanBalance: '1200000' })).toBe(0)
  })
})

describe('the things that did not change', () => {
  it('lending is still every split, which was the original bug', () => {
    expect(totalLending(BUYING_SPLITS)).toBe(1_600_000)
  })

  it('a project lent more than it costs contributes nothing, never a negative', () => {
    expect(fundsToContribute(OWNED, [{ amount: '900000' }])).toBe(0)
  })

  it('repayments are added, never calculated', () => {
    expect(repaymentDuringConstruction([{ repayment: '1200' }, { repayment: '900' }])).toBe(2100)
  })

  it('there are three ways to hold land and no more', () => {
    expect(LAND_FUNDING.map(x => x.value)).toEqual(['purchase', 'owned', 'owned_with_loan'])
    for (const x of LAND_FUNDING) expect(x.label.length).toBeGreaterThan(0)
  })
})
