// WHICH PROPERTIES ARE SECURITY IS ONE QUESTION WITH ONE ANSWER.
//
// 13 Nov 2026, the Le-Vo deal. The Broker Submission Notes printed PROPERTY
// VALUE $1,950,000 and LVR 47.2% against $920,000 of lending. The house being
// bought is worth less than that: the figure was the purchase PLUS the home
// they were selling, added together.
//
// THE FAULT WAS NOT THE ARITHMETIC. 920,000 over 1,950,000 really is 47.2%.
// The fault was the denominator, and the reason it was wrong is the reason
// this file exists:
//
//   lib/funds-to-complete.ts  built the security total for the deal strip, the
//                             LVR, and the Broker Submission Notes
//   lib/box-security.ts       built the security list for the compliance pack
//
// Two files, each with its own loop over the fact find, each asking
// refinancesNothing() and neither asking whether the scenario SELLS. So the
// same wrong figure reached a lender's submission and a regulated document by
// two separate routes, and fixing either one would have left the other.
//
// Fabio, that morning: "make sure you found the root of the cause and make
// sure this does not happen again."
//
// THE ROOT CAUSE IS TWO ANSWERS TO ONE QUESTION. The guard is that there is
// now one function, and both files call it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  refinancesNothing, securityComesFromTheFactFind, sellsSomething,
} from './a-scenario-keeps-its-own-figures'
// ORDER MATTERS HERE. box-security and funds-to-complete reach each other
// through deal-structure, so the one imported second comes back half built.
// Loading the pack's list first is what every other caller does.
import { securitiesOf as securitiesOnThisDeal } from './box-security'
import { securityIdsOf } from './securities'
import { securityValue } from './funds-to-complete'

const FILES = ['lib/funds-to-complete.ts', 'lib/box-security.ts']

describe('one rule, and both files ask it', () => {
  it('neither file works out for itself whether to read the fact find', () => {
    // COMMENTS ARE NOT CALLS. Both files explain WHY the rule exists and name
    // its two halves while doing so, which is the point of the comment.
    const withoutComments = (src: string) => src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

    for (const f of FILES) {
      const code = withoutComments(readFileSync(f, 'utf8'))
      expect(code, `${f} calls securityComesFromTheFactFind()`)
        .toContain('securityComesFromTheFactFind(')
      // The two halves of the rule are the rule's business, not a caller's.
      // A caller asking refinancesNothing() directly is a caller that will
      // forget the other half, which is exactly what happened here.
      expect(code, `${f} asks refinancesNothing() itself instead of the one rule`)
        .not.toContain('refinancesNothing(')
      expect(code, `${f} asks sellsSomething() itself instead of the one rule`)
        .not.toContain('sellsSomething(')
    }
  })
})

describe('the rule itself', () => {
  it('says no on a scenario that refinances nothing', () => {
    expect(refinancesNothing('oo_purchase')).toBe(true)
    expect(securityComesFromTheFactFind('oo_purchase')).toBe(false)
  })

  // THE ONE THAT WAS MISSED. A buy and sell HAS an existing loan balance box -
  // there is a loan on the house being sold - so refinancesNothing() answers
  // false and the old rule went looking.
  it('says no on a scenario that sells, which the old rule did not', () => {
    expect(refinancesNothing('buy_sell')).toBe(false)
    expect(sellsSomething('buy_sell')).toBe(true)
    expect(securityComesFromTheFactFind('buy_sell')).toBe(false)
  })

  it('says yes on a real refinance, which must keep working', () => {
    expect(securityComesFromTheFactFind('refinance_only')).toBe(true)
    expect(securityComesFromTheFactFind('complex_refinance')).toBe(true)
    expect(securityComesFromTheFactFind('refinance_equity')).toBe(true)
  })

  it('says yes where there is no template to go on', () => {
    // A record with no scenario keeps what it has. Same rule as everywhere
    // else in this file - see scenarioHasItsOwnBoxes().
    expect(securityComesFromTheFactFind('')).toBe(true)
  })
})

// THE DEAL ITSELF, THROUGH BOTH DOORS.
//
// Invented figures, the real shape: a buy and sell where the sold house
// carries a loan being paid out at settlement.
describe('a buy and sell, through every route that reads security', () => {
  const sold = {
    id: 'p1', address: '12 Old Street', value: '1030000', ownershipType: 'Owner occupied',
    loans: [{ status: 'To be paid out', balance: '420000', lenderName: 'CBA' }],
  }
  const deal = {
    bc_data: {
      template: 'buy_sell',
      purchasePrice: '920000',
      salePrice: '1030000',
      existingLoanBal: '420000',
      splits: [{ amount: '920000' }],
    },
    fact_find_data: { properties: [sold] },
  }

  it('the LVR counts only the house being bought', () => {
    const out = securityValue(deal)
    expect(out.total).toBe(920_000)
    expect(out.lvr).toBe(100)
  })

  it('and the compliance pack does not list the house being sold', () => {
    const list = securitiesOnThisDeal(deal)
    expect(list.map((s: any) => s.address)).not.toContain('12 Old Street')
  })

  // BOTH DOORS, ONE ANSWER. This is the assertion that would have failed on
  // 13 Nov and is the whole point of the file.
  it('and the two agree with each other', () => {
    const fromLvr = securityValue(deal).total
    const fromPack = securitiesOnThisDeal(deal)
      .reduce((t: number, s: any) => t + (Number(s?.value) || 0), 0)
    expect(fromPack).toBe(fromLvr)
  })
})

describe('a real refinance, through every route', () => {
  const deal = {
    bc_data: { template: 'refinance_only', splits: [{ amount: '500000' }] },
    fact_find_data: {
      properties: [{
        id: 'p9', address: '3 Keeping Street', value: '1000000',
        loans: [{ status: 'Refinance', balance: '480000', lenderName: 'ANZ' }],
      }],
    },
  }

  it('still counts the house it refinances', () => {
    expect(securityValue(deal).total).toBe(1_000_000)
    expect(securityValue(deal).lvr).toBe(50)
  })

  it('and still lists it on the pack', () => {
    expect(securitiesOnThisDeal(deal).map((s: any) => s.address))
      .toContain('3 Keeping Street')
  })
})
