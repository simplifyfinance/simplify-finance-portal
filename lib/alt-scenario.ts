// AN ALTERNATIVE SCENARIO IS A LOAN, AND A LOAN HAS A REPAYMENT TYPE.
//
// Fabio, 24 Sep 2026, on Ravi Kishore: "alternative scenario deposit not being
// worked from figures LMI is not being included when calculating LVR and theres
// no repyament type and IO for howe many years this shouldve been addressed"
//
// Four separate faults, all with the same cause: the alternative scenario was
// built as a cut-down copy of the main scenario and then never kept up with it.
//
//   1. The repayment type was hard-set to "P&I" when the box was created and
//      there was never a control to change it. The email worked the estimated
//      repayment off it, so an interest-only alternative printed the P&I figure
//      - $3,714 a month against a true $3,249 - and nothing said which it was.
//
//   2. The interest-only period joined the main loan splits on 17 Sep 2026. The
//      alternative never got one, so an interest-only option could not say how
//      long it ran.
//
//   3. Typing a loan amount on an alternative recalculated nothing. The main
//      scenario works the deposit back out for you; the alternative left the old
//      figure sitting there, which is a wrong deposit printed with confidence.
//
//   4. The LVR was the loan over the price and nothing else. Whether the LMI
//      premium belongs in that figure depends on whether it is capitalised - a
//      question the main scenario asks and the alternative did not. It silently
//      borrowed the main scenario's answer, so on a deal where Option 1
//      capitalises and Option 2 does not, the email stated it wrongly.
//
// The arithmetic lived in two places that could drift: once in BCForm for the
// box on screen, and again inside the email route for the column the client
// reads. This file is the one copy. Both call it.
//
// UNANSWERED STAYS UNANSWERED. Every alternative already saved has no repayment
// type anybody chose and no LMI treatment. totalLoan() below returns the base
// loan untouched until somebody answers, so those deals print exactly what they
// printed before today.

import { readMoney } from './money'
import { lmiAmount, totalLoan } from './lmi'
import { estimatedRepayment } from './email-figures'
import { repaymentOf } from './split-cards'

const num = (v: any) => readMoney(v) ?? 0

export type AltLvr = {
  // The loan over the security, before any LMI. This is the figure that decides
  // whether LMI applies at all, so it is what gates the LMI questions - using
  // the LMI-inclusive figure there would be circular.
  base: number
  // What to show. Equals `base` until somebody says the premium is capitalised.
  percent: number
  includesLmi: boolean
}

// One rounding rule, up to one decimal place, the same one the main scenario has
// always used. 87.656% reads as 87.7%, never 87.6% - an LVR is never rounded
// down towards a threshold it has not met.
function pct(loan: number, security: number): number {
  return security > 0 ? Math.ceil((loan / security) * 1000) / 10 : 0
}

// A PURCHASE ALTERNATIVE. Security is the purchase price.
export function altLvrPurchase(alt: any): AltLvr {
  const price = num(alt?.purchasePrice)
  const base = num(alt?.loanAmount)
  const drawn = totalLoan(alt, base) ?? base
  return { base: pct(base, price), percent: pct(drawn, price), includesLmi: drawn > base }
}

// AN EQUITY RELEASE ALTERNATIVE. Security is the property value, and the lending
// is what is owed today plus what is being released.
export function altLvrEquity(alt: any, existingLoanBal: any, propertyValue: any): AltLvr {
  const value = num(propertyValue)
  const base = num(existingLoanBal) + num(alt?.equityReleaseAmount)
  const drawn = totalLoan(alt, base) ?? base
  return { base: pct(base, value), percent: pct(drawn, value), includesLmi: drawn > base }
}

// WHAT IS ACTUALLY BORROWED, which is what a repayment is worked out on. The
// same rule as the main scenario: the amount typed into the box is the BASE
// loan and the portal adds the premium when it is capitalised.
export function altDrawnLoan(alt: any): number {
  const base = num(alt?.loanAmount)
  return totalLoan(alt, base) ?? base
}

// THE REPAYMENT. Typed wins, always - the same rule a loan split follows, and
// for the same reason: a broker typing the lender's own number means that
// number. Only when the box is empty is one worked out, off the drawn loan, the
// rate, the repayment type and the interest-only period.
export function altRepayment(alt: any, loanTerm: any): string {
  return repaymentOf({
    repayment: alt?.repayment,
    amount: altDrawnLoan(alt) || alt?.loanAmount,
    rate: alt?.rate,
    type: alt?.type,
    ioYears: alt?.ioYears,
  }, loanTerm)
}

// The worked-out figure on its own, with nothing typed taken into account. The
// form shows this under an empty Repayment box so the broker can see what the
// email will print before it prints it.
export function altEstimatedRepayment(alt: any, loanTerm: any): string {
  return estimatedRepayment(altDrawnLoan(alt) || alt?.loanAmount, alt?.rate, loanTerm, alt?.type)
}

// --- the three figures that move each other ---------------------------------
//
// Stamp duty is paid out of the deposit, so only what is left of the deposit
// reduces the loan. Same arithmetic as the main scenario, written once.

export function loanFromDeposit(price: any, deposit: any, stampDuty: any): number {
  return Math.max(0, Math.round(num(price) - (num(deposit) - num(stampDuty))))
}

// The other direction, which the alternative never had. Type a loan amount and
// the deposit it implies is worked out, exactly as the main scenario does.
export function depositFromLoan(price: any, loan: any, stampDuty: any): number {
  return Math.max(0, Math.round(num(price) - num(loan) + num(stampDuty)))
}

// Does this alternative need the LMI questions asked of it? Base LVR over 80,
// same threshold as everywhere else.
export function altNeedsLmi(lvr: AltLvr): boolean {
  return lvr.base > 80
}

// An LMI estimate recorded with no treatment chosen. The LVR then reads as it
// always did, which is correct but incomplete - the form says so beside it
// rather than silently picking one.
export function altLmiUnanswered(alt: any): boolean {
  return lmiAmount(alt) !== null && !String(alt?.lmiTreatment ?? '').trim()
}
