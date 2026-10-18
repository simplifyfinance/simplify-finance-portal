// COMPLEX REFINANCE - SEVERAL PROPERTIES, EACH WITH SPLITS THAT MUST NOT MOVE.
//
// Fabio, 1 Oct 2026: "a lot of time we need to refinance customers with mutiple
// properties and those property have multiiple spltis where we nee to keep the
// current strucutre because of the original purpose of funds".
//
// THE REFINANCE TEMPLATES HOLD ONE PROPERTY. A client with three, carrying four
// splits between them, has nowhere to put the second and the third - so the
// splits come out as one flat list and nothing on the page says which loan sits
// against which house. The client cannot check it and neither can an assessor.
//
// So the email is GROUPED BY PROPERTY. One card per property, its own limit at
// the top, its splits inside it, its drawn total at the foot, and what is not
// drawn said out loud. Four splits across three properties reads as three cards.
//
// THE STRUCTURE IS NOT BEING REDESIGNED, IT IS BEING CARRIED ACROSS. That is why
// every split says what the money was originally used for: it is the reason the
// structure has to survive the move.
//
// WHAT THIS IS NOT. There is no deductible figure here and no mention of debt
// recycling anywhere - Fabio was explicit. The accountant line stays, because
// the email still names investment purposes, and a client reading those will
// have the question whether or not we invite it.

import { money, readMoney } from './money'
import { andList } from './and-list'
import { purposeLabel, purposeOf, fundsUsedFor, offsetLine } from './debt-recycling'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any): number => readMoney(v) || 0

export function isComplexRefinance(template: any): boolean {
  return txt(template) === 'complex_refinance'
}

// WHICH SCENARIOS CAN BE SECURED BY MORE THAN ONE HOUSE.
//
// 15 Oct 2026. Fabio, on an equity release and purchase where two properties
// were being refinanced at once: "I also would like to add the ability of
// adding another property into the template ... and then under the loan split
// sections, we will then tag which property relates to which. We had this
// already done in the complex scenario."
//
// He is right that it was already done. Complex refinance has picked its
// securities from the fact find by id since 12 Oct, and every split already
// carries securityId. The only thing stopping Equity release + purchase from
// doing the same was this predicate naming one template.
//
// A LIST, NOT A GUESS. Anything that refinances an existing property can need
// two; a straight purchase cannot. Adding a template here is the whole job -
// the securities block, the per-split Security box and the LVR across the
// securities all read this one answer.
// 16 Oct 2026. Fabio, looking at a Refinance + equity release with two houses
// ticked on the fact find and one set of figures on the BC: "I want the same
// thing on refinance and equity release and refinance only ... the LO is
// working in the refinance equity template but the BC still has the old view -
// did you miss that?"
//
// I did. The list named two templates and his two were not on it. Everything
// else already asks this one question, so this line was the whole of the form.
//
// THE EMAIL WAS NOT THE WHOLE OF IT, and that is the part I had left unfinished
// the day before. Those templates print the deal-level existingLoanBal and
// equityRelease - the exact two boxes that leave the form once each property
// carries its own - so adding a name here without touching the email gives a
// client a Split 1 card with no balance and a Split 2 card headed "Equity
// release amount" with nothing beside it. See securedByMany below, and the
// property cards in app/api/generate-email/route.ts that read it.
const MANY_SECURITIES = ['complex_refinance', 'investment_equity',
                         'refinance_equity', 'refinance_only']

export function canHaveManySecurities(template: any): boolean {
  return MANY_SECURITIES.includes(txt(template))
}

// A REFINANCE ONLY RELEASES NOTHING, SO IT IS NOT ASKED.
//
// 16 Oct 2026. Fabio, looking at the securities block on a straight refinance:
// "for the love of god a refinance ONLY should NOT have a releasing box in BC
// shouldn't it?"
//
// It should not. His own words on 2 Sep, written into the email route: that
// scenario "is only for dollar for dollar refi". The box has been drawn on
// every template since the securities block was built, because the block was
// built for Complex refinance where a release is normal.
//
// ONE NAMED EXCEPTION, not a guess from the template's name. Complex refinance
// and Debt recycling can both carry an equity access split, so they keep it.
const RELEASES_NOTHING = ['refinance_only']

export function canReleaseEquity(template: any): boolean {
  return !RELEASES_NOTHING.includes(txt(template))
}

// IS THIS PARTICULAR DEAL SECURED BY PROPERTIES THE BROKER HAS TICKED?
//
// Two questions, and they are not the same one. canHaveManySecurities asks
// whether the TEMPLATE offers the securities block at all. This asks whether
// somebody has actually used it on THIS deal.
//
// The email needs the second. A Refinance + equity release where nobody ticked
// anything still has its suburb, its balance and its release filled in, and it
// must keep printing the two cards it has always printed - every one of those
// deals is already recorded that way. The grouped-by-property layout is for the
// deals that have securities on them, and nothing else changes.
export function securedByMany(bc: any): boolean {
  if (!canHaveManySecurities(bc?.template)) return false
  return Array.isArray(bc?.securityIds) && bc.securityIds.filter((x: any) => txt(x)).length > 0
}

// WHICH HOUSE A SPLIT IS AGAINST.
//
// 12 Oct 2026. A split used to carry the address as TYPED TEXT. It now carries
// the fact find property's id - see lib/securities.ts for why - so this resolves
// the id to the address using the property list the email payload already
// carries, and falls back to the typed text for every deal recorded before the
// change.
//
// WITHOUT THIS THE EMAIL BREAKS SILENTLY. Shipped on its own, a1d6c40 left every
// new split with an id and no text, so all six landed in "Other lending" and the
// client got one unheaded card instead of a card per house - the one thing this
// template exists to do. Found by Fabio asking what the email looked like,
// which is the question that should have been asked before it was written.
export function propertyOf(split: any, bc?: any): string {
  const id = txt(split?.securityId)
  if (id) {
    const list = Array.isArray(bc?.ffProperties) ? bc.ffProperties : []
    const hit = list.find((p: any) => txt(p?.id) === id)
    // An id pointing at a property that is no longer on the fact find is not an
    // address - it is unassigned, and says so, rather than printing a blank
    // heading on a card full of the client's money.
    return hit ? txt(hit.address) : ''
  }
  return txt(split?.property)
}

// Splits with money in them. An empty row the form is always carrying is not a
// split and must never open a property card of its own.
const realOnes = (splits: any): any[] =>
  (Array.isArray(splits) ? splits : []).filter(s => num(s?.amount) > 0)

// WHAT THE LIMIT AGAINST ONE PROPERTY IS. Held per address, because on a
// restructure a property can be approved for more than is drawn at settlement
// and the difference is a thing the client should be told rather than left to
// work out from a column that does not add up.
export function limitOf(bc: any, property: string, id?: string): number {
  // BY ID FIRST. securityLimits is keyed by the fact find property's id and is
  // what the BC writes now; propertyLimits is keyed by the typed address and is
  // what every deal before 12 Oct 2026 has. Both are read, newest first, so a
  // deal part-way through either shape still shows its limit.
  const byId = bc?.securityLimits
  if (id && byId && typeof byId === 'object' && num(byId[id]) > 0) return num(byId[id])
  const limits = bc?.propertyLimits
  if (!limits || typeof limits !== 'object') return 0
  return num(limits[property])
}

// The value on the fact find, passed through on the email payload. Never
// invented, and never read from the BC - the BC does not hold one per property.
// WHAT THIS PROPERTY OWES TODAY, AND WHAT IS COMING OUT OF IT.
//
// 16 Oct 2026. Held by id in securityBalances and securityReleases, which the
// securities block on the BC writes per house. Before the block existed there
// was one existingLoanBal and one equityRelease for the whole deal, and on two
// houses they belonged to neither.
//
// NO FALLBACK TO THE DEAL-LEVEL FIGURE. A deal with two securities and one old
// balance would print that balance against the first house, which is a specific
// claim about a specific property and we do not know it to be true. An empty
// row is dropped by rowIf; a wrong one is read and believed.
function byId(store: any, id?: string): number {
  if (!id || !store || typeof store !== 'object') return 0
  return num(store[id])
}

export function balanceFor(bc: any, id?: string): number {
  return byId(bc?.securityBalances, id)
}

export function releaseFor(bc: any, id?: string): number {
  return byId(bc?.securityReleases, id)
}

// The same figure as valueOf, as a number, for arithmetic rather than a label.
export function worthOf(bc: any, property: string): number {
  const list = Array.isArray(bc?.ffProperties) ? bc.ffProperties : []
  const hit = list.find((p: any) => txt(p?.address) === property)
  return hit ? num(hit.value) : 0
}

export function valueOf(bc: any, property: string): string {
  const list = Array.isArray(bc?.ffProperties) ? bc.ffProperties : []
  const hit = list.find((p: any) => txt(p?.address) === property)
  return hit ? money(hit.value) : ''
}

export type PropertyGroup = {
  property: string      // '' for splits nobody has assigned
  heading: string       // what the card is titled
  value: string
  splits: any[]
  drawn: number
  limit: number
  undrawn: number
  // The fact find property's id, so a caller can look anything else up by it
  // rather than matching on the address a second time.
  id: string
  // Per property, from the securities block. 0 when nobody typed one.
  balance: number
  release: number
  // What this house is worth, as a number, and what the lending on it makes
  // its LVR. Null when the fact find has no value - never zero, which reads as
  // "no debt" rather than "we do not know". Same rule as lib/securities.ts.
  worth: number
  lvr: number | null
}

// SPLITS WITH NO PROPERTY ARE NOT HIDDEN. They collect in a last card that says
// what it is, the same rule the milestone emails follow: a missing thing is a
// question somebody has to ask, a named one is an answer. bc-ready also names
// the empty box before anybody presses send.
export const UNASSIGNED = 'Other lending'

export function groupsOf(bc: any): PropertyGroup[] {
  const order: string[] = []
  const byProperty = new Map<string, any[]>()
  // The id behind each address, so the limit can be looked up by it. Kept
  // beside the grouping rather than re-derived, because two splits on one house
  // must agree about which house it is.
  const idFor = new Map<string, string>()
  for (const s of realOnes(bc?.splits)) {
    const key = propertyOf(s, bc)
    if (!byProperty.has(key)) { byProperty.set(key, []); order.push(key) }
    byProperty.get(key)!.push(s)
    const id = txt(s?.securityId)
    if (key && id && !idFor.has(key)) idFor.set(key, id)
  }
  // Named properties in the order the splits put them, then the unassigned.
  const keys = [...order.filter(k => k !== ''), ...order.filter(k => k === '')]
  return keys.map(property => {
    const splits = byProperty.get(property)!
    const drawn = splits.reduce((sum, s) => sum + num(s?.amount), 0)
    const id = property ? (idFor.get(property) || '') : ''
    const limit = property ? limitOf(bc, property, id) : 0
    const worth = property ? worthOf(bc, property) : 0
    // The limit is what is approved; the drawn is what is taken. The LVR a
    // lender assesses is against the limit where there is one.
    const lending = limit > 0 ? limit : drawn
    return {
      property,
      heading: property || UNASSIGNED,
      value: property ? valueOf(bc, property) : '',
      splits,
      drawn,
      limit,
      undrawn: limit > drawn ? limit - drawn : 0,
      id,
      // UNASSIGNED CARRIES NEITHER. "Other lending" is not a house, so it has
      // nothing owing on it and nothing being released from it.
      balance: property ? balanceFor(bc, id) : 0,
      release: property ? releaseFor(bc, id) : 0,
      worth,
      lvr: worth > 0 && lending > 0 ? Math.round((lending / worth) * 1000) / 10 : null,
    }
  })
}

// The same sentence the other scenario uses, so there is one wording for this
// rather than two that drift.
export function undrawnNoteFor(g: PropertyGroup): string {
  if (g.undrawn < 1) return ''
  return `${money(g.undrawn)} of the limit above is not drawn at settlement and remains available.`
}

// WHAT THIS SPLIT'S MONEY WAS ORIGINALLY FOR - IN THE BROKER'S OWN WORDS.
//
// THE BOX IS PRINTED AS IT IS TYPED. Nothing is pasted on the front of it.
//
// It used to compose a sentence: the Purpose dropdown's label, an em dash, the
// words "originally used to", and then whatever was in the box. The box already
// holds a phrase somebody wrote to be read, so the result read like a form
// filling itself in - "Investment - originally used to Purchase investment
// property". Fabio, 12 Oct 2026: "just the wording we put in the box".
//
// THE PURPOSE DROPDOWN IS NOT LOST. It still decides how the split is treated
// everywhere else it matters; it is only no longer glued onto this line. And an
// empty box prints nothing at all rather than falling back to the dropdown,
// because a line that sometimes says "Investment" and sometimes says a sentence
// is two different things wearing one place on the page.
export function originalPurposeLine(split: any): string {
  return fundsUsedFor(split)
}

// THE HOUSES THIS LENDING SITS AGAINST, NAMED, IN THE ORDER THE SPLITS PUT THEM.
//
// 16 Oct 2026. Equity release + purchase prints a two-column table whose left
// heading was "Against {suburb}" - one box, filled in before the securities
// block existed. Turn two securities on and that heading names one of them, or
// prints "[Existing Property]" because the suburb box is no longer being
// filled. It went live on 15 Oct and no email has been sent through it yet.
//
// Splits with no property are not named - they are not a house, and "Against
// Other lending" is not a sentence.
export function securedAddresses(bc: any): string[] {
  return groupsOf(bc).map(g => g.property).filter(Boolean)
}

export function securedHeading(bc: any): string {
  return andList(securedAddresses(bc))
}

// WHAT IS COMING OUT, ADDED UP ACROSS THE HOUSES.
//
// The opening sentence of a Refinance + equity release says how much equity is
// being accessed. It read the one deal-level box, which is empty the moment the
// releases move onto the securities - so the sentence said "[equity amount]" or
// fell back to split 2, which is one split of several.
// WHAT THE HOUSES OWE TODAY, ADDED UP. Same shape and same reason as
// releaseTotal below: the deal-level box holds one house's figure once the
// securities are in use, and a client email reading it names the wrong number.
// WHAT THE TICKED HOUSES ARE WORTH, READ OFF THE FACT FIND.
//
// 18 Oct 2026, found by the two-day sweep. Not derived from the splits like
// groupsOf() - a security with no split on it is still security, and the figure
// an LVR divides by must not depend on whether somebody has written the loan
// against it yet.
export function securityWorth(bc: any): number {
  const ids = new Set((Array.isArray(bc?.securityIds) ? bc.securityIds : []).map(txt).filter(Boolean))
  if (ids.size === 0) return 0
  const list = Array.isArray(bc?.ffProperties) ? bc.ffProperties : []
  return list.filter((p: any) => ids.has(txt(p?.id)))
    .reduce((t: number, p: any) => t + num(p?.value), 0)
}

export function balanceTotal(bc: any): number {
  const ids = Array.isArray(bc?.securityIds) ? bc.securityIds.map(txt).filter(Boolean) : []
  const total = ids.reduce((sum: number, id: string) => sum + balanceFor(bc, id), 0)
  return total > 0 ? total : num(bc?.existingLoanBal)
}

export function releaseTotal(bc: any): number {
  const ids = Array.isArray(bc?.securityIds) ? bc.securityIds.map(txt).filter(Boolean) : []
  const total = ids.reduce((sum: number, id: string) => sum + releaseFor(bc, id), 0)
  return total > 0 ? total : num(bc?.equityRelease)
}

export function everySplitHasAProperty(bc: any): boolean {
  const real = realOnes(bc?.splits)
  return real.length > 0 && real.every(s => propertyOf(s, bc) !== '')
}

// --- the words ---------------------------------------------------------------

export function openingLine(bc: any): string {
  const count = groupsOf(bc).filter(g => g.property).length
  const where = count > 1 ? `across your ${count} properties` : 'against your property'
  return `Here is how your lending sits ${where} once the refinance is complete. The existing split ` +
         'structure has been kept exactly as it is, because each split reflects what those funds were ' +
         'originally used for — nothing has been combined or moved between properties.'
}

// Fabio, 1 Oct 2026, asked whether any tax wording survives here: "keep
// accoutnant line anyway". No deductible figure above it, so it makes no claim
// to qualify - it says whose question it is, what we did, and what this is not.
// EACH HOUSE STANDS ON ITS OWN.
//
// 18 Oct 2026. I wrote this sentence into a mock and then refused to ship it,
// because nothing on the BC records whether a lender has cross-collateralised
// two securities - that is the lender's structure, not ours. Asked plainly,
// Fabio confirmed it is always true of this scenario: "yes put the line in."
//
// So it is his answer about how he writes these deals, not the portal's
// inference from the figures. It is used by Refinance + equity release with
// several securities, and nowhere else.
export const STAND_ALONE_NOTE =
  'Each property stands on its own security, so the loans are not cross-collateralised.'

export const ACCOUNTANT_NOTE =
  'How these loans are treated in your tax return is a matter for your accountant, and we would ' +
  'encourage you to speak with them before we proceed. This is not tax advice.'

export function aboutThisStructure(bc: any): string[] {
  const lines = [
    'Each split has been kept separate so that the original purpose of those funds stays clear.',
  ]
  const offset = offsetLine(bc)
  if (offset) lines.push(offset)
  return lines
}
