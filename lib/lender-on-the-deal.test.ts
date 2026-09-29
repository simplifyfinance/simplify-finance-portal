// LUCY ILBERY & ANDREW LEIGH 2026.
//
// 29 Sep 2026. The lending options tab recommended Macquarie. The clients went
// to ubank - "Deal likely to auto decline in Macquarie's credit score AI
// system" - and the decision was recorded properly: lo_data said No and ubank,
// the compliance copy said ubank, and the deal's lender row said ubank.
//
// The deal structure strip still said Macquarie. The notes still said Macquarie
// however many times they were re-run.
//
// Fabio: "we have a situation where we recommend Macqaurie, then issue
// complaince...customer change their mind or we had to pivot lenders we click
// the buttoin to change the clients decision this SHOULD AUTOMATICALLY CHNAGE
// the deal structure than a flag on complaince to say data is behind how can
// this be missed its locial".
//
// It is logical. The record had the answer; the readers were asking a different
// question. Every one of them read `recommendedLender`, which answers "who did
// we recommend", and printed it where the page means "who is this deal with".

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { optionOnTheDeal, optionGap, lenderOnTheDeal } from './client-agreement'
import { dealRow, splitsOf } from './deal-structure'
import { dealFacts } from './deal-facts'

const MACQ = {
  id: 'opt-macq', lenderName: 'Macquarie', productName: 'Package',
  approvalDays: '5 days',
  variablePI: { enabled: true, rate: '6.04' },
  lenderSplits: [{ id: 's1', amount: '1060000', rate: '6.04', repaymentType: 'P&I' }],
}
const UBANK = {
  id: 'opt-ubank', lenderName: 'ubank', productName: 'Neat',
  approvalDays: '3 days',
  variablePI: { enabled: true, rate: '5.89' },
  lenderSplits: [{ id: 's1', amount: '1060000', rate: '5.89', repaymentType: 'P&I' }],
}

// The deal as it really is: recommended Macquarie, clients chose ubank.
const LO = {
  recommendedLender: 'Macquarie',
  recommendedOptionId: 'opt-macq',
  clientAgreedLender: 'No',
  clientChosenLender: 'ubank',
  clientChosenLenderReason: "Deal likely to auto decline in Macquarie's credit score AI system",
  lenders: [MACQ, UBANK],
}
const deal = (lo: any, extra: any = {}) => ({
  id: 'e8cffae4', lo_data: lo,
  bc_data: { splits: [{ id: 's1', amount: '1060000' }], purchasePrice: '1950000' },
  ...extra,
})

describe('the deal structure follows the decision', () => {
  it('names the lender the clients chose, not the one recommended', () => {
    expect(dealRow(deal(LO)).lender).toBe('ubank')
  })

  it('says which of the two questions it is answering', () => {
    expect(dealRow(deal(LO)).lenderSource).toBe("the client's choice, over Macquarie")
    // Nobody has gone anywhere: it is simply where it was recorded.
    expect(dealRow(deal({ ...LO, clientAgreedLender: 'Yes', clientChosenLender: '' })).lenderSource)
      .toBe('from the LO')
  })

  it('still names the recommendation when the clients agreed with it', () => {
    expect(dealRow(deal({ ...LO, clientAgreedLender: 'Yes', clientChosenLender: '' })).lender)
      .toBe('Macquarie')
  })

  it('takes the rate and the product off the CHOSEN lender option', () => {
    const s = splitsOf(deal(LO))[0]
    expect(s.rate).toBe('5.89')          // ubank's, not Macquarie's 6.04
    expect(s.productType).toBe('Neat')   // ubank's, not Macquarie's Package
  })
})

describe('a chosen lender with no option of its own', () => {
  // The clients went to a bank nobody built an option for. This is the case
  // that matters: swapping the name alone would print ubank over Macquarie's
  // 6.04% and Macquarie's Package - a real figure, a real bank, and no relation
  // between them. A wrong name gets noticed. This does not.
  const NO_OPTION = { ...LO, lenders: [MACQ] }

  it('never falls back to the recommended option', () => {
    expect(optionOnTheDeal(NO_OPTION)).toBeNull()
  })

  it('leaves the rate and the product blank rather than borrowing Macquarie\'s', () => {
    const s = splitsOf(deal(NO_OPTION))[0]
    expect(s.rate).toBe('')
    expect(s.productType).toBe('')
  })

  it('says why, in words somebody can act on', () => {
    expect(optionGap(NO_OPTION))
      .toBe('No lending option recorded for ubank — add it on the Lending options tab so the rate, product and term come off a real option')
    expect(dealRow(deal(NO_OPTION)).optionGap).toBe(optionGap(NO_OPTION))
  })

  it('will not guess between two options for the same bank', () => {
    const TWO = { ...LO, lenders: [MACQ, UBANK, { ...UBANK, id: 'opt-ubank-2', productName: 'Flex' }] }
    expect(optionOnTheDeal(TWO)).toBeNull()
    expect(optionGap(TWO)).toContain('Two lending options are both ubank')
  })

  it('is quiet when there is nothing wrong', () => {
    expect(optionGap(LO)).toBe('')
    expect(optionGap({ ...LO, clientAgreedLender: 'Yes', clientChosenLender: '' })).toBe('')
  })
})

describe('the facts the notes are written from', () => {
  // Re-running the notes handed the model this same sheet every time, and this
  // sheet said Macquarie. That is why pressing the button again never changed a
  // word on Lucy Ilbery & Andrew Leigh.
  const text = () => JSON.stringify(dealFacts(deal(LO)))

  it('names the lender the deal is with', () => {
    expect(text()).toContain('Lender on this deal: ubank')
  })

  it('carries the recommendation and the reason too, so the pack can explain the swap', () => {
    expect(text()).toContain('Originally recommended: Macquarie')
    expect(text()).toContain("auto decline in Macquarie's credit score AI system")
  })

  it('never hands over a bare "Recommended lender: Macquarie" on a ubank deal', () => {
    expect(text()).not.toContain('Recommended lender: Macquarie')
  })

  it('says nothing about a swap when there was none', () => {
    const agreed = JSON.stringify(dealFacts(deal({ ...LO, clientAgreedLender: 'Yes', clientChosenLender: '' })))
    expect(agreed).toContain('Lender on this deal: Macquarie')
    expect(agreed).not.toContain('Originally recommended')
  })
})

describe('the rule, so it cannot come back', () => {
  // Not a test about ubank. The failure was one field answering two different
  // questions, and it will happen again the next time somebody needs a lender
  // name in a hurry. `lenderOnTheDeal` is the answer to "who is this deal
  // with"; `recommendedLender` is only ever the answer to "who did we
  // recommend", which is a sentence about the past.
  const ALLOWED = new Set([
    'client-agreement.ts',      // where lenderOnTheDeal is built
    'recommended-option.ts',    // which OPTION was recommended - by definition
    'box-one.ts',               // "X was recommended after comparing against Y"
    'box-four.ts',              // the same comparison sentence
    'deal-field-names.ts',      // the label on a form field
    'factfind-form-content.ts', // "Our recommendation - X", a heading about the past
    'box-fixture.ts',           // a fixture
    'deal-facts.ts',            // prints BOTH, labelled - covered above
    'handover-view.ts',         // "Our recommendation — X", a heading about the past
  ])

  it('no library reads recommendedLender to answer "who is this deal with"', () => {
    const offenders = readdirSync('lib')
      .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !ALLOWED.has(f))
      .filter(f => {
        const src = readFileSync(`lib/${f}`, 'utf8')
          .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
        return /recommendedLender/.test(src)
      })
    expect(offenders).toEqual([])
  })

  // THE SAME MISTAKE, ONE LEVEL DOWN.
  //
  // 29 Sep 2026, an hour after the first fix shipped. The deal structure said
  // ubank and the handover said "Macquarie's Offset Home Loan has been
  // recommended, on a variable rate of 6.03%" - because structureOf was reading
  // recommendedOption. The name was right and everything hanging off it was
  // wrong, which is harder to spot than a wrong name.
  //
  // recommendedOption answers "which option did we recommend". Where a file
  // means "which option is this deal on", it must ask optionOnTheDeal.
  const OPTION_ALLOWED = new Set([
    'client-agreement.ts',    // where optionOnTheDeal is built from it
    'recommended-option.ts',  // the question itself
    'handover-view.ts',       // "Our recommendation - X", a heading about the past
  ])

  it('no library reads recommendedOption to answer "which option is this deal on"', () => {
    const offenders = readdirSync('lib')
      .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !OPTION_ALLOWED.has(f))
      .filter(f => {
        const src = readFileSync(`lib/${f}`, 'utf8')
          .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
        return /recommendedOption\s*\(/.test(src)
      })
    expect(offenders).toEqual([])
  })

  it('the handover reads the option the deal is on', () => {
    // box-one's structureOf feeds every sentence in box four's assessment: the
    // serviceability calculator, the product, the rate, the fees, the turnaround.
    expect(readFileSync('lib/box-one.ts', 'utf8')).toContain('optionOnTheDeal')
  })

  it('lenderOnTheDeal is what the strip and the facts both call', () => {
    for (const f of ['deal-structure.ts', 'deal-facts.ts', 'offer-accepted-panel.ts']) {
      expect(readFileSync(`lib/${f}`, 'utf8')).toContain('lenderOnTheDeal')
    }
  })

  it('and it answers the question', () => {
    expect(lenderOnTheDeal(LO)).toBe('ubank')
    expect(lenderOnTheDeal({ ...LO, clientAgreedLender: 'Yes', clientChosenLender: '' })).toBe('Macquarie')
  })
})
