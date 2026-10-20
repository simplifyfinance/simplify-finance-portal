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

// THE HOUSE NOBODY OWNS YET, BY ITS RESERVED ID.
//
// A local copy rather than an import from lib/securities.ts, which already
// imports isTopUp and lendingAgainst from here - importing back would make a
// cycle. lib/split-purpose.ts carries the same copy for the same reason.
const BEING_PURCHASED_ID = 'being-purchased'

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
  // NOTHING IS BEING TOPPED UP ON A HOUSE NOBODY OWNS YET. There is no loan to
  // increase, so an increase recorded against it is a figure that got there by
  // accident and must not reach an LVR.
  if (txt(id) === BEING_PURCHASED_ID) return 0
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
  // 20 Oct 2026. On a top up + purchase this answered "topped up" about the
  // house being bought, because the only two answers it had were the two a
  // plain top up can give. A compliance pack saying a purchase is a top up is
  // telling a lender something untrue.
  if (txt(id) === BEING_PURCHASED_ID) return 'purchase'
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

// ---------------------------------------------------------------------------
// WHO THE LOAN IS ALREADY WITH
// ---------------------------------------------------------------------------
//
// 20 Oct 2026. Fabio: "we still need to compare lenders but recommended product
// is always existing lender."
//
// THE ANSWER IS ALREADY ON THE FACT FIND and is not asked for a second time.
// Every property there carries its loans, and every loan carries the lender's
// name - it is what lib/position-after-settlement.ts reads to say which debts
// are being closed. A new box on the borrowing capacity would be the same fact
// in two places, free to disagree, and the one somebody forgot to fill in is
// the one the recommendation would follow.
//
// ONE NAME OR NONE. Where the securities being topped up are with two different
// lenders there is no single "existing lender" to recommend, and this says so
// by returning '' rather than picking the first. A top up is an increase with
// the lender a loan is already with; two lenders is a conversation, not a
// default.
export function existingLenderOn(bc: any, ff: any): string {
  const ids = new Set((Array.isArray(bc?.securityIds) ? bc.securityIds : []).map((x: any) => txt(x)))
  if (ids.size === 0) return ''
  const props: any[] = Array.isArray(ff?.properties) ? ff.properties : []
  const names = new Set<string>()
  for (const p of props) {
    if (!ids.has(txt(p?.id))) continue
    // A security ticked as a dollar for dollar is MOVING. The lender it is
    // with today is not the one to recommend - it is the one being left.
    if (isDollarForDollar(bc, txt(p?.id))) continue
    for (const l of (Array.isArray(p?.loans) ? p.loans : [])) {
      const name = txt(l?.lenderName)
      if (name) names.add(name)
    }
  }
  return names.size === 1 ? [...names][0] : ''
}

/**
 * Should the lending options page start with the existing lender starred?
 *
 * Only on a top up, only where every topped-up loan is with the same lender,
 * and only while nobody has set a recommendation themselves. A broker who has
 * picked one is never overruled - the same line this portal draws for the loan
 * amount, the email template and the refinance splits.
 */
export function recommendExistingLender(lo: any, bc: any, ff: any): string {
  if (!isTopUp(bc?.template)) return ''
  // THE ID IS WHETHER A RECOMMENDATION EXISTS; THE NAME NEVER WAS.
  //
  // Reading recommendedLender here would also break the rule in
  // lib/lender-on-the-deal.test.ts, which exists because a bank's name on its
  // own cannot say WHICH of two options from that bank was meant - the fault
  // that put a real rate against the wrong product on William Welton.
  //
  // An old record carrying a name and no id has already been resolved to one
  // by the time this is asked: putOnScreen runs recommendedOption() first.
  if (txt(lo?.recommendedOptionId)) return ''
  return existingLenderOn(bc, ff)
}

/**
 * WHY THE EXISTING LENDER IS THE RECOMMENDATION, in a sentence the compliance
 * pack can use.
 *
 * Empty where it is not the existing lender, because then it is an ordinary
 * recommendation and the ordinary reasons apply.
 */
export function whyTheExistingLender(lender: string): string {
  const name = txt(lender)
  return name
    ? `The loan is already with ${name} and is not being moved. Increasing the existing `
      + `facility avoids a discharge, a new application on the whole debt and the costs that `
      + `come with both.`
    : ''
}

// ---------------------------------------------------------------------------
// WHAT IS ACTUALLY BEING ASKED FOR
// ---------------------------------------------------------------------------
//
// 20 Oct 2026, and this is the trap in the whole scenario.
//
// The existing loan is a SPLIT, because that is the only way the LVR counts it
// - see the top of this file. So the splits on Fabio's example add up to
// $800,000. But the client is asking the lender for $300,000: the other
// $500,000 is already theirs and is staying exactly where it is.
//
// lib/funds-to-complete.ts loanAmount() totals the splits, which is right for
// every other scenario and wrong for this one. Left alone, the submission
// notes would have told a lender "the applicants are seeking finance of
// $800,000" on a deal asking for $300,000 - in the one box on the tab the bank
// reads. It is the same shape as the fault Fabio caught on 16 Oct: "'seeking
// finance of $1,855,000 to purchase an investment property in TBA' IS NOT
// TRUE."
//
// A TICKED SECURITY COUNTS IN FULL. A dollar for dollar refinance is a new
// facility at the new lender for the whole balance, so the whole balance is
// being sought - which is exactly why the tick cannot be cosmetic.
//
// AND THE PURCHASE LOAN, WHICH IS WHY THE SECOND ARGUMENT EXISTS.
//
// 20 Oct 2026. Fabio: "ensure you are doing the same work for top + purchase".
// This counted the increases and the ticked balances and stopped. On a top up +
// purchase the loan that buys the house is neither, so the submission notes
// read "seeking finance of $200,000" and the sentence straight after it listed
// parts adding to $824,000 - the same shape as the $1,855,000 line Fabio pulled
// up on 16 Oct, in the one box a bank reads.
//
// IT IS PASSED IN RATHER THAN READ HERE. purchaseLoanOf lives in
// lib/securities.ts, which already imports from this file; reaching back for it
// would make a cycle. The caller has it to hand, and
// lib/the-top-up-reaches-lo-and-compliance.test.ts holds the only caller to
// passing it so a future one cannot quietly drop it again.
export function financeSought(bc: any, purchaseLoan: number = 0): number {
  const ids: string[] = Array.isArray(bc?.securityIds) ? bc.securityIds.map(String) : []
  const balances = bc?.securityBalances
  const onSecurities = ids.reduce((t, id) => {
    if (isDollarForDollar(bc, id)) {
      return t + (balances && typeof balances === 'object' ? n(balances[id]) : 0)
    }
    return t + increaseFor(bc, id)
  }, 0)
  const buying = Number.isFinite(purchaseLoan) && purchaseLoan > 0 ? purchaseLoan : 0
  return onSecurities + buying
}

/**
 * WHAT EACH PROPERTY IS DOING, AS SENTENCE PARTS FOR THE SUBMISSION NOTES.
 *
 * Fabio's standing complaint and the reason this exists: a deal gets ONE label
 * and the pack then says every property is doing the same thing. A top up can
 * be increasing one loan, refinancing another and buying a third, and a lender
 * reading "refinance" across all of it is being told something untrue.
 *
 * Addresses are named. On this scenario there is no single suburb to fall back
 * on and guessing one is how "in TBA" reached a bank.
 */
export function whatEachPropertyIsDoing(bc: any, ff: any): string[] {
  const ids: string[] = Array.isArray(bc?.securityIds) ? bc.securityIds.map(String) : []
  const props: any[] = Array.isArray(ff?.properties) ? ff.properties : []
  const addressOf = (id: string) => txt(props.find(p => txt(p?.id) === id)?.address)
  const balances = bc?.securityBalances
  const fmt = (v: number) => `$${v.toLocaleString('en-AU')}`

  const out: string[] = []
  for (const id of ids) {
    const where = addressOf(id)
    const at = where ? ` against ${where}` : ''
    if (isDollarForDollar(bc, id)) {
      const bal = balances && typeof balances === 'object' ? n(balances[id]) : 0
      if (bal > 0) out.push(`${fmt(bal)} refinances the existing lending${at}, dollar for dollar`)
      continue
    }
    const up = increaseFor(bc, id)
    if (up > 0) out.push(`${fmt(up)} increases the existing lending${at}`)
  }
  return out
}

/**
 * DOES THE NEW LIMIT AGREE WITH WHAT IS OWED PLUS THE INCREASE?
 *
 * 20 Oct 2026. Fabio's own screen: owes $942,441, increasing by $200,000, new
 * limit $1,599,941. Those cannot all be true - the limit is $457,500 more than
 * the two added up - and nothing said so. The LVR read 80% off the typed limit
 * while the splits added to $1,142,441, which is 57%.
 *
 * A TYPED LIMIT IS STILL ALLOWED TO WIN. A lender can approve a limit above
 * what is drawn, and recording that is a real thing to do - see limitOf in
 * lib/securities.ts. This does not refuse it; it says the two disagree and by
 * how much, which is the difference between a deliberate undrawn facility and a
 * figure somebody mistyped.
 *
 * Empty where there is nothing to say, so the screen stays quiet when it agrees.
 */
export function limitDisagreement(bc: any, id: string): string {
  if (!isTopUp(bc?.template)) return ''
  const limits = bc?.securityLimits
  const typed = limits && typeof limits === 'object' ? n(limits[id]) : 0
  if (typed <= 0) return ''
  const expected = lendingAgainst(bc, id)
  if (expected <= 0) return ''
  const gap = typed - expected
  if (gap === 0) return ''
  const fmt = (v: number) => `$${Math.abs(v).toLocaleString('en-AU')}`
  return gap > 0
    ? `The new limit is ${fmt(gap)} above what is owed plus the increase (${fmt(expected)}). `
      + `Fine if the lender is approving an undrawn facility — the LVR follows the limit.`
    : `The new limit is ${fmt(gap)} below what is owed plus the increase (${fmt(expected)}), `
      + `so the limit does not cover the lending.`
}
