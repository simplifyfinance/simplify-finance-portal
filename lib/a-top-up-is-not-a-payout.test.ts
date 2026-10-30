import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { refinancedDebt } from './funds-to-complete'
import { shapeOf, boxSeven } from './box-deposit'
import { isPurchase, isRefinance } from './document-rules'
import { typeOf } from './deal-labels'
import { BEING_PURCHASED } from './securities'

// THE SEVEN THE AUDIT FOUND.
//
// 20 Oct 2026. Fabio: "audit these 2 new templates and LO and compliance", and
// then "these need to be picked up early". Every test here is a thing that was
// wrong in the shipped portal while the borrowing capacity looked perfect -
// which is the dangerous shape, because nothing on the BC tab says the
// compliance pack two tabs later is describing a different deal.

const BOTANY = 'p1'
const HELMSMAN = 'p2'

const bc = (over: any = {}) => ({
  template: 'top_up',
  securityIds: [BOTANY],
  securityBalances: { [BOTANY]: '942,441' },
  securityIncreases: { [BOTANY]: '200,000' },
  securityDollarForDollar: {},
  splits: [
    { label: 'Existing loan', amount: '942,441', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BOTANY, purpose: 'investment', staying: true },
    { label: 'Loan increase', amount: '200,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BOTANY, purpose: 'investment' },
  ],
  ...over,
})

const ff = {
  applicants: [{ firstName: 'Dan', lastName: 'Hartley' }],
  properties: [
    { id: BOTANY, address: '1372 Botany Rd, Botany NSW 2019', value: '2,000,000',
      ownershipType: 'Investment', loans: [{ lenderName: 'St George', balance: '942,441' }] },
    { id: HELMSMAN, address: '43 Helmsman Blvd, St Huberts Island NSW 2257', value: '3,000,000',
      ownershipType: 'Owner occupied', loans: [] },
  ],
}

const deal = (over: any = {}) => ({ bc_data: bc(over), fact_find_data: ff, lo_data: {} } as any)

describe('nothing is being paid out on a top up', () => {
  // The balance on a security is a loan STAYING with the lender it is already
  // with. Counted as refinanced debt it became a discharge that is not
  // happening, on two screens at once.
  it('reports no refinanced debt when nothing is moving', () => {
    expect(refinancedDebt(deal())).toBe(0)
  })

  // Dollar for dollar DOES move the loan, so that balance really is discharged.
  // Third place the tick changes arithmetic rather than wording.
  it('still reports a payout on a security ticked dollar for dollar', () => {
    expect(refinancedDebt(deal({ securityDollarForDollar: { [BOTANY]: true } }))).toBe(942441)
  })

  it('leaves every other scenario reading its balances exactly as before', () => {
    const refi = deal({ template: 'refinance_only', securityIncreases: {} })
    expect(refinancedDebt(refi)).toBe(942441)
  })
})

describe('the compliance pack says what a top up is', () => {
  // WHAT THIS REPLACED, word for word: "This is a refinance of the existing
  // debt dollar for dollar. No deposit or contribution is required, as the new
  // lending of $1,142,441 replaces the existing balance of $942,441 being paid
  // out." Not one clause of that is true, and it goes to a lender.
  it('is its own shape, not a refinance', () => {
    expect(shapeOf(deal())).toBe('top_up')
    expect(shapeOf(deal({ template: 'top_up_purchase', newPurchasePrice: '780,000' })))
      .toBe('top_up_purchase')
  })

  it('never calls it a refinance or a payout', () => {
    const t = boxSeven(deal()).text
    expect(t).not.toMatch(/refinance of the existing debt/i)
    // The whole false sentence, and the clause that carried the claim. The box
    // is allowed to say "no debt is being paid out" - that is the correction,
    // not the fault - so the assertion is on the claim, not on the words.
    expect(t).not.toMatch(/replaces the existing balance/i)
    expect(t).toMatch(/no debt is being paid out/i)
    expect(t).not.toMatch(/NOT RECORDED/)
  })

  it('names what is owed, the increase and where it lands', () => {
    const t = boxSeven(deal()).text
    expect(t).toContain('$942,441')
    expect(t).toContain('$200,000')
    expect(t).toContain('$1,142,441')
    expect(t).toMatch(/stays with its current lender and is not being refinanced/i)
  })

  // On a top up + purchase the increase IS the deposit - the same story
  // release_and_purchase tells, with the figures this scenario actually has.
  it('says the increase is the contribution on a top up + purchase', () => {
    const d = deal({
      template: 'top_up_purchase',
      newPurchasePrice: '780,000',
      splits: [...bc().splits, { label: 'New purchase', amount: '624,000', rate: '6.39', type: 'Interest only', ioYears: '5', securityId: BEING_PURCHASED, purpose: 'investment' }],
    })
    const t = boxSeven(d).text
    expect(t).toMatch(/contribution towards the purchase price of \$780,000/i)
    expect(t).not.toMatch(/replaces the existing balance/i)
  })

  // A ticked security really is moving, so the sentence must account for it
  // rather than claiming the whole deal stays put.
  it('mentions the part that really is being refinanced', () => {
    const d = deal({
      securityIds: [BOTANY, HELMSMAN],
      securityBalances: { [BOTANY]: '942,441', [HELMSMAN]: '300,000' },
      securityIncreases: { [BOTANY]: '200,000' },
      securityDollarForDollar: { [HELMSMAN]: true },
    })
    expect(boxSeven(d).text).toMatch(/refinanced dollar for dollar/i)
  })
})

describe('the documents asked for match the deal', () => {
  // Not a refinance, therefore a purchase - and so it demanded an updated
  // contract of sale and building insurance for a house nobody is buying.
  it('does not treat a plain top up as a purchase', () => {
    expect(isPurchase(deal())).toBe(false)
    expect(isRefinance(deal())).toBe(false)
  })

  it('still treats a top up + purchase as a purchase, because it is one', () => {
    expect(isPurchase(deal({ template: 'top_up_purchase' }))).toBe(true)
  })

  it('leaves an ordinary purchase alone', () => {
    expect(isPurchase(deal({ template: 'oo_purchase' }))).toBe(true)
  })
})

describe('a top up wears a type on the boards', () => {
  // No entry in the map meant an "unknown" chip everywhere, and that map is
  // also what sets a deal's transaction type - which the settlements board
  // uses to tell refinances from purchases.
  it('is an equity release, never a refinance, because nothing discharges', () => {
    expect(typeOf({ bc_data: bc() })).toBe('equity_release')
  })

  it('is a purchase once it buys something', () => {
    expect(typeOf({ bc_data: bc({ template: 'top_up_purchase' }) })).toBe('purchase')
  })
})

describe('the form asks each question once', () => {
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  // The panel draws a purchase price, deposit, deposit source, stamp duty and
  // state. Equity release + purchase is excluded from the deal-level copies of
  // all five for that reason; top up + purchase was not, so each drew twice -
  // into two different fields that two files read in opposite order.
  it('hides the deal-level purchase boxes where the panel draws them', () => {
    const gates = form.split('\n').filter(l => l.includes('buysNothing(template)') && l.includes('investment_equity'))
    expect(gates.length).toBeGreaterThan(2)
    for (const g of gates) expect(g).toContain('top_up_purchase')
  })

  it('does not draw the deal-level property value box on a top up', () => {
    const line = form.split('\n').find(l => l.includes('<Field label="Property value">')) || ''
    expect(line).not.toContain('top_up')
  })

  // Pinned to one template and to the third split. Merging the top-up splits
  // moves the purchase to position 1, so the hide fell on the wrong card.
  //
  // 30 Oct 2026 it stopped returning null and started returning a grey strip
  // saying where that split is edited. Fabio: "why does it go 1, 2 and then 4?
  // Small but annoying." Same question, same answer - what changed is that the
  // hole now says what it is. See lib/the-sentence-the-client-receives.test.ts.
  it('hides the purchase split by what it is, not where it sits', () => {
    expect(form).toContain('if (canBuyAndRefinance(template) && i === findPurchaseSplit(splits)) return (')
    expect(form).not.toContain("if (template === 'investment_equity' && i === 2) return null")
  })

  // Two lists of the same fact, free to disagree - and they did.
  it('reads the shared buying list instead of keeping a second copy', () => {
    expect(form).toContain('BUYING_TEMPLATES as SHARED_BUYING_TEMPLATES')
    expect(form).not.toContain("const BUYING_TEMPLATES = ['oo_purchase'")
  })
})

describe('the guard that would have found four of these', () => {
  it('is in the repo and runnable', () => {
    expect(existsSync('scripts/check-template-lists.sh')).toBe(true)
    const sh = readFileSync('scripts/check-template-lists.sh', 'utf8')
    expect(sh).toContain('TEMPLATE_LABELS')
    // It must never gate a ship. Most absences are correct.
    expect(sh).toContain('IT REPORTS, IT NEVER BLOCKS')
  })

  it('is not called by ship.sh', () => {
    expect(readFileSync('scripts/ship.sh', 'utf8')).not.toContain('check-template-lists')
  })
})
