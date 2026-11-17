// A ROUNDING IS NOT AN EQUITY RELEASE.
//
// 19 Nov 2026. Fabio: "sometimes a loan 434500 and we refinance 436000 as we
// round the refinance and add an extra month of interest to avoid settlement
// shortfall. The system is treating that small amount as equity release so we
// need to stop that."
//
// He is right, and the fault is that the portal had no sense of SIZE. There
// was one test for an equity release, asked in five places:
//
//     num(bc.equityRelease) > 0
//
// So $1,500 on a $436,000 refinance was the same kind of thing as $150,000 on
// the same loan. It went to the valuer as EQUITY_RELEASE, printed "Cash out
// $1,500" in front of the client, fired the settlement numbers email on a
// refinance where nothing changes hands, and told the compliance pack the
// client was releasing equity.
//
// WHAT THE SMALL NUMBER ACTUALLY IS. A loan rounded up to a round figure, plus
// about a month's interest, so the payout does not land short on the day. It
// is a mechanic of settling, not a purpose of borrowing, and a client never
// sees a dollar of it.
//
// THE LINE: one per cent of the loan, or $5,000, whichever is smaller.
//
// Fabio chose it, after I suggested three per cent and he said that was too
// much: "do 1% or 5K whichever is smaller". He is right about that too - three
// per cent of a million-dollar loan is thirty thousand, and thirty thousand is
// somebody's kitchen. The cap is what keeps the rule honest on a big loan: at
// half a million the allowance stops growing.
//
// NOT ONE DOLLAR MOVES. The loan is still the loan, the splits are still the
// splits, and the extra is still borrowed. This file changes what the portal
// CALLS it, never what it adds up. See the callers listed at the bottom.

import { loanAmount, splitsTotal } from './funds-to-complete'
import { releaseTotal } from './complex-refinance'

/** A share of the loan. Small deals round by a few hundred, not by thousands. */
export const RELEASE_PCT = 0.01

/** And it stops growing here, however big the loan. */
export const RELEASE_CAP = 5000

const num = (v: any): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * HOW MUCH ROUNDING THIS LOAN IS ALLOWED BEFORE IT COUNTS AS A RELEASE.
 *
 * $436,000 → $4,360. $1,000,000 → $5,000, not $10,000.
 */
export function roundingAllowance(loan: any): number {
  const n = num(loan)
  if (n <= 0) return 0
  return Math.min(n * RELEASE_PCT, RELEASE_CAP)
}

/**
 * IS THIS AMOUNT JUST THE ROUNDING?
 *
 * At the line exactly it is a release, not rounding. A number that lands on
 * the allowance to the dollar was chosen, not rounded to.
 */
export function isJustRounding(release: any, loan: any): boolean {
  const r = num(release)
  if (r <= 0) return false
  const allowed = roundingAllowance(loan)
  if (allowed <= 0) return false
  return r < allowed
}

/**
 * THE RELEASE ON THIS DEAL, WITH THE ROUNDING TAKEN OUT.
 *
 * Zero where the number is rounding. Everything that prints a cash-out figure
 * or asks "is this a release" reads this instead of the raw box.
 */
export function releaseOnDeal(deal: any): number {
  const raw = releaseTotal(deal?.bc_data || {})
  if (raw <= 0) return 0
  return isJustRounding(raw, loanAmount(deal)) ? 0 : raw
}

/** The one question, asked everywhere. */
export function isEquityRelease(deal: any): boolean {
  return releaseOnDeal(deal) > 0
}

/**
 * AND THE SAME ANSWER FOR THE PLACES THAT ONLY HOLD A BC.
 *
 * A borrowing capacity knows its own splits, so it knows its own loan. Kept
 * separate rather than guessed inside releaseOnDeal, because a deal's loan can
 * come from a contract and a bc's never can - see loanAmount().
 */
export function releaseOnBc(bc: any, loan?: any): number {
  const raw = releaseTotal(bc || {})
  if (raw <= 0) return 0
  const against = loan === undefined ? splitsTotal(bc) : loan
  return isJustRounding(raw, against) ? 0 : raw
}

/** The same question, for a caller holding only a borrowing capacity. */
export function isEquityReleaseOnBc(bc: any, loan?: any): boolean {
  return releaseOnBc(bc, loan) > 0
}

// ---------------------------------------------------------------------------
// WHO ASKS THIS, AND WHO DELIBERATELY DOES NOT
// ---------------------------------------------------------------------------
//
// ASKS IT:
//   lib/order-a-valuation.ts      the purpose sent to the valuer
//   lib/milestone-figures.ts      the "Cash out" row in the client's email
//   lib/the-settlement-numbers.ts whether the settlement email is worth sending
//   lib/box-deposit.ts            how the compliance pack describes the deal
//
// DOES NOT ASK IT:
//   lib/serviceability-request.ts CashOutAmount, sent to the lender.
//
// That last one is on purpose and Fabio should overrule it if he disagrees. If
// the new loan is $1,500 above the payout then $1,500 is cash out in the
// lender's own language, whatever we call it internally. Telling an assessor
// zero because of a rule of ours is a statement they rely on, and the portal
// does not get to round somebody else's number for them.
