// A CAPITALISED PREMIUM IS PART OF THE LOAN, WHEREVER THE LOAN IS STATED.
//
// 27 Oct 2026. Fabio, on a client email with a $912,000 loan in one box and a
// $886,000 loan in the box directly underneath: "This HAS BEEN ADDRESSED
// muuuuultiple times we are ticking the box to capitalise LMI but HTML the
// loan is not including LMI so that figures is not carrying accross".
//
// WHY IT KEPT COMING BACK, which matters more than the fix.
//
// The rule was set on 24 Sep 2026 and it is in his words, written into
// lib/build-card.ts that day: "when the premium is capitalised there is ONE
// loan line and it is the one they borrow. The base figure is an internal
// working and does not belong in a client's inbox."
//
// The test written alongside it, lib/one-loan-line.test.ts, checked that
// splitRows() COULD add the premium when handed the deal, and - in a case
// called "without the deal passed in it reads exactly as it did before" -
// asserted that it does NOT when it is not handed it. Both passed. Neither
// ever asked whether anything actually hands it the deal. Exactly one template
// out of six did.
//
// So this file does not look at code. It builds the figures a client reads and
// reads them back. A template added next year that forgets the premium fails
// the day somebody writes it, not five weeks later on a client's screen.
import { describe, it, expect } from 'vitest'
import {
  clientLoan, totalLoan, drawnLoan, totalLendingLine, lmiAmount, lmiTreatment,
  LMI_CAPITALISED, LMI_SETTLEMENT,
} from './lmi'
import { splitRows } from './split-cards'
import { loanAmount } from './funds-to-complete'

// FABIO'S DEAL, 27 Oct 2026. $1,000,000 in QLD, $114,000 contributed after
// $36,000 of duty, LMI of $26,000 capitalised. The base lending is $886,000
// and the loan he signs for is $912,000.
const BC = {
  template: 'oo_purchase', state: 'QLD',
  purchasePrice: '1000000', deposit: '114000', stampDuty: '36000',
  lmiApplicable: 'Applicable', lmi: '26000', lmiTreatment: LMI_CAPITALISED,
  loanTerm: '30',
  splits: [{ label: 'Owner-occupied loan', amount: '886000', rate: '6.90', type: 'P&I',
             repayment: '6007' }],
}
const BASE = 886000
const DRAWN = 912000

describe('the one he circled', () => {
  it('the split card says the loan he signs for, not the base', () => {
    const rows = splitRows(BC.splits[0], BC.loanTerm, { termWithType: true, lmiBc: BC })
    expect(rows.find(r => r.label === 'Loan amount')?.value).toBe('$912,000')
  })

  it('and says why, so it is not just a different number', () => {
    const rows = splitRows(BC.splits[0], BC.loanTerm, { termWithType: true, lmiBc: BC })
    expect(rows.find(r => r.note)?.value).toBe('includes LMI of $26,000, added to the loan')
  })

  it('which is the same figure the purchase box above it already showed', () => {
    // Two boxes, one email, two different loans. That was the whole complaint.
    expect(totalLoan(BC, BASE)).toBe(DRAWN)
    expect(clientLoan(BC, BASE).amount).toBe(DRAWN)
  })

  it('and the repayment is left exactly alone', () => {
    // Fabio, the same hour: "the ampunt is correct because I INPUTTED remeber
    // you dont calculate PI". $6,007 is the P&I payment on $912,000 and he
    // typed it. The portal only ever calculates interest only.
    const rows = splitRows(BC.splits[0], BC.loanTerm, { termWithType: true, lmiBc: BC })
    expect(rows.find(r => r.label === 'Estimated repayments')?.value).toBe('$6,007')
  })
})

describe('compliance says the loan they sign for', () => {
  const deal = { bc_data: BC }

  it('which is not what loanAmount() answers', () => {
    // loanAmount() is the sum of the splits and must stay that way - the LVR,
    // the pipeline and the commission all read it.
    expect(loanAmount(deal)).toBe(BASE)
  })

  it('so the sentence uses the drawn loan instead', () => {
    expect(drawnLoan(deal, loanAmount(deal))).toBe(DRAWN)
  })

  it('and a deal with no LMI is untouched by any of this', () => {
    const plain = { bc_data: { ...BC, lmiApplicable: 'Not applicable', lmi: '' } }
    expect(drawnLoan(plain, loanAmount(plain))).toBe(BASE)
  })

  it('as is a deal paying the premium at settlement', () => {
    // Paid on the day is not borrowed. It never joins the loan.
    const settle = { bc_data: { ...BC, lmiTreatment: LMI_SETTLEMENT } }
    expect(drawnLoan(settle, loanAmount(settle))).toBe(BASE)
    expect(clientLoan(settle.bc_data, BASE).amount).toBe(BASE)
  })

  it('and a deal nobody has answered the question on', () => {
    const unanswered = { bc_data: { ...BC, lmiTreatment: '' } }
    expect(lmiTreatment(unanswered.bc_data)).toBe('unanswered')
    expect(drawnLoan(unanswered, loanAmount(unanswered))).toBe(BASE)
  })
})

describe('two splits, where nothing says which one carries it', () => {
  const two = { ...BC, splits: [
    { label: 'Owner-occupied loan', amount: '600000', rate: '6.90', type: 'P&I' },
    { label: 'Investment loan', amount: '286000', rate: '7.10', type: 'Interest only' },
  ] }

  it('neither card is touched', () => {
    for (const sp of two.splits) {
      const rows = splitRows(sp, two.loanTerm, { termWithType: true })
      expect(rows.find(r => r.note)).toBeUndefined()
    }
  })

  it('and the total is said once, underneath them', () => {
    expect(totalLendingLine(two, 886000, 2))
      .toBe('Total lending $912,000 — includes LMI of $26,000, added to the loan')
  })

  it('but never on a single split, which carries it in its own row', () => {
    // Saying it twice is the double-count this whole file exists to prevent.
    expect(totalLendingLine(BC, BASE, 1)).toBe('')
  })

  it('or where there is no capitalised premium to say', () => {
    expect(totalLendingLine({ ...two, lmiTreatment: LMI_SETTLEMENT }, 886000, 2)).toBe('')
    expect(totalLendingLine({ ...two, lmiApplicable: 'Not applicable', lmi: '' }, 886000, 2)).toBe('')
  })
})

describe('nothing states a loan without asking about the premium', () => {
  // The list is in scripts/check-lmi-carries.sh, which fails the ship. This
  // holds the two that are easiest to lose, because they are the two that
  // reach a client or a regulator.
  it('every email and both compliance boxes', async () => {
    const { readFileSync } = await import('fs')
    const ASKS = /clientLoan\(|totalLoan\(|drawnLoan\(|totalLendingLine\(/
    for (const f of ['app/api/generate-email/route.ts',
                     'app/api/generate-lo-email/route.ts',
                     'lib/box-one.ts', 'lib/box-four.ts']) {
      expect(readFileSync(f, 'utf8'), `${f} states a loan and never asks about LMI`)
        .toMatch(ASKS)
    }
  })

  it('and the split card is not gated behind a template flag again', () => {
    // `lmiOnTheSplit` was true on one template out of six. That one line is
    // the bug, and this is the shape of it.
    const src = require('fs').readFileSync('app/api/generate-email/route.ts', 'utf8')
      .split('\n').filter((l: string) => !l.trim().startsWith('//')).join('\n')
    expect(src, 'the premium is behind a template flag again')
      .not.toContain('lmiOnTheSplit && splits.length')
    // 29 Oct 2026. A premium recorded against a security now prints on the
    // split secured by it - knowable since the purchase split started naming
    // its house. The deal is still handed over behind it, for the deals whose
    // premium is recorded at deal level and have one split to carry it.
    expect(src).toContain('lmiOnSecurity(d, splitSecurityId(sp)) || (splits.length === 1 ? d : undefined)')
  })
})
