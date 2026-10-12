import { type Security, splitSecurityId } from './securities'

// THE LENDING OPTIONS, ARRANGED BY THE HOUSE EACH LOAN SITS AGAINST.
//
// 12 Oct 2026. Fabio: "we have 6 splits on BC and those breakdowns to splits
// link to a respective property I now need the ability in LO to say Property 1
// these splits Property 2 these splits".
//
// A complex refinance arrived on the lending options tab as a flat list. Six
// loans across three houses, nothing on screen saying which was which, every
// security reading "nothing drawn", and a lender comparison pricing a structure
// that was not the one on the borrowing capacity.
//
// IT GROUPS. IT DOES NOT ADD UP.
//
// An earlier version of this put a subtotal under each property - what was lent
// on that house and what it cost a month. Fabio, same day: "scrap the last line
// on each property", "no need to add splits and repayments". So there is no
// per-property total here, in the form or in the client email. The one total on
// the page is the whole deal's, which is where it already was.
//
// WHY THIS IS NOT groupBySecurity(). That one is for finished figures and drops
// a split with no amount, because a client email should not show an empty row.
// A FORM must show every split, including the blank one somebody is part way
// through typing, or the row they are working on disappears under them.
//
// EVERY SPLIT APPEARS EXACTLY ONCE. The ones pointing at a security that is not
// ticked, or at nothing at all, come back in `loose` rather than being dropped.
// Money no property is carrying is the dangerous kind, so it is shown, not
// hidden.
//
// THE INDEX TRAVELS WITH THE SPLIT. The form updates `refinanceSplits[i]`, and
// after grouping, position in the group is no longer position in the list.
// Handing back the original index is what stops an edit landing on the wrong
// loan.
//
// NOTHING HERE TOUCHES REACT, so the arranging can be tested without a browser.

export type LoRow = { split: any; index: number }

export type LoGroup = {
  /** null for the group of splits that sit against no security. */
  security: Security | null
  rows: LoRow[]
}

/**
 * Every split under the security it is against, in the order the securities are
 * ticked on the BC, plus the ones against nothing.
 */
export function groupLoSplits(splits: any, securities: Security[]): { groups: LoGroup[]; loose: LoGroup } {
  const list: any[] = Array.isArray(splits) ? splits : []
  const secs = Array.isArray(securities) ? securities : []
  const have = new Set(secs.map(s => s.id))
  const all: LoRow[] = list.map((split, index) => ({ split, index }))

  return {
    groups: secs.map(security => ({ security, rows: all.filter(r => splitSecurityId(r.split) === security.id) })),
    loose: { security: null, rows: all.filter(r => !have.has(splitSecurityId(r.split))) },
  }
}

/** Nothing is being carried by a property that is not on this deal. */
export function everySplitHasASecurity(splits: any, securities: Security[]): boolean {
  return groupLoSplits(splits, securities).loose.rows.length === 0
}

// THE THREE COLOURS, ONE PER PROPERTY.
//
// Fabio, 12 Oct 2026: "each line that has a property make it a different colour
// to really pop and separate".
//
// CHECKED, NOT CHOSEN BY EYE. These three were run through a colourblind
// separation check before being used; three earlier sets failed it and were
// thrown out, including a blue and a violet that measured 6.8 apart to a
// red-green reader - which is another way of writing "the same colour". That is
// the same mistake lib/colours.ts records about amber against the chase red, so
// it is not one this portal gets to make twice.
//
// NO AMBER, and every band is dark text on a light tint: Word paints a
// background from the bgcolor attribute and throws away the text colour, so
// pale-on-dark would arrive unreadable. See lib/email-shell.ts.
//
// AND THE COLOUR IS NEVER THE ONLY CUE. Every band carries its number and its
// address as well, for a client who prints in black and white or an email
// client that strips the colour.
export type PropertyColour = { bar: string; band: string; ink: string }

export const PROPERTY_COLOURS: PropertyColour[] = [
  { bar: '#0A6193', band: '#E6F1F8', ink: '#0A4A6E' },
  { bar: '#C05BA8', band: '#FAEDF6', ink: '#8A3A74' },
  { bar: '#2E9E6B', band: '#E8F5EE', ink: '#1A6B46' },
]

// A FOURTH PROPERTY DOES NOT GET AN INVENTED HUE. Nothing was checked past the
// third, and a generated colour is exactly how a palette stops being readable.
// It wears the last one again; the number beside it still tells them apart.
export function propertyColour(i: number): PropertyColour {
  if (!Number.isFinite(i) || i < 0) return PROPERTY_COLOURS[0]
  return PROPERTY_COLOURS[Math.min(Math.floor(i), PROPERTY_COLOURS.length - 1)]
}
