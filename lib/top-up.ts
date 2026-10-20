// A TOP UP IS NOT A REFINANCE.
//
// 20 Oct 2026. Fabio: "we're increasing the current loan with the current
// lender... there's no refinance. So I'll give you an example. Someone has a
// house for $1 million. They have a loan for 500. We're going to do a top up
// for 300,000."
//
// ---------------------------------------------------------------------------
// THE ONE RULE THIS FILE EXISTS FOR
// ---------------------------------------------------------------------------
//
// THE LVR COUNTS THE EXISTING LOAN AND THE INCREASE. $500,000 + $300,000
// against $1,000,000 is 80%.
//
// Count only the increase and it reads 30%. That is not a cosmetic error: LMI
// is gated on the LVR, so a deal that needs a premium would show none, the
// client email would quote a figure that is wrong by $11,000, and a deal that
// should have been questioned would sail through. Fabio, on the mock: "in the
// past we had a lot of issues with you getting this structure right."
//
// The way that stays true is that THE EXISTING LOAN IS A SPLIT. Everything
// downstream - lib/complex-refinance.ts groupsOf, the LMI gate, the deal
// structure strip, the compliance pack - already adds up the splits against a
// property. Leave the existing loan out of the splits to "keep it clean" and
// every one of them is wrong at once.
//
// ---------------------------------------------------------------------------
// AND THE SPLIT THAT IS NOT NEW LENDING
// ---------------------------------------------------------------------------
//
// It is a split so the arithmetic is right, and it is TAGGED so the words are
// right. `staying: true` means the lending options must not shop it and the
// compliance pack must never call it a refinance - the loan is not moving.
//
// The tag is on the split rather than worked out from the template, because one
// deal can hold all three: a property topped up, another refinanced dollar for
// dollar, and a third being purchased. Fabio, 20 Oct: "it might be a situation
// that we have two properties, we're doing top up on both at the same time and
// doing a purchase with the same lender."

import { readMoney } from './money'

const txt = (v: any) => String(v ?? '').trim()
const n = (v: any) => readMoney(v) ?? 0

export const TOP_UP_TEMPLATES = ['top_up', 'top_up_purchase'] as const

export function isTopUp(template: any): boolean {
  return (TOP_UP_TEMPLATES as readonly string[]).includes(txt(template))
}

// ---------------------------------------------------------------------------
// WHAT ONE SECURITY IS DOING
// ---------------------------------------------------------------------------
//
// Three answers, and a deal can hold all of them at once.
export type Treatment = 'topped-up' | 'dollar-for-dollar' | 'purchase'

export type Security = {
  id: string
  address: string
  value: number
  /** What is owed today. Counted in the LVR whichever treatment this is. */
  balance: number
  /** New money. Zero on a dollar for dollar, by definition. */
  increase: number
  treatment: Treatment
}

/**
 * Is this security a dollar for dollar refinance rather than a top up?
 *
 * Fabio, 20 Oct 2026: "do a little tick box and say next to the security saying
 * this is a dollar for dollar refi, not a top up."
 *
 * THE TICK CHANGES THE ARITHMETIC, NOT JUST THE LABEL. Ticked, there is no
 * increase split, the LVR is the balance alone, and the property contributes
 * nothing to funds to complete - a dollar for dollar refinance releases no
 * cash. That last one is the whole reason it cannot be a label.
 */
export function isDollarForDollar(bc: any, id: string): boolean {
  const map = bc?.securityDollarForDollar
  return !!(map && typeof map === 'object' && map[id])
}

export function increaseFor(bc: any, id: string): number {
  // A ticked security has no increase however stale the box behind it is. The
  // figure is ignored rather than cleared, so unticking gets it back.
  if (isDollarForDollar(bc, id)) return 0
  const map = bc?.securityIncreases
  return map && typeof map === 'object' ? n(map[id]) : 0
}

export function increaseTotal(bc: any): number {
  const ids: string[] = Array.isArray(bc?.securityIds) ? bc.securityIds.map(String) : []
  return ids.reduce((t, id) => t + increaseFor(bc, id), 0)
}

/**
 * TOTAL LENDING AGAINST ONE SECURITY. The figure the LVR and the LMI both read.
 *
 * Existing balance plus the increase. On a dollar for dollar the increase is
 * zero, so it is the balance alone - which is right, and is why this one
 * function answers for every treatment rather than each caller deciding.
 */
export function lendingAgainst(bc: any, id: string): number {
  const balances = bc?.securityBalances
  const balance = balances && typeof balances === 'object' ? n(balances[id]) : 0
  return balance + increaseFor(bc, id)
}

/**
 * THE LVR ON ONE SECURITY, as a percentage, or null where it cannot be known.
 *
 * null rather than 0, always. Zero is a claim - it says there is no lending
 * against a house - and a 0% LVR on a screen is read as a fact. See the same
 * argument in lib/portfolio-review.ts and what pct(loan, 0) cost on the
 * alternative scenarios.
 */
export function lvrFor(bc: any, id: string, value: any): number | null {
  const worth = n(value)
  const lending = lendingAgainst(bc, id)
  if (worth <= 0 || lending <= 0) return null
  return Math.round((lending / worth) * 1000) / 10
}

// ---------------------------------------------------------------------------
// THE SPLITS
// ---------------------------------------------------------------------------

export type TopUpSplit = {
  label: string
  amount: string
  rate: string
  type: string
  ioYears?: string
  securityId: string
  property: string
  /** True on the existing loan of a topped-up security: real lending, not new. */
  staying?: boolean
}

const money = (v: number) => v > 0 ? v.toLocaleString('en-AU') : ''

/**
 * The splits one security produces.
 *
 * SEPARATE, OR ADDED TO THE CURRENT LOAN. Fabio, 20 Oct 2026: "if we do as a
 * same split, so if we add into the current split, let's estimate the
 * repayments, which is the 500 plus the 300. But if we mark it as a second
 * split, then we can do the repayments just on that split."
 *
 * So `merged` is not presentation. One split means one amount, and every
 * repayment downstream is worked out on the whole $800,000 rather than the
 * $300,000 - a difference of $2,558 a month on the example above, on a client's
 * screen.
 */
export function splitsForSecurity(
  sec: { id: string; address: string; balance: number; increase: number; dollarForDollar: boolean },
  opts: { merged: boolean; rate: string; type: string; ioYears?: string; existingRate?: string; existingIoYears?: string },
): TopUpSplit[] {
  const base = { securityId: sec.id, property: sec.address }

  // DOLLAR FOR DOLLAR: one split, at the balance, and it IS new lending because
  // the loan is moving to the lender. Nothing is staying.
  if (sec.dollarForDollar) {
    return [{
      ...base, label: 'Refinanced loan', amount: money(sec.balance),
      rate: opts.rate, type: opts.type, ioYears: opts.ioYears,
    }]
  }

  // ADDED TO THE CURRENT LOAN: one facility, so one split at the new total and
  // one rate. There is no "staying" half to tag - the whole thing is the loan
  // the client will hold afterwards.
  if (opts.merged) {
    return [{
      ...base, label: 'Loan increased', amount: money(sec.balance + sec.increase),
      rate: opts.rate, type: opts.type, ioYears: opts.ioYears,
    }]
  }

  // A SEPARATE SPLIT: two lines. The first is the loan as it stands - real
  // lending, counted in every LVR, and tagged so nothing downstream treats it
  // as money being arranged.
  const out: TopUpSplit[] = [{
    ...base, label: 'Existing loan', amount: money(sec.balance),
    rate: opts.existingRate || opts.rate, type: opts.type,
    ioYears: opts.existingIoYears || opts.ioYears,
    staying: true,
  }]
  if (sec.increase > 0) {
    out.push({
      ...base, label: 'Loan increase', amount: money(sec.increase),
      rate: opts.rate, type: opts.type, ioYears: opts.ioYears,
    })
  }
  return out
}

/**
 * WHAT IS ACTUALLY NEW MONEY ON THIS DEAL.
 *
 * Funds to complete reads this, and it is the second place the tick matters: a
 * dollar for dollar refinance releases NOTHING, so it never contributes to a
 * deposit. Only the increases do.
 */
export function cashReleased(bc: any): number {
  return increaseTotal(bc)
}

/**
 * WHAT EACH PROPERTY IS DOING, IN ONE WORD, FOR THE COMPLIANCE PACK.
 *
 * Fabio's standing complaint, and the failure this is written against: a deal
 * gets ONE label and the pack then says every property is doing the same thing.
 * A deal can be increasing one loan, refinancing another and buying a third.
 */
export function treatmentOf(bc: any, id: string): Treatment {
  return isDollarForDollar(bc, id) ? 'dollar-for-dollar' : 'topped-up'
}

export function treatmentLabel(t: Treatment): string {
  return t === 'dollar-for-dollar' ? 'Refinanced dollar for dollar'
    : t === 'purchase' ? 'Being purchased'
    : 'Topped up'
}

/**
 * IS ANYTHING ON THIS DEAL ACTUALLY BEING REFINANCED?
 *
 * The wording hangs off this. "Nothing is being refinanced" is true of a plain
 * top up and false the moment one security is ticked, and a sentence that is
 * wrong on a regulated document is worse than no sentence.
 */
export function anyRefinanced(bc: any): boolean {
  const ids: string[] = Array.isArray(bc?.securityIds) ? bc.securityIds.map(String) : []
  return ids.some(id => isDollarForDollar(bc, id))
}

export function anyToppedUp(bc: any): boolean {
  const ids: string[] = Array.isArray(bc?.securityIds) ? bc.securityIds.map(String) : []
  return ids.some(id => !isDollarForDollar(bc, id) && increaseFor(bc, id) > 0)
}

// "Interest only" never travels on its own - Fabio, 20 Oct 2026: "make sure you
// always add how many years interest only, because you tend to forget."
//
// THAT ANSWER ALREADY EXISTS. lib/split-cards.ts repaymentTypeLine() has said
// "Interest only for 5 years, then principal and interest for 25" since 16 Sep,
// reads ioYears off the split, and every client email already calls it. A
// second one here would be the same fact decided in two places, free to
// disagree - which is the mistake this codebase keeps writing notes about.
// Import it from there.
export { repaymentTypeLine } from './split-cards'
