import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { autoTagSplits } from './split-security-tag'
import {
  canBuyAndRefinance, securitiesWithPurchase, totalsOf, purchaseLoanOf,
  BEING_PURCHASED, lvrOf,
} from './securities'
import { financeSought, treatmentOf, increaseFor, lendingAgainst } from './top-up'
import { brokerNotes } from './broker-notes'
import { fundsToComplete } from './funds-to-complete'

// THE SAME WORK, FOR THE TEMPLATE THAT ALSO BUYS.
//
// 20 Oct 2026. Fabio, after the top up half shipped: "make sure you are doing
// the same work for top + purchase". It was not being done. The top up was
// finished and the template that does a top up AND a purchase was left wearing
// half of it, which is the worse of the two states - everything looks right
// until the one figure that is not reaches a lender.
//
// Every test below is a thing that was wrong on top_up_purchase and right on
// top_up, which is why none of them failed when the first half shipped.

const BOTANY = 'p1'

const bc = (over: any = {}) => ({
  template: 'top_up_purchase',
  securityIds: [BOTANY],
  securityBalances: { [BOTANY]: '942,441' },
  securityIncreases: { [BOTANY]: '200,000' },
  securityDollarForDollar: {},
  newPurchasePrice: '780,000',
  newPurchaseStampDuty: '31,000',
  splits: [
    { label: 'Existing loan', amount: '942,441', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BOTANY, purpose: 'investment', staying: true },
    { label: 'Loan increase', amount: '200,000', rate: '6.14', type: 'Interest only', ioYears: '5', securityId: BOTANY, purpose: 'investment' },
    { label: 'New purchase', amount: '624,000', rate: '6.39', type: 'Interest only', ioYears: '5', securityId: BEING_PURCHASED, purpose: 'investment' },
  ],
  ...over,
})

const ff = {
  applicants: [{ firstName: 'Dan', lastName: 'Hartley' }],
  properties: [
    { id: BOTANY, address: '1372 Botany Rd, Botany NSW 2019', value: '2,000,000',
      ownershipType: 'Investment', loans: [{ lenderName: 'St George', balance: '942,441' }] },
  ],
}

const deal = (over: any = {}) =>
  ({ bc_data: bc(over), fact_find_data: ff, lo_data: {} } as any)

describe('the house being bought is a security', () => {
  // The list of scenarios that buy AND refinance had one name on it. This one
  // has the same shape and was left off, so the purchase got no row at all.
  it('counts top up + purchase as a scenario that buys', () => {
    expect(canBuyAndRefinance('top_up_purchase')).toBe(true)
    expect(canBuyAndRefinance('top_up')).toBe(false)
  })

  it('gives it a row, valued at the purchase price and limited to the loan', () => {
    const rows = securitiesWithPurchase(bc(), ff)
    const buy = rows.find(r => r.id === BEING_PURCHASED)
    expect(buy).toBeTruthy()
    expect(buy!.value).toBe('780,000')
    expect(buy!.limit).toBe('624000')
    expect(lvrOf(buy!)).toBeCloseTo(80, 1)
  })

  // THE WHOLE POINT. Without its own row the $624,000 had to sit against
  // Botany, which would then carry $1,766,441 against $2,000,000 - 88% on a
  // property whose real position is 57%.
  it('leaves the topped-up house carrying only its own lending', () => {
    expect(lendingAgainst(bc(), BOTANY)).toBe(1142441)
    const rows = securitiesWithPurchase(bc(), ff)
    const botany = rows.find(r => r.id === BOTANY)
    expect(lvrOf(botany!)).toBeCloseTo(57.1, 1)
  })

  it('totals both houses for the deal-level LVR a lender assesses', () => {
    const t = totalsOf(securitiesWithPurchase(bc(), ff))
    expect(t.value).toBe(2780000)
    expect(t.limit).toBe(1766441)
    expect(t.lvr).toBeCloseTo(63.5, 1)
  })

  // Nothing is owed on a house nobody owns, and nothing can be topped up on it.
  // A figure recorded against it got there by accident.
  it('has nothing owed and nothing to top up', () => {
    expect(treatmentOf(bc(), BEING_PURCHASED)).toBe('purchase')
    expect(increaseFor(bc({ securityIncreases: { [BEING_PURCHASED]: '50,000' } }), BEING_PURCHASED)).toBe(0)
  })
})

describe('what is actually being asked for', () => {
  // The existing $942,441 is already theirs and is staying. The increase and
  // the purchase loan are the money being arranged.
  it('is the increase plus the purchase loan, and not the existing balance', () => {
    expect(purchaseLoanOf(bc())).toBe(624000)
    expect(financeSought(bc(), purchaseLoanOf(bc()))).toBe(824000)
  })

  it('still answers for a plain top up when nothing is being bought', () => {
    expect(financeSought(bc({ template: 'top_up', splits: bc().splits.slice(0, 2) }), 0)).toBe(200000)
  })

  // A dollar for dollar refinance IS a new facility for the whole balance, so
  // the whole balance is sought - plus whatever buys the house.
  it('counts a ticked security in full, on top of the purchase', () => {
    const d = bc({ securityDollarForDollar: { [BOTANY]: true } })
    expect(financeSought(d, purchaseLoanOf(d))).toBe(1566441)
  })

  // THE HEADLINE AND THE SENTENCE UNDER IT MUST AGREE. This said $200,000 and
  // then listed $824,000 of work, in the one box a bank reads.
  it('says the same figure the sentence under it adds up to', () => {
    const notes = brokerNotes(deal())
    const para = notes.paragraphs.find((p: any) => p?.key === 'deal')
    const line = String(para?.lines?.[0] || '')
    expect(line).toContain('seeking finance of $824,000')
    expect(line).toContain('$200,000 increases the existing lending against 1372 Botany Rd')
    expect(line).toContain('$624,000 funds the purchase')
    expect(line).not.toContain('seeking finance of $200,000')
  })

  it('still says the existing lending is staying put', () => {
    const line = String(brokerNotes(deal()).paragraphs.find((p: any) => p?.key === 'deal')?.lines?.[0] || '')
    expect(line).toContain('stays with its current lender and is not being refinanced')
  })

  // The caller has to pass it. Nothing else can, without lib/top-up.ts
  // importing lib/securities.ts, which already imports lib/top-up.ts.
  it('is handed the purchase loan by the notes, not left to guess', () => {
    const src = readFileSync('lib/broker-notes.ts', 'utf8')
    expect(src).toContain('financeSought(bcNow, purchaseLoanOf(bcNow))')
  })
})

describe('the deposit on a top up is the increase', () => {
  // A top up has no deal-level equity release box - the figure lives per
  // property. The fallback looked for one, found nothing, and the strip said
  // "No deposit has been recorded" on a deal whose deposit was on the screen.
  it('reads the increase rather than an equity release box it does not have', () => {
    const f = fundsToComplete(deal())
    expect(f.deposit).toBe(200000)
  })

  it('never overrules a deposit somebody typed', () => {
    const f = fundsToComplete(deal({ newPurchaseDeposit: '175,000' }))
    expect(f.deposit).toBe(175000)
  })
})

describe('the form asks the questions the scenario needs', () => {
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  // lib/bc-ready.ts refuses to send the email until newPurchasePrice and
  // newPurchaseStampDuty are filled in, and the panel holding those boxes was
  // drawn only on investment_equity. There was nowhere to answer.
  it('draws the purchase details on every scenario that buys', () => {
    expect(form).toContain('{canBuyAndRefinance(template) && (() => {')
    expect(form).not.toContain('{template === "investment_equity" && (')
  })

  // splits[2] held only while the purchase was always the third of three.
  // Merging the two top-up splits makes it the second.
  // 30 Oct 2026. It moved to lib/split-security-tag.ts, beside the auto-tagger
  // that has to agree with it. Two copies had drifted: the form found the
  // purchase by tag, label OR position, the tagger by tag or label only, and a
  // purchase split with an empty label was edited by one and ignored by the
  // other. The rule is tested in lib/one-answer-to-which-split-buys-it.test.ts.
  it('finds the purchase split rather than counting to it', () => {
    expect(form).toContain('findPurchaseSplit(')
    expect(form, 'a second copy of the rule').not.toContain('function findPurchaseSplit(')
    expect(form).not.toMatch(/splits\[2\]\?\./)
  })

  // Fabio, asked whether these controls had a purpose: the merge button moved
  // the client email's boxes and nothing else, so the repayment never followed
  // it - which is the only reason the button exists.
  it('rebuilds the splits when the merge button is pressed', () => {
    expect(form).toContain('applyIncreaseMerged(v as boolean)')
    expect(form).toContain('function applyIncreaseMerged(')
    expect(form).toContain('splitsForSecurity({')
  })

  // One unassigned split was the cause of the empty increasing-by box, the
  // short "drawn" figure and the LVR reading off the typed limit.
  //
  // 29 Oct 2026. This used to pin the three lines of the rule where they sat,
  // inline in the form. They have moved to lib/split-security-tag.ts, because
  // the gate around them was wrong - it asked "is this a top up" and the
  // purchase rule inside it is not a top-up rule, so Equity release + purchase
  // never tagged its purchase split. The form calls it; the rule itself is
  // tested properly in lib/the-purchase-is-a-security-like-any-other.test.ts
  // rather than by reading the source it lives in.
  it('puts a house against a split that has none', () => {
    expect(form).toContain('autoTagSplits(splits, template, securityIds)')
    expect(autoTagSplits([{ label: 'New purchase' }], 'top_up_purchase', ['p1'])?.[0].securityId)
      .toBe(BEING_PURCHASED)
    expect(autoTagSplits([{ label: 'Increase' }], 'top_up', ['p1'])?.[0].securityId).toBe('p1')
    expect(autoTagSplits([{ label: 'Increase', securityId: 'p2' }], 'top_up', ['p1'])).toBe(null)
  })
})

describe('pressing the layout button does not break the pack', () => {
  const form = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  // lib/top-up.ts builds the SHAPE of the splits and has never held what the
  // money is for. Rebuild without carrying it and purposeSummary() comes back
  // empty, so theDeal() refuses to write a word - "No split has a purpose
  // recorded" - because somebody pressed a layout button.
  it('carries the purpose onto the rebuilt splits', () => {
    expect(form).toContain('purpose: newMoney?.purpose || old?.purpose')
    expect(form).toContain('fundsUsedFor: newMoney?.fundsUsedFor || old?.fundsUsedFor')
  })

  // The purchase split is not against a property being topped up, so the
  // rebuild must put it back untouched rather than rewriting it as a top up.
  it('leaves every split that is not being topped up alone', () => {
    expect(form).toContain("const untouched = prev.filter(sp => !ids.includes(String(sp.securityId || '')))")
    expect(form).toContain('return [...rebuilt, ...untouched]')
  })
})
