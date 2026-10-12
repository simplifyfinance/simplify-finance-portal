// IS ANYTHING BEING BOUGHT ON THIS SCENARIO?
//
// 12 Oct 2026. One list, because three parts of the portal were each deciding
// this for themselves and they did not agree.
//
// WHAT WENT WRONG. The borrowing capacity form decided which boxes to draw from
// hand-written lists of templates - one list per box, six lists, each naming the
// scenarios that should NOT see it. Complex refinance was added as a template
// and never added to any of those lists, so a refinance drew Purchase price,
// Deposit, Deposit source, Stamp duty and a duty State.
//
// AND IT WAS NOT HARMLESS. The client email ignores those boxes, so for a while
// this looked like clutter. It is not. lib/box-security.ts asks one question -
// is there a purchase price? - and if there is, the compliance pack states that
// a property is being purchased for that amount. A figure typed into a box that
// should never have been on screen would put a purchase into a regulated
// document for a deal where nothing is being bought.
//
// So the question is answered once, here, and the form and the compliance pack
// both read it.
//
// AN UNKNOWN TEMPLATE IS NOT AN ANSWER. A deal saved before templates existed,
// or on 'custom', is not claimed either way: buysNothing() returns false and
// every caller behaves exactly as it did before. Only a scenario we positively
// know buys nothing is treated as buying nothing.

/** Scenarios where something is being bought, and so where a price, a deposit
 *  and stamp duty are real questions. */
export const BUYING_TEMPLATES = [
  'oo_purchase', 'oo_lvr_compare', 'investment_purchase', 'fhb',
  'investment_equity', 'buy_sell', 'bridging', 'smsf', 'family_pledge',
  'construction',
] as const

/** Scenarios that are an existing loan moving, with no purchase anywhere in them. */
export const NOT_BUYING_TEMPLATES = [
  'refinance_equity', 'refinance_only', 'debt_recycling', 'complex_refinance',
] as const

const txt = (v: unknown) => String(v ?? '').trim()

/** True only for a scenario we know buys something. */
export function isBuying(template: unknown): boolean {
  return (BUYING_TEMPLATES as readonly string[]).includes(txt(template))
}

/**
 * True only for a scenario we know buys NOTHING.
 *
 * Deliberately not the opposite of isBuying(): an unknown or custom template
 * answers false to both, which leaves every caller on the behaviour it had.
 */
export function buysNothing(template: unknown): boolean {
  return (NOT_BUYING_TEMPLATES as readonly string[]).includes(txt(template))
}
