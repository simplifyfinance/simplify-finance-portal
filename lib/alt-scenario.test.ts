// Ravi Kishore's Option 2, and the four things it could not say.
// Written from the figures on Fabio's screen, 24 Sep 2026.

import { describe, it, expect } from 'vitest'
import {
  altLvrPurchase, altLvrEquity, altDrawnLoan, altRepayment, altEstimatedRepayment,
  loanFromDeposit, depositFromLoan, altNeedsLmi, altLmiUnanswered,
} from './alt-scenario'
import { LMI_CAPITALISED, LMI_SETTLEMENT } from './lmi'

// Purchase $640,000, deposit $114,000, stamp duty $35,000, loan $561,000 at
// 6.95%, LMI applicable, estimate $9,000.
const ravi = (extra: any = {}) => ({
  purchasePrice: '640,000', deposit: '114,000', stampDuty: '35,000',
  loanAmount: '561,000', rate: '6.95',
  lmiApplicable: 'Applicable', lmi: '9,000',
  ...extra,
})

describe('the LVR, and whether the LMI is in it', () => {
  it('reads exactly as it does today while nobody has answered the question', () => {
    const lvr = altLvrPurchase(ravi())
    expect(lvr.percent).toBe(87.7)
    expect(lvr.includesLmi).toBe(false)
    expect(altLmiUnanswered(ravi())).toBe(true)
  })

  it('capitalised: the premium is borrowed, so it is in the LVR', () => {
    const lvr = altLvrPurchase(ravi({ lmiTreatment: LMI_CAPITALISED }))
    expect(lvr.percent).toBe(89.1)
    expect(lvr.base).toBe(87.7)
    expect(lvr.includesLmi).toBe(true)
  })

  it('paid at settlement: the premium is not borrowed, so it is not in the LVR', () => {
    const lvr = altLvrPurchase(ravi({ lmiTreatment: LMI_SETTLEMENT }))
    expect(lvr.percent).toBe(87.7)
    expect(lvr.includesLmi).toBe(false)
  })

  it('LMI waived adds nothing, whatever the treatment says', () => {
    expect(altLvrPurchase(ravi({ lmiApplicable: 'Waived', lmiTreatment: LMI_CAPITALISED })).percent).toBe(87.7)
  })

  it('an LMI status with no figure against it is a gap, not a number', () => {
    expect(altLvrPurchase(ravi({ lmi: '', lmiTreatment: LMI_CAPITALISED })).percent).toBe(87.7)
  })

  it('rounds up, never down towards a threshold it has not met', () => {
    // $561,000 / $640,000 is 87.656%.
    expect(altLvrPurchase(ravi()).percent).toBe(87.7)
    // Exactly 80% stays 80% and does not tip into LMI territory.
    expect(altLvrPurchase({ purchasePrice: '500,000', loanAmount: '400,000' }).percent).toBe(80)
  })

  it('no price means no LVR, not a division by zero', () => {
    expect(altLvrPurchase({ purchasePrice: '', loanAmount: '561,000' }).percent).toBe(0)
    expect(altLvrPurchase({}).percent).toBe(0)
  })

  it('the LMI questions are gated on the LVR BEFORE the premium, not after', () => {
    // Otherwise adding the premium raises the LVR, which shows the question,
    // which adds the premium - the answer chasing its own tail.
    const under = { purchasePrice: '640,000', loanAmount: '505,000',
                    lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_CAPITALISED }
    expect(altLvrPurchase(under).base).toBe(79)
    expect(altNeedsLmi(altLvrPurchase(under))).toBe(false)
    expect(altNeedsLmi(altLvrPurchase(ravi()))).toBe(true)
  })
})

describe('an equity release alternative', () => {
  const alt = { equityReleaseAmount: '150,000', lmiApplicable: 'Applicable', lmi: '9,000' }

  it('is the debt today plus what is released, over the value', () => {
    expect(altLvrEquity(alt, '400,000', '700,000').percent).toBe(78.6)
  })

  it('takes its own capitalised answer, not the main scenario’s', () => {
    expect(altLvrEquity({ ...alt, lmiTreatment: LMI_CAPITALISED }, '400,000', '700,000').percent).toBe(79.9)
  })
})

describe('the repayment type, which was hard-set to P&I and could not be changed', () => {
  it('P&I over 30 years on Ravi’s numbers', () => {
    expect(altRepayment(ravi({ type: 'P&I' }), '30')).toBe('$3,714')
  })

  it('interest only is a different figure, and now it can be said', () => {
    expect(altRepayment(ravi({ type: 'Interest only' }), '30')).toBe('$3,249')
  })

  it('capitalised LMI is borrowed, so the repayment is worked on the bigger loan', () => {
    expect(altRepayment(ravi({ type: 'P&I', lmiTreatment: LMI_CAPITALISED }), '30')).toBe('$3,773')
    expect(altRepayment(ravi({ type: 'Interest only', lmiTreatment: LMI_CAPITALISED }), '30')).toBe('$3,301')
    expect(altDrawnLoan(ravi({ lmiTreatment: LMI_CAPITALISED }))).toBe(570000)
  })

  it('a figure the broker typed is never overwritten by one we worked out', () => {
    expect(altRepayment(ravi({ type: 'P&I', repayment: '3,600' }), '30')).toBe('$3,600')
    // ...and the worked-out one is still available to show beside it.
    expect(altEstimatedRepayment(ravi({ type: 'P&I', repayment: '3,600' }), '30')).toBe('$3,714')
  })

  it('no rate, or no loan, means no figure invented', () => {
    expect(altRepayment(ravi({ type: 'P&I', rate: '' }), '30')).toBe('')
    expect(altRepayment({ type: 'P&I', rate: '6.95' }, '30')).toBe('')
  })

  it('P&I with no loan term stays blank rather than guessing thirty years', () => {
    expect(altRepayment(ravi({ type: 'P&I' }), '')).toBe('')
    // Interest only does not need a term - it is the rate on the balance.
    expect(altRepayment(ravi({ type: 'Interest only' }), '')).toBe('$3,249')
  })
})

describe('the deposit and the loan move each other, both ways', () => {
  it('deposit to loan: stamp duty comes out of the deposit first', () => {
    expect(loanFromDeposit('640,000', '114,000', '35,000')).toBe(561000)
  })

  it('loan to deposit: the direction the alternative never had', () => {
    expect(depositFromLoan('640,000', '561,000', '35,000')).toBe(114000)
  })

  it('they are each other’s reverse, so typing either way lands on the same pair', () => {
    const loan = loanFromDeposit('900,000', '200,000', '48,000')
    expect(depositFromLoan('900,000', String(loan), '48,000')).toBe(200000)
  })

  it('never goes negative - a deposit bigger than the price means no loan, not a credit', () => {
    expect(loanFromDeposit('640,000', '700,000', '0')).toBe(0)
    expect(depositFromLoan('640,000', '700,000', '0')).toBe(0)
  })

  it('a blank stamp duty is nought, not a NaN', () => {
    expect(loanFromDeposit('640,000', '114,000', '')).toBe(526000)
  })
})

describe('what does not change', () => {
  it('an alternative nobody has answered anything on prints what it always printed', () => {
    const old = { purchasePrice: '640,000', deposit: '114,000', stampDuty: '35,000',
                  loanAmount: '561,000', rate: '6.95', type: 'P&I' }
    expect(altLvrPurchase(old).percent).toBe(87.7)
    expect(altDrawnLoan(old)).toBe(561000)
    expect(altRepayment(old, '30')).toBe('$3,714')
  })
})

describe('one copy of the arithmetic, in both places that use it', () => {
  const read = async (rel: string) => {
    const fs = await import('node:fs')
    return fs.readFileSync(new URL(rel, import.meta.url), 'utf8')
  }

  it('the email route works no alternative LVR out for itself', async () => {
    const src = await read('../app/api/generate-email/route.ts')
    // The three option-column builders each had their own copy of this line.
    const own = src.match(/Math\.ceil\(\(\(?\s*(existingLoanN|loanNum)/g) || []
    expect(own).toHaveLength(0)
    expect(src).toContain('altLvrPurchase')
    expect(src).toContain('altLvrEquity')
  })

  it('the email route asks each option for its OWN capitalised answer', async () => {
    const src = await read('../app/api/generate-email/route.ts')
    // Passing d.lmiTreatment handed Option 1's answer to every other column.
    expect(src).not.toContain('lmiLines(opt, d.lmiTreatment')
    expect((src.match(/lmiLines\(opt, opt\.lmiTreatment/g) || []).length).toBe(3)
  })

  it('the email route works the alternative repayment out through the shared function', async () => {
    const src = await read('../app/api/generate-email/route.ts')
    expect((src.match(/altRepayment\(opt, d\.loanTerm\)/g) || []).length).toBe(2)
  })

  it('the form works no alternative LVR out for itself either', async () => {
    const src = await read('../app/(app)/deals/[id]/BCForm.tsx')
    expect(src).toContain('altLvrPurchase(alt)')
    expect(src).toContain('altLvrEquity(alt, existingLoanBal, propertyValue)')
  })

  it('the form offers a repayment type, an IO period and the LMI question', async () => {
    const src = await read('../app/(app)/deals/[id]/BCForm.tsx')
    expect(src).toContain('Repayment type')
    expect(src).toContain("updateAltScenario(alt.id, 'type'")
    expect(src).toContain("updateAltScenario(alt.id, 'ioYears'")
    expect(src).toContain("updateAltScenario(alt.id, 'lmiTreatment'")
  })

  it('typing a loan amount on an alternative works the deposit back out', async () => {
    const src = await read('../app/(app)/deals/[id]/BCForm.tsx')
    expect(src).toContain('handleAltLoanAmountChange')
    expect(src).toContain('depositFromLoan')
    // The old dead-end wiring must be gone.
    expect(src).not.toContain("onChange={e => updateAltScenario(alt.id, 'loanAmount', e.target.value)}")
  })
})
