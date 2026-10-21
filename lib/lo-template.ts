import { isDebtRecycling } from './debt-recycling'
import { isComplexRefinance } from './complex-refinance'

// WHICH LENDING OPTIONS EMAIL A SCENARIO IS. ONE RULE, ONE PLACE.
//
// 12 Oct 2026. The lending options page turns its purchase boxes on and off
// from a single value - the email template. Get that value wrong and a
// refinance asks for a purchase price, a deposit and stamp duty, works out an
// LVR from a purchase price nobody has, and then warns that the stamp duty
// exceeds the deposit. That is one wrong word making a whole page wrong, and it
// is what a complex refinance was showing.
//
// WHY IT WAS WRONG. The rule below was written out three times inside the form
// by hand. It was also only ever applied on the way in, through the quiet
// setter the form uses when it is arranging itself rather than when somebody is
// typing - and arrival deliberately never writes to the database. So the
// correction lived in the browser for as long as the tab was open, the database
// kept the stale answer, and the next record to arrive put the stale answer
// straight back on screen.
//
// THE FIX IS TO DERIVE IT, NOT TO STORE IT. Every stored record is shaped on
// its way to the screen, and the shaping now settles this. A stale value in the
// database can no longer win, and it no longer matters that arrival does not
// write - the screen is right every time it loads, and the correct value is
// written the next time anybody edits anything.
//
// UNLESS SOMEBODY CHOSE. Picking the template by hand sets templateByHand and
// that choice is kept, the same line this form already draws for the loan
// amount and the refinance splits.
//
// NOTHING HERE TOUCHES REACT, so the rule can be tested without a browser.

export const LO_TEMPLATE_IDS = ['lo_purchase', 'lo_refinance', 'lo_bridging'] as const
export type LoTemplate = (typeof LO_TEMPLATE_IDS)[number]

/** The lending options email a borrowing capacity scenario calls for. */
export function loTemplateFor(bcTemplate: unknown): LoTemplate {
  const t = typeof bcTemplate === 'string' ? bcTemplate.trim() : ''
  // A debt recycle and a complex refinance are refinances in everything this
  // page cares about: an existing loan moving, and nothing being bought.
  // startsWith('refinance') alone sent both of them to the purchase email.
  if (t.startsWith('refinance') || isDebtRecycling(t) || isComplexRefinance(t)) return 'lo_refinance'
  // A PLAIN TOP UP BUYS NOTHING, so it wears the refinance page - no purchase
  // price, no deposit, no stamp duty, and an LVR that is not worked out from a
  // purchase price nobody has. 20 Oct 2026.
  //
  // top_up_purchase deliberately falls through to lo_purchase below: that one
  // IS buying, and the purchase boxes are the whole second half of it.
  if (t === 'top_up') return 'lo_refinance'
  // The analysis is about a loan moving to a lower rate and nothing being
  // bought. Left to fall through it would wear the purchase page and ask for a
  // price nobody has - the exact fault this file was written about.
  if (t === 'refinance_analysis') return 'lo_refinance'
  if (t === 'bridging') return 'lo_bridging'
  return 'lo_purchase'
}

/** True when this scenario has nothing being bought, so no purchase boxes. */
export function isRefinanceScenario(bcTemplate: unknown): boolean {
  return loTemplateFor(bcTemplate) === 'lo_refinance'
}

/**
 * The template a stored lending options record should be wearing. Somebody's
 * own choice wins; anything else follows the borrowing capacity.
 */
export function settleLoTemplate(stored: unknown, bcTemplate: unknown): LoTemplate {
  const rec: any = stored && typeof stored === 'object' ? stored : {}
  const chosen = String(rec.template || '')
  if (rec.templateByHand === true && (LO_TEMPLATE_IDS as readonly string[]).includes(chosen)) {
    return chosen as LoTemplate
  }
  return loTemplateFor(bcTemplate)
}
