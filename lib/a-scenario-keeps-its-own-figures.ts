// A SCENARIO KEEPS ITS OWN FIGURES, AND NOBODY ELSE'S.
//
// 17 Aug 2026. Fabio cloned a Refinance + cash out, changed it to an
// Owner-occupied purchase, and the old deal came with it: the house that was
// ticked as security on the refinance, the $350,000 that was owed on it, and
// the property value. None of the three is drawn on a purchase form, so none
// of them could be seen, let alone corrected.
//
// THEY WERE STILL BEING READ. The client's email printed "Existing loan
// balance $350,000" inside a card headed NEW PURCHASE. The lending options
// counted the old house beside the one being bought and returned a property
// value of $538,085 and an LVR of 96.6% on a deal the BC said was 80%.
//
// Fabio: "when I clone a deal and change the template I dont want the working
// or the old security to carry."
//
// A FIELD HIDDEN ON THE SCREEN IS NOT A FIELD THAT IS GONE. That is the whole
// fault, and it is the same one the fact find PDF had. The form stops drawing
// the box; the record keeps the value; every output downstream reads the
// record. Hiding a box is a decision about a screen, and it has never once
// been a decision about the data.
//
// SO THE SCENARIO CHANGE CLEARS THEM. Changing the scenario already clears the
// splits, the template notes and the email wording - see applyTemplate in
// BCForm and lib/email-freshness.ts. This is the same rule reaching the one
// place it had not: the figures.
//
// WHAT IS NOT CLEARED. The broker's own paragraph. Fabio, asked directly:
// "dont clear my paragrah". It is the one thing on the form he typed himself,
// and the portal does not delete a person's writing. The email wording that
// the portal generated is a different thing, and that already resets.
//
// NOTHING IS GUESSED AT. The list of boxes a scenario has is not written here.
// It is lib/bc-ready.ts's NEEDS, which has said since September what each
// scenario's email prints, and is now asked the other half of the same
// question. One list. A scenario added there is handled here the same day.

import { boxesForScenario, scenarioHasItsOwnBoxes } from './bc-ready'
import { canHaveManySecurities } from './complex-refinance'

const txt = (v: any) => String(v ?? '').trim()

// The figures that belong to a scenario rather than to a deal. Each one is a
// box on the BC that only some scenarios draw.
//
// NOT purchasePrice, deposit or stampDuty. A deal changed from a purchase to a
// refinance has stopped buying, but those three are also the shape of a
// scenario somebody may be in the middle of correcting, and clearing them
// takes a typed figure off the screen in front of the person typing it. The
// three that caused this are the three that go. Widen it when a real one turns
// up, not before.
export const SCENARIO_FIGURES = [
  'existingLoanBal', 'propertyValue', 'equityRelease',
] as const

// The securities block, which is one answer recorded in six boxes.
export const SECURITY_BOXES = [
  'securityIds', 'securityLimits', 'securityBalances', 'securityReleases',
  'securityIncreases', 'securityDollarForDollar',
] as const

const BLANK: Record<string, any> = {
  securityIds: [], securityLimits: {}, securityBalances: {},
  securityReleases: {}, securityIncreases: {}, securityDollarForDollar: {},
}

export type Cleared = { keys: string[]; values: Record<string, any> }

/**
 * What to blank when a deal moves from one scenario to another.
 *
 * `d` is the record as it stands, `next` the scenario being moved to. Returns
 * only the keys that actually hold something and have no home on the new
 * scenario - so a move that costs nothing returns nothing, and the caller can
 * say plainly whether anything was lost.
 */
export function figuresAfterScenarioChange(d: any, next: string): Cleared {
  // "Custom (all fields)" draws every box there is, and a template this build
  // does not recognise is a deal recorded by a newer one. Neither has a box
  // list to measure against, so neither loses a figure.
  if (!scenarioHasItsOwnBoxes(next)) return { keys: [], values: {} }
  const wanted = new Set(boxesForScenario(txt(next), { ...d, template: txt(next) }))
  const keys: string[] = []
  const values: Record<string, any> = {}

  for (const k of SCENARIO_FIGURES) {
    if (wanted.has(k)) continue
    if (txt(d?.[k]) === '') continue
    keys.push(k)
    values[k] = ''
  }

  // THE TICK IS AN ANSWER TO A QUESTION THE NEW SCENARIO DOES NOT ASK.
  //
  // canHaveManySecurities() is what the BC already asks before it draws the
  // securities block at all. A scenario that will not draw the block must not
  // keep the answer: lib/box-security.ts reads securityIds with no template in
  // its hand, which is how one ticked house from a refinance ended up on a
  // purchase's lending options.
  if (!canHaveManySecurities(next)) {
    for (const k of SECURITY_BOXES) {
      if (!held(d?.[k])) continue
      keys.push(k)
      values[k] = BLANK[k]
    }
  }

  return { keys, values }
}

function held(v: any): boolean {
  if (Array.isArray(v)) return v.filter(x => txt(x)).length > 0
  if (v && typeof v === 'object') return Object.values(v).some(x => txt(x) !== '')
  return txt(v) !== ''
}

// The words on the form, for the line that says what went. Same labels the
// missing-boxes warning uses, because they are the same boxes.
const SAID: Record<string, string> = {
  existingLoanBal: 'Existing loan balance',
  propertyValue: 'Property value',
  equityRelease: 'Equity release',
  securityIds: 'the securities',
  securityLimits: 'the security limits',
  securityBalances: 'the security balances',
  securityReleases: 'the security releases',
  securityIncreases: 'the security increases',
  securityDollarForDollar: 'the dollar-for-dollar ticks',
}

/** "Existing loan balance, Property value and the securities" - or ''. */
export function clearedSentence(cleared: Cleared): string {
  // The six security boxes are one answer, so they are named once.
  const seen = new Set<string>()
  const names: string[] = []
  for (const k of cleared.keys) {
    const word = (SECURITY_BOXES as readonly string[]).includes(k) ? 'the securities' : SAID[k]
    if (!word || seen.has(word)) continue
    seen.add(word)
    names.push(word)
  }
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

// AND THE SAME FIGURE WHERE IT SITS ON A SPLIT.
//
// Answering Keep to "what about my splits?" spreads every typed split across
// whole - amount, rate, label and existingBalance. That is right for the three
// of them and wrong for the fourth: a split carrying $350,000 owed on a house
// that is not on this deal any more printed "Existing loan balance $350,000"
// inside a card headed OWNER-OCCUPIED LOAN - NEW PURCHASE.
//
// One rule with the figures above: a scenario with no Existing loan balance
// box has no existing balance anywhere, including on its splits.
export function splitsAfterScenarioChange(splits: any, next: string): any[] {
  const rows = Array.isArray(splits) ? splits : []
  if (!scenarioHasItsOwnBoxes(next)) return rows
  if (boxesForScenario(txt(next), { template: txt(next) }).includes('existingLoanBal')) return rows
  if (!rows.some(r => txt(r?.existingBalance) !== '')) return rows
  return rows.map(r => ({ ...r, existingBalance: '' }))
}

// DOES THIS SCENARIO REFINANCE ANYTHING AT ALL?
//
// The other half of the Glenfield Park problem. Unticking the house is not
// enough on its own: lib/box-security.ts also INFERS a security from the fact
// find, by taking any property whose loan is marked to be refinanced. That is
// the right answer on every scenario that refinances something and a wrong one
// on a scenario that refinances nothing - and a clone brings the fact find
// across with the old loan still marked.
//
// Asked of the same list as everything else here. A scenario that has no
// Existing loan balance box is a scenario with nothing to pay out.
export function refinancesNothing(template: unknown): boolean {
  const t = txt(template)
  if (!scenarioHasItsOwnBoxes(t)) return false
  return !boxesForScenario(t, { template: t }).includes('existingLoanBal')
}

// DOES THIS SCENARIO SELL A HOUSE?
//
// 13 Nov 2026, the Le-Vo deal. The Broker Submission Notes printed PROPERTY
// VALUE $1,950,000 and LVR 47.2% on a $920,000 loan. The property being bought
// is worth less than that: the figure was the new purchase PLUS the house they
// were selling, added together.
//
// WHY THE SOLD HOUSE GOT IN. The security total takes the house being bought
// and then adds any property on the fact find whose loan is marked to be
// discharged. On a buy and sell the old loan IS discharged - out of the sale
// proceeds - so it is marked exactly that way, and its value was counted as
// though it still stood behind the new lending.
//
// It does not. It is gone at settlement. The only security is what is being
// bought.
//
// refinancesNothing() cannot answer this: a buy and sell HAS an existing loan
// balance box, because there is a loan on the house being sold. The question
// that separates them is whether the scenario sells - and a scenario that
// sells is one that asks for a sale price, which is the same list every other
// rule here is asked of.
//
// AN UNDERSTATED LVR IS THE DANGEROUS DIRECTION. It goes to a lender on a
// submission, and it is the number that decides whether LMI applies.
export function sellsSomething(template: unknown): boolean {
  const t = txt(template)
  if (!scenarioHasItsOwnBoxes(t)) return false
  return boxesForScenario(t, { template: t }).includes('salePrice')
}

/**
 * DO WE TAKE SECURITY FROM THE FACT FIND AT ALL?
 *
 * 13 Nov 2026, and this is the shape of the Le-Vo fault rather than the fault
 * itself.
 *
 * TWO FILES DECIDED THIS INDEPENDENTLY. lib/funds-to-complete.ts built the
 * security total for the deal strip, the LVR and the Broker Submission Notes;
 * lib/box-security.ts built the security list for the compliance pack. Both
 * asked refinancesNothing(). Neither asked whether the scenario SELLS - so the
 * house being sold was counted as security in both, and the same wrong LVR
 * reached a lender's submission and a regulated document by two separate
 * routes.
 *
 * Fixing one would have left the other. So the question is asked once, here,
 * and both call it. lib/one-security-rule.test.ts fails if either one goes
 * back to working it out for itself.
 *
 * TWO REASONS NOT TO LOOK:
 *   the scenario refinances nothing   a purchase pays nothing out, so a loan
 *                                     still flagged on a cloned fact find is
 *                                     stale rather than true
 *   the scenario sells                the loan IS discharged, out of the sale -
 *                                     and the house goes with it
 */
export function securityComesFromTheFactFind(template: unknown): boolean {
  return !refinancesNothing(template) && !sellsSomething(template)
}
