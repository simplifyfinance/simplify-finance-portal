// ONE PURCHASE BREAKDOWN, ON EVERY SCENARIO THAT BUYS SOMETHING.
import { dutyLabel } from './duty-state'
//
// Fabio, 16 Sep 2026: "I dont like how all our purchases are broken down,
// customers are confused. I want ALL purchases to be Purchase Price / Stamp Duty
// / Total cost (plus solicitor's fees, and incidentals) / Loan amount / Your
// contribution required (coming from your savings)."
//
// Eight cards in the client email described a purchase and no two agreed. Some
// put the deposit between the price and the duty. Some called the loan "total
// lending". The incidentals note was stuck to the deposit, where it reads as a
// warning about the deposit rather than about the whole cost. Only one of the
// eight - equity release + purchase - showed a total cost at all.
//
// TOTAL COST IS NOT A BOX AND WILL NEVER BE ONE. It is the purchase price plus
// the duty, added up at the moment the email is built, so it cannot disagree
// with the two lines above it. Fabio: "we dont have a box that says total cost,
// dont want to add another box just for that, rule is total cost is purchase
// price plus stamp duty."
//
// AND THE CONTRIBUTION IS ALREADY THE RIGHT NUMBER. The BC keeps
// deposit = price - loan + stamp duty in every direction - see
// handlePurchasePriceChange, handleDepositChange, handleStampDutyChange and
// handleLoanAmountChange in BCForm. Rearranged that is total cost minus the
// loan, which is exactly what this block claims it is. Nothing here recomputes
// it; the box is already the answer.

import { money, readMoney } from './money'
import { clientLoan, lmiTrailingLines } from './lmi'

const txt = (v: any) => String(v ?? '').trim()

// On the TOTAL, which is what they are actually being warned about. It used to
// hang off the deposit row.
export const INCIDENTALS = " (plus solicitor's fees, and incidentals)"

// `note` marks a row that is a SENTENCE rather than a figure. The renderer
// gives it the full width instead of right-aligning it in the money column,
// where a sentence reads like an amount that lost its number.
export type PurchaseRow = { label: string; value: string; note?: boolean }

export type PurchaseInput = {
  price: any
  duty: any
  // "Stamp duty" in Victoria, "Transfer duty" elsewhere - the portal already
  // gets this right per deal and it is not this file's business to flatten it.
  dutyLabel: string
  // First home buyer prints "$0 — first home buyer exemption" rather than a
  // figure, and that is a sentence, not an amount.
  dutyText?: string
  loan: any
  contribution: any
  // "savings", "sale proceeds and savings", "equity release and personal
  // savings" - whatever the deal actually says.
  contributionFrom?: string
  // THE LMI, WHERE IT BELONGS. Added 24 Sep 2026. Capitalised, the premium goes
  // INTO the loan line above and the base figure never reaches the client;
  // paid at settlement it goes under the contribution, which is what it is -
  // more money to find on the day. See clientLoan() in lib/lmi.ts.
  lmiApplicable?: any
  lmi?: any
  lmiTreatment?: any
}

export function purchaseRows(input: PurchaseInput): PurchaseRow[] {
  const out: PurchaseRow[] = []
  const add = (label: string, value: string) => { if (value) out.push({ label, value }) }

  add('Purchase price', money(input.price))
  add(input.dutyLabel, txt(input.dutyText) || money(input.duty))

  // Only where there is a price to build it on. A "total cost" equal to the
  // stamp duty on its own is not a total of anything.
  const price = readMoney(input.price)
  if (price !== null && price > 0) {
    add(`Total cost${INCIDENTALS}`, money(price + (readMoney(input.duty) || 0)))
  }

  // NEVER "$0" FOR A LOAN OR A CONTRIBUTION.
  //
  // Jacob Joson, 16 Sep 2026: price $510,000, loan $408,000, deposit box left at
  // 0. Printed as typed that tells a client they need to find nothing on a deal
  // that needs $119,500 - and $0 is a claim, not a missing figure. The same rule
  // the construction repayment already follows: "left out entirely when nobody
  // has typed a repayment, rather than mailing a client $0 / month".
  //
  // A zero duty is different and stays: on a first home buyer it is the answer.
  const amount = (v: any) => { const n = readMoney(v); return n && n > 0 ? money(n) : '' }

  // ONE LOAN LINE. Capitalised, this is the base plus the premium and the
  // sentence under it says so. Every other answer leaves it exactly as typed.
  const loan = clientLoan(input, readMoney(input.loan))
  add('Loan amount', amount(loan.amount))
  if (loan.note && loan.amount) out.push({ label: '', value: loan.note, note: true })

  // THE CONTRIBUTION IS WORKED FROM THE BASE LOAN, NEVER FROM THE BOX.
  //
  // 14 Oct 2026. An investment pre-approval went out showing a loan amount with
  // the LMI and the lender's risk fee inside it, and a contribution worked out
  // by subtracting that figure from the total cost. The client was told to
  // bring about $24,000 less than they actually needed.
  //
  // A capitalised fee is BORROWED, not paid. It raises the debt and buys none
  // of the house, so the cash required on the day does not move. Fabio had
  // already set this rule for the internal funds-to-complete strip on 3 Sep
  // 2026 - "it doesnt impact funds to complete as LMI and risk fee is
  // capitalised on the loans" - and said it again on 14 Oct: "funds to complete
  // need to be calculated exclusing fee only using base loan". The client email
  // was the one place still taking the deposit box at its word.
  //
  // The box is only right while something keeps it in step with the loan. The
  // BC does that through handlePurchasePriceChange and its siblings, but only
  // on a linked purchase, and never when the figure typed into the split
  // already had the fees inside it - which is exactly what happened here.
  //
  // So it is worked out instead of trusted: total cost minus the base loan.
  // `input.loan` is the base - the splits before any premium - because the
  // premium is added below, inside clientLoan(), and nowhere else.
  //
  // The box is still used where the sum cannot be done: no price, or no loan
  // recorded yet. A number nobody can check beats no number at all.
  const totalCost = totalPurchaseCost(input.price, input.duty)
  const baseLoan = readMoney(input.loan)
  const worked = totalCost !== null && baseLoan !== null && baseLoan > 0
    ? totalCost - baseLoan
    : null

  const from = txt(input.contributionFrom)
  add(`Your contribution required${from ? ` (coming from your ${from.toLowerCase()})` : ''}`,
      amount(worked !== null && worked > 0 ? worked : input.contribution))

  // Paid at settlement, or recorded with nobody yet saying how it is paid.
  for (const line of lmiTrailingLines(input)) out.push({ label: line.label, value: line.value })

  return out
}

// Kept so a test can state the rule on its own, and so nothing else in the
// codebase is tempted to write price + duty out by hand.
export function totalPurchaseCost(price: any, duty: any): number | null {
  const p = readMoney(price)
  if (p === null || p <= 0) return null
  return p + (readMoney(duty) || 0)
}

// DUTY IS A STATE TAX, AND THE LABEL SAYS WHICH STATE.
//
// Printing it unlabelled, or labelled NSW for everyone, puts a figure on screen
// that may belong to a different state. This lived as a private copy inside
// components/OfferAccepted.tsx and a second one inside the client email route;
// it sits here now, beside the rows it labels, so the third copy never gets
// written. (The email route's own copy predates this and should move onto it
// the next time that file is opened.)
// One label, in one place. See lib/duty-state.ts for why this stopped reading
// bc.dutyState for itself.
export function dutyLabelFor(bc: any): string {
  return dutyLabel(bc)
}
