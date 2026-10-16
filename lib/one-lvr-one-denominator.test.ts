import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  purchaseLoanOf, purchasePriceOf, securitiesWithPurchase, securitiesOf,
  totalsOf, BEING_PURCHASED, canBuyAndRefinance,
} from './securities'
import { lvrOf as commissionLvr, calcCommission } from './commission'
import { lvrOf as complianceLvr } from './funds-to-complete'

// TOTAL LENDING OVER ONE HOUSE'S VALUE. THE SAME MISTAKE IN SIX PLACES.
//
// 16 Oct 2026. Fabio, on a deal refinancing two investment properties and
// buying a third: "why LVR is 125%? investigate where this figure comes from as
// the global splits are correct." They were correct. Then: "I need this to stop
// happening, this is slowing down my team - audit all other templates to find
// any similar errors."
//
// The audit found six, five of them the same sentence written five times: take
// every split on the deal, divide by whatever single property value is to hand.
//
//   the commission LVR band   1,855,000 / 700,000 = 265%
//   the compliance pack       1,855,000 / 1,825,000 = 101.6%  (purchase price left out)
//   the LO's "LVR (calculated)" box   1,855,000 / 700,000 = 265%
//   the lending options listed its splits twice
//   the securities panel never appeared on the templates that have securities
//   and the property being purchased could be chosen on the BC and nowhere else
//
// THE REAL ANSWER IS 73.5%. This file is the fence around it.

// Invented names and a real shape.
const DEAL = {
  loan_amount: 1855000,
  fact_find_data: {
    properties: [
      { id: 'p1', address: '10 Example Road, Mango Hill QLD 4509', value: '830,000',
        ownershipType: 'Investment' },
      { id: 'p2', address: '15 Sample Street, Wynnum West QLD 4178', value: '995,000',
        ownershipType: 'Investment' },
    ],
  },
  bc_data: {
    template: 'investment_equity',
    securityIds: ['p1', 'p2'],
    purchasePrice: '700,000',
    splits: [
      { label: 'Existing loan refinanced', amount: '610,000', securityId: 'p1' },
      { label: 'Existing loan refinanced', amount: '506,000', securityId: 'p2' },
      { label: 'New purchase',             amount: '449,000', securityId: BEING_PURCHASED },
      { label: 'Equity access',            amount: '290,000', securityId: 'p2' },
    ],
  },
}
const BC = DEAL.bc_data
const FF = DEAL.fact_find_data

describe('the loan that buys the new house', () => {
  it('is the split tagged to it, not every split on the deal', () => {
    expect(purchaseLoanOf(BC)).toBe(449000)
  })

  it('falls back to the label for deals recorded before the tag existed', () => {
    const old = { splits: [
      { label: 'Existing loan refinanced', amount: '610,000', securityId: 'p1' },
      { label: 'New purchase', amount: '449,000', securityId: 'p2' },
    ] }
    expect(purchaseLoanOf(old)).toBe(449000)
  })

  it('and the tag beats the label when they disagree', () => {
    const both = { splits: [
      { label: 'New purchase', amount: '1,000', securityId: 'p1' },
      { label: 'Equity access', amount: '449,000', securityId: BEING_PURCHASED },
    ] }
    expect(purchaseLoanOf(both)).toBe(449000)
  })

  it('is zero on a refinance, which buys nothing', () => {
    expect(purchaseLoanOf({ splits: [{ label: 'Refinance', amount: '610,000' }] })).toBe(0)
    expect(purchaseLoanOf({})).toBe(0)
  })

  it('and the price is the new purchase price before the plain one', () => {
    expect(purchasePriceOf({ newPurchasePrice: '700,000', purchasePrice: '1' })).toBe('700,000')
    expect(purchasePriceOf({ purchasePrice: '700,000' })).toBe('700,000')
  })
})

describe('the house being bought is a security like any other', () => {
  const list = securitiesWithPurchase(BC, FF)

  it('it joins the ticked houses rather than replacing one of them', () => {
    expect(list).toHaveLength(3)
    expect(list.map(x => x.id)).toEqual(['p1', 'p2', BEING_PURCHASED])
  })

  it('valued at the purchase price and carrying the purchase loan', () => {
    const buying = list.find(x => x.id === BEING_PURCHASED)!
    expect(buying.value).toBe('700,000')
    expect(buying.limit).toBe('449000')
  })

  // THE GUARD THAT lib/box-security.test.ts CAUGHT. With nothing ticked, every
  // caller has an older path that already counts the purchase AND the
  // refinanced houses. A list holding only the purchase makes them stop early.
  it('but not when no security has been ticked at all', () => {
    expect(securitiesWithPurchase({ template: 'investment_equity', purchasePrice: '700,000' }, FF))
      .toEqual([])
  })

  it('and never on a scenario that buys nothing', () => {
    const refi = { ...BC, template: 'refinance_equity' }
    expect(securitiesWithPurchase(refi, FF)).toEqual(securitiesOf(refi, FF))
    expect(canBuyAndRefinance('refinance_equity')).toBe(false)
    expect(canBuyAndRefinance('complex_refinance')).toBe(false)
    expect(canBuyAndRefinance('investment_equity')).toBe(true)
  })

  it('so the security behind this deal is $2,525,000, not $1,825,000', () => {
    expect(totalsOf(securitiesOf(BC, FF)).value).toBe(1825000)
    expect(totalsOf(securitiesWithPurchase(BC, FF)).value).toBe(2525000)
  })
})

describe('the LVR a commission band is picked from', () => {
  it('is 73.5%, where it used to be 265%', () => {
    expect(commissionLvr(DEAL)).toBe(73.5)
  })

  // 265% fell through every band. A lender paying 0.65% up to 80% and 0.55%
  // above it either paid nothing at all or paid the wrong one.
  it('and a banded lender now gets paid', () => {
    const rate = {
      upfront_bands: [{ max_lvr: 80, pct: 0.65 }, { max_lvr: null, pct: 0.55 }],
      confirmed: true,
    } as any
    const good = calcCommission({ amount: 1855000, rate, lvr: commissionLvr(DEAL) })
    expect(good.ok).toBe(true)
    expect(good.upfrontPct).toBe(0.65)

    const wrong = calcCommission({ amount: 1855000, rate, lvr: 265 })
    expect(wrong.upfrontPct).toBe(0.55)
  })

  it('a deal with no securities ticked still reads the old boxes', () => {
    expect(commissionLvr({ loan_amount: 800000, bc_data: { propertyValue: '1,000,000' } })).toBe(80)
  })
})

describe('the LVR in the compliance pack', () => {
  it('counts the house being bought, so it is not 101.6%', () => {
    const lvr = complianceLvr(DEAL)
    expect(lvr).not.toBeNull()
    expect(lvr).toBeLessThan(80)
    expect(lvr).toBeGreaterThan(70)
  })
})

describe('the lending options screen asks one question, not three', () => {
  const src = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

  it('the LVR box divides by the purchase, not by the whole deal', () => {
    expect(src).toContain('const buying = purchaseLoanOf(bc)')
    expect(src).not.toMatch(/const pct = price > 0 \? Math\.round\(\(loanAmt \/ price\)[\s\S]{0,40}\n\s+\}\)\(\)\}\n\s+<\/div>\n\s+<\/Field>\n\s+<\/div>\n\s+\)\}\)\(\)\}/)
  })

  it('no block on this screen still gates on "is this complex refinance"', () => {
    // Four did: the securities panel, the flat split list, the lender
    // comparison headings, and nothing else asked the same question. The flat
    // list was the loud one - it rendered UNDER the grouped list, so every
    // split appeared twice on an Equity release + purchase.
    expect(src).not.toContain('isComplexRefinance(bc.template)')
  })

  it('and every securities list on it includes the house being bought', () => {
    expect((src.match(/securitiesWithPurchase\(bc, ff\)/g) || []).length).toBeGreaterThanOrEqual(5)
  })

  it('so the grouped list and the flat list can never both render', () => {
    expect(src).toContain('{(!canHaveManySecurities(bc.template) || securitiesWithPurchase(bc, ff).length < 2) && (')
  })
})
