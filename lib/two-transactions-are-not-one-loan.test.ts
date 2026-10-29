import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { loanThatBuysIt, lendingNotBuyingIt, BEING_PURCHASED } from './securities'
import { lmiOnSecurity, lmiAmount, clientLoan, totalLendingLine } from './lmi'
import { mergedNotes, notesOf } from './scenario-notes'

// TWO TRANSACTIONS ARE NOT ONE LOAN.
//
// 29 Oct 2026. Fabio, on a client email showing an Equity release + purchase
// beside a Buy / sell:
//
//   "at glance makes no sense, where does that come from. YOU DECIDED to add
//    total lending across 2 securities - go back to my commands, I said to
//    NEVER do total lending, it makes no sense, it is 2 separate transactions.
//    The purchase loan amount is not matching the form."
//
// The deal on his screen, with the names invented and the figures his:
//
//   35/10 Goodwin St    worth $1,150,000   $700,000 refinanced + $220,000 out
//   The house being bought   $1,530,000    $1,310,000 lending, $21,295 LMI
//
// and the email told the client their loan amount was $2,251,295 at 80% LVR
// with no LMI. Three figures, three different ways of being wrong, one habit:
// the email treated the deal as one loan.

const ROUTE = readFileSync('app/api/generate-email/route.ts', 'utf8')

const bc: any = {
  template: 'investment_equity',
  newPurchasePrice: '1,530,000',
  newPurchaseStampDuty: '66,000',
  newPurchaseDeposit: '286,000',
  splits: [
    { label: 'Existing loan refinanced', amount: '700,000', securityId: 'p1' },
    { label: 'Equity access', amount: '220,000', securityId: 'p1' },
    { label: 'New purchase', amount: '1,310,000', securityId: BEING_PURCHASED },
  ],
  securityIds: ['p1'],
  securityLmiApplicable: { [BEING_PURCHASED]: 'Applicable' },
  securityLmi: { [BEING_PURCHASED]: '21,295' },
  securityLmiTreatment: { [BEING_PURCHASED]: 'capitalised' },
}

describe('THE LOAN THAT BUYS THE HOUSE', () => {
  it('is the split that buys it, not the deal', () => {
    expect(loanThatBuysIt(bc)).toBe(1310000)
  })

  it('and what is left is the refinance, said on its own', () => {
    expect(lendingNotBuyingIt(bc)).toBe(920000)
  })

  it('AND THE TWO ARE NEVER ADDED UP', () => {
    expect(loanThatBuysIt(bc) + lendingNotBuyingIt(bc)).toBe(2230000)
    expect(ROUTE).not.toContain('loan: totalLending(bc.splits)')
  })

  it('but on an ordinary purchase the whole lending IS the loan that buys it', () => {
    const simple = { template: 'oo_purchase', splits: [{ label: 'Split 1', amount: '640,000' }] }
    expect(loanThatBuysIt(simple)).toBe(640000)
    expect(lendingNotBuyingIt(simple)).toBe(0)
  })

  it('and a deal with no splits does not invent one', () => {
    expect(loanThatBuysIt({})).toBe(0)
    expect(lendingNotBuyingIt({})).toBe(0)
  })
})

describe('THE PREMIUM BELONGS TO THE HOUSE IT WAS PRICED ON', () => {
  it('the purchase carries it', () => {
    const only = lmiOnSecurity(bc, BEING_PURCHASED)
    expect(lmiAmount(only)).toBe(21295)
    expect(clientLoan(only, 1310000).amount).toBe(1331295)
  })

  it('and the house being refinanced does not', () => {
    expect(lmiOnSecurity(bc, 'p1')).toBe(null)
  })

  it('AND IT IS NOT THE WHOLE DEAL S PREMIUM ON ONE CARD', () => {
    // Two securities each carrying a premium must not both print the sum.
    const two = { ...bc,
      securityLmiApplicable: { [BEING_PURCHASED]: 'Applicable', p1: 'Applicable' },
      securityLmi: { [BEING_PURCHASED]: '21,295', p1: '8,000' },
      securityLmiTreatment: { [BEING_PURCHASED]: 'capitalised', p1: 'capitalised' } }
    expect(lmiAmount(two), 'the deal total is still the deal total').toBe(29295)
    expect(lmiAmount(lmiOnSecurity(two, 'p1'))).toBe(8000)
    expect(lmiAmount(lmiOnSecurity(two, BEING_PURCHASED))).toBe(21295)
  })

  it('and a security nobody named carries nothing', () => {
    expect(lmiOnSecurity(bc, '')).toBe(null)
    expect(lmiOnSecurity(bc, 'p9')).toBe(null)
  })

  it('and a deal-level premium is not dragged onto a split by it', () => {
    const dealLevel = { ...bc, securityLmi: {}, securityLmiApplicable: {},
                        lmiApplicable: 'Applicable', lmi: '12,000' }
    expect(lmiOnSecurity(dealLevel, BEING_PURCHASED)).toBe(null)
    expect(lmiAmount(dealLevel), 'still said, where it has always been said').toBe(12000)
  })
})

describe('AND NOTHING PRINTS A TOTAL ACROSS THEM', () => {
  it('the line itself still works where a deal IS one transaction', () => {
    const one = { ...bc, template: 'oo_purchase' }
    expect(totalLendingLine(one, 2230000, 3)).toContain('Total lending')
  })

  it('AND THE EMAIL REFUSES IT ON A DEAL THAT BUYS AND REFINANCES', () => {
    expect(ROUTE).toContain('if (canBuyAndRefinance(d?.template)) return')
  })

  it('and refuses it again where a split has already said it', () => {
    expect(ROUTE).toContain('splits.some((sp: any) => lmiOnSecurity(d, splitSecurityId(sp)))')
  })

  it('and the glance prints the two separately', () => {
    expect(ROUTE).toContain("['Purchase loan'")
    expect(ROUTE).toContain("['Refinance'")
  })

  it('and reads the contribution from the box that scenario uses', () => {
    expect(ROUTE).toContain('readMoney(bc?.newPurchaseDeposit)')
  })
})

describe('BOTH SCENARIOS’ IMPORTANT THINGS TO NOTE', () => {
  const buySell = { additionalNotes: [
    'This is your estimated borrowing capacity as of today.',
    'The figures used for the proposed sale are only estimated amounts.',
  ] }
  const equity = { templateNotes:
    'This is your estimated borrowing capacity as of today.\nInterest on the equity released may not be deductible.' }

  it('read from either shape they are held in', () => {
    expect(notesOf(buySell)).toHaveLength(2)
    expect(notesOf(equity)).toHaveLength(2)
    expect(notesOf({})).toEqual([])
  })

  it('MERGE, SO THE CLIENT GETS BOTH OPTIONS’ CAVEATS', () => {
    const out = mergedNotes(buySell, equity)
    expect(out).toContain('The figures used for the proposed sale are only estimated amounts.')
    expect(out).toContain('Interest on the equity released may not be deductible.')
  })

  it('and the line both templates carry is said once', () => {
    const out = mergedNotes(buySell, equity)
    expect(out.filter(x => /estimated borrowing capacity/.test(x))).toHaveLength(1)
  })

  it('and the first scenario keeps its order', () => {
    expect(mergedNotes(buySell, equity)[0]).toBe('This is your estimated borrowing capacity as of today.')
  })

  it('and one scenario on its own is unchanged', () => {
    expect(mergedNotes(buySell, null)).toEqual(buySell.additionalNotes)
  })

  it('AND THE EMAIL USES IT', () => {
    expect(ROUTE).toContain('notesBox(mergedNotes(d, d.secondScenario))')
  })
})
