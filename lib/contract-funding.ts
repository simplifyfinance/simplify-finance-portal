// THE PRICE MOVED. HOW MUCH ARE THE CLIENTS PUTTING IN?
//
// Fabio, 28 Sep 2026: "new stmap duty is always typed by the team... depsoit is
// the only real question what the customer would like to do and YES depsoit
// needs to be enough to cover duty so purcahse pirce + duty = total cost -
// deposit = loan amount".
//
// THE FIRST VERSION OF THIS FILE HAD IT BACKWARDS. It asked which LOAN they
// wanted and worked the contribution out from that. That is not how a purchase
// is reworked and it is not how this portal has ever worked: the deposit is what
// you ask a client, and the loan is what falls out of it. lib/purchase-rows.ts
// says so in as many words - "the BC keeps deposit = price - loan + stamp duty
// in every direction". Rearranged, that is the sum above.
//
// DUTY IS NEVER CALCULATED HERE. Fabio, 28 Sep: "we will type duty". State
// scales, first home concessions, foreign surcharges and thresholds that move in
// budgets - a figure we worked out would be wrong for somebody, and wrong duty
// is money a client turns up without on the day.
//
// THE LVR IS NOT CALCULATED HERE EITHER. It is asked of the real one, by handing
// lvrOf a copy of the deal carrying the figures it would have. A second
// implementation would drift from the first the week somebody changed how
// security is counted - and this codebase has already been bitten by an LVR that
// looked right and was 158.8%.

import { lvrOf, securityValue } from './funds-to-complete'
import { contractStampDuty } from './contract-figures'
import { loanAmount } from './funds-to-complete'

const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// Above this, lenders mortgage insurance comes into it.
const LMI_AT = 80

export type Reworked = {
  price: number
  duty: number
  // Never a box. Fabio, 16 Sep 2026: "we dont have a box that says total cost,
  // dont want to add another box just for that, rule is total cost is purchase
  // price plus stamp duty." Added up here so it cannot disagree with its parts.
  totalCost: number
  deposit: number
  loan: number
  lvr: number | null
  // Crosses 80 when it did not before. A deal already above it learns nothing
  // from being told, and a warning that fires on everything stops being read.
  bringsLmiIn: boolean
}

// WHAT THE CLIENTS WERE ALREADY GOING TO BRING. The BC keeps this in step with
// the price, the duty and the loan in every direction, so it is read rather
// than recomputed wherever it is there.
export function depositAsAssessed(deal: any): number {
  const bc = deal?.bc_data || {}
  const recorded = num(bc.deposit)
  if (recorded > 0) return recorded
  const price = num(bc.purchasePrice) || num(bc.newPurchasePrice)
  const duty = num(bc.stampDuty)
  // loanAmount() decides this, and it already falls back to the BC's splits -
  // which is what the second half of this expression was doing by hand, in the
  // wrong order. See lib/funds-to-complete.ts.
  const loan = loanAmount(deal)
  if (price <= 0 || loan <= 0) return 0
  return Math.max(0, Math.round(price + duty - loan))
}

// The duty to work with: what the team typed against the contract, falling back
// to the BC's figure until they have.
export function dutyNow(deal: any): number {
  return contractStampDuty(deal) || num(deal?.bc_data?.stampDuty)
}

// The whole rework, from one number. Null when there is nothing to rework: no
// contract price, or no deposit answered yet.
export function reworkFromDeposit(deal: any, depositIn: any): Reworked | null {
  const price = num(deal?.contract_price)
  const deposit = num(depositIn)
  if (price <= 0 || deposit <= 0) return null

  const duty = dutyNow(deal)
  const totalCost = price + duty
  // Never negative. A deposit larger than the whole cost means no lending, not
  // a loan of minus forty thousand.
  const loan = Math.max(0, Math.round(totalCost - deposit))

  const lvrBefore = lvrOf({ ...deal, contract_price: 0, contract_loan_amount: 0 })
  const lmiAlready = lvrBefore !== null && lvrBefore > LMI_AT
  const lvr = lvrOf({ ...deal, contract_price: price, contract_loan_amount: loan })

  return {
    price, duty, totalCost, deposit, loan, lvr,
    bringsLmiIn: !lmiAlready && lvr !== null && lvr > LMI_AT,
  }
}

// THE DEPOSIT THAT KEEPS THE LVR WHERE IT WAS.
//
// Fabio, 28 Sep 2026: "we normally keep the 80% at $760,000 so keep same LVR".
// Offered as a figure, never chosen for them - it is a question for the client.
// Worked from the SECURITY rather than the price, so it still holds on a deal
// with another property in the mix, where LVR was never loan over price.
export function depositToKeepLvr(deal: any): number {
  const price = num(deal?.contract_price)
  if (price <= 0) return 0
  const lvrBefore = lvrOf({ ...deal, contract_price: 0, contract_loan_amount: 0 })
  if (lvrBefore === null || lvrBefore <= 0) return 0
  const total = securityValue({ ...deal, contract_price: price }).total
  if (total <= 0) return 0
  const loan = Math.round((lvrBefore / 100) * total)
  return Math.max(0, Math.round(price + dutyNow(deal) - loan))
}

// Has the price actually moved? Nothing is asked when it has not.
export function priceHasMoved(deal: any): boolean {
  const bc = deal?.bc_data || {}
  const was = num(bc.purchasePrice) || num(bc.newPurchasePrice)
  const now = num(deal?.contract_price)
  return was > 0 && now > 0 && was !== now
}

// THE DUTY IS NOW WRONG AND NOBODY HAS SAID SO.
//
// It is typed on the BC against the assessed price. The moment a contract comes
// in at something else it is stale, and funds to complete would go on charging
// the client duty on a price they did not pay.
export function stampDutyNeedsUpdating(deal: any): boolean {
  if (!priceHasMoved(deal)) return false
  if (num(deal?.bc_data?.stampDuty) <= 0) return false   // never had one; another gap
  return contractStampDuty(deal) <= 0
}
