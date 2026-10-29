import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { limitOf, securitiesOf, totalsOf, lvrOf, BEING_PURCHASED } from './securities'

// A HOUSE CARRIES WHAT IS LENT AGAINST IT.
//
// 29 Oct 2026. Fabio, on an Equity release + purchase: "the boxes on the
// existing security is blank???"
//
// They were. Nobody had typed an owes-now, a releasing or a new limit against
// 35/10 Goodwin St - and the screen was already printing "drawn $920,000" two
// columns across, because the splits say so. With no limit the row had no LVR,
// the total read "$2,680,000 against $1,310,000" and the deal came out at
// 48.9% when it is 83.2%.
//
// THE REST OF THE PORTAL ALREADY KNEW. groupsOf() in lib/complex-refinance.ts
// has used `limit > 0 ? limit : drawn` since it was written, so the client
// email's property cards had this right while the broker's own screen did not.
//
// Invented clients. The figures are Fabio's.

const SRC = readFileSync('lib/securities.ts', 'utf8')

const ff = { properties: [
  { id: 'p1', address: '35/10 Goodwin St, Narrabeen NSW 2101', value: '1,150,000',
    ownershipType: 'Investment' },
] }

const bc: any = {
  template: 'investment_equity',
  securityIds: ['p1'],
  newPurchasePrice: '1,530,000',
  splits: [
    { label: 'Existing loan refinanced', amount: '700,000', securityId: 'p1' },
    { label: 'Equity access', amount: '220,000', securityId: 'p1' },
    { label: 'New purchase', amount: '1,310,000', securityId: BEING_PURCHASED },
  ],
}

describe('WITH NOTHING TYPED IN THE BOXES', () => {
  it('the limit is what the splits put against it', () => {
    expect(limitOf(bc, 'p1')).toBe('920000')
  })

  it('AND THE LVR IS THE ONE FABIO WAS LOOKING FOR', () => {
    const house = securitiesOf(bc, ff)[0]
    expect(Math.round((lvrOf(house) as number) * 10) / 10).toBe(80)
  })

  it('and the purchase is not folded into it', () => {
    // $1,310,000 is against the house being bought, which is a row of its own.
    expect(limitOf(bc, 'p1')).not.toBe('2230000')
  })
})

describe('THE TYPED BOX STILL WINS', () => {
  it('because a lender can approve more than is drawn at settlement', () => {
    expect(limitOf({ ...bc, securityLimits: { p1: '1,000,000' } }, 'p1')).toBe('1,000,000')
  })

  it('and a top up keeps the owes-plus-increase answer it has always had', () => {
    const topUp = { template: 'top_up', securityIds: ['p1'],
                    securityBalances: { p1: '500,000' }, securityIncreases: { p1: '300,000' },
                    splits: [{ label: 'Increase', amount: '300,000', securityId: 'p1' }] }
    expect(limitOf(topUp, 'p1')).toBe('800000')
  })
})

describe('AND NOTHING IS INVENTED', () => {
  it('a security with no splits and no boxes has no limit', () => {
    expect(limitOf({ ...bc, splits: [] }, 'p1')).toBe('')
  })

  it('and no LVR either, rather than nought per cent', () => {
    expect(lvrOf(securitiesOf({ ...bc, splits: [] }, ff)[0])).toBe(null)
  })

  it('and a split pointed at nothing is not counted against a house', () => {
    const loose = { ...bc, splits: [{ label: 'Something', amount: '90,000' }] }
    expect(limitOf(loose, 'p1')).toBe('')
  })

  it('and a deal with no splits at all does not throw', () => {
    expect(() => limitOf({ template: 'refinance_only' }, 'p1')).not.toThrow()
    expect(limitOf({ template: 'refinance_only' }, 'p1')).toBe('')
  })
})

describe('THE TOTAL THE SCREEN PRINTS', () => {
  it('counts the lending on every house, not only the typed ones', () => {
    const t = totalsOf(securitiesOf(bc, ff))
    expect(t.limit).toBe(920000)
    expect(t.value).toBe(1150000)
  })
})

describe('AND IT IS WRITTEN DOWN ONCE', () => {
  it('this file is where a limit is decided', () => {
    expect(SRC).toContain('splitSecurityId(sp) === txt(id)')
  })
})
