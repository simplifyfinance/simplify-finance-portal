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
import { purposeLabel, purposeOf, fundsUsedFor, offsetLine } from './debt-recycling'

const txt = (v: any) => String(v ?? '').trim()
const num = (v: any): number => readMoney(v) || 0

export function isComplexRefinance(template: any): boolean {
  return txt(template) === 'complex_refinance'
}

export function propertyOf(split: any): string {
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
export function limitOf(bc: any, property: string): number {
  const limits = bc?.propertyLimits
  if (!limits || typeof limits !== 'object') return 0
  return num(limits[property])
}

// The value on the fact find, passed through on the email payload. Never
// invented, and never read from the BC - the BC does not hold one per property.
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
}

// SPLITS WITH NO PROPERTY ARE NOT HIDDEN. They collect in a last card that says
// what it is, the same rule the milestone emails follow: a missing thing is a
// question somebody has to ask, a named one is an answer. bc-ready also names
// the empty box before anybody presses send.
export const UNASSIGNED = 'Other lending'

export function groupsOf(bc: any): PropertyGroup[] {
  const order: string[] = []
  const byProperty = new Map<string, any[]>()
  for (const s of realOnes(bc?.splits)) {
    const key = propertyOf(s)
    if (!byProperty.has(key)) { byProperty.set(key, []); order.push(key) }
    byProperty.get(key)!.push(s)
  }
  // Named properties in the order the splits put them, then the unassigned.
  const keys = [...order.filter(k => k !== ''), ...order.filter(k => k === '')]
  return keys.map(property => {
    const splits = byProperty.get(property)!
    const drawn = splits.reduce((sum, s) => sum + num(s?.amount), 0)
    const limit = property ? limitOf(bc, property) : 0
    return {
      property,
      heading: property || UNASSIGNED,
      value: property ? valueOf(bc, property) : '',
      splits,
      drawn,
      limit,
      undrawn: limit > drawn ? limit - drawn : 0,
    }
  })
}

// The same sentence the other scenario uses, so there is one wording for this
// rather than two that drift.
export function undrawnNoteFor(g: PropertyGroup): string {
  if (g.undrawn < 1) return ''
  return `${money(g.undrawn)} of the limit above is not drawn at settlement and remains available.`
}

// WHAT THIS SPLIT'S MONEY WAS ORIGINALLY FOR. Same two facts the other scenario
// prints, worded for a structure being preserved rather than created: here it is
// history, and the history is the reason nothing may be merged.
export function originalPurposeLine(split: any): string {
  const label = purposeLabel(purposeOf(split))
  if (!label) return ''
  const used = fundsUsedFor(split)
  return used ? `${label} — originally used to ${used}` : label
}

export function everySplitHasAProperty(bc: any): boolean {
  const real = realOnes(bc?.splits)
  return real.length > 0 && real.every(s => propertyOf(s) !== '')
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
