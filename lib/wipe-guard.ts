// A SEATBELT AGAINST EMPTYING SOMEBODY'S FORM.
//
// Alexis_Janes_INV_Preapp_2026, 7 Sep 2026. A completed BC - scenario, figures,
// splits, notes, the email that went to the client - came back the next morning
// holding a purchase price, a state, and nothing else. Fabio: "all the data was
// there and now not there again."
//
// Everything else in this folder answers "whose version wins?". None of it asks
// the blunter question: does this save make sense AT ALL? A browser that has
// somehow ended up holding an empty form will save that empty form perfectly
// correctly, win every version check, and destroy an afternoon's work with no
// error and nothing on screen.
//
// So before any whole-record save, compare what is about to be written with what
// is there. Losing nearly everything is not an edit. Somebody clearing a field or
// switching scenario loses a few things; nobody clears thirty five fields by
// hand in one keystroke, and if they ever genuinely want to, clearing them in
// two goes works fine.
//
// DELIBERATELY BLUNT. It does not care WHY the form emptied - a bad remount, a
// failed load, a bug not yet found. It refuses, says so, and leaves the record
// alone. A false alarm costs somebody one confusing message. Being wrong the
// other way costs a day's work and the team's confidence in the portal.

// Below this there is not enough in the record to say anything useful. A nearly
// empty form legitimately becomes a slightly less empty one all day long.
const ENOUGH_TO_JUDGE = 8

// How much of what was there has to survive. A scenario change on a BC keeps the
// price, the deposit, the applicants, the notes - the great majority. A form
// that has lost two thirds of everything is not somebody editing.
const MUST_KEEP = 0.35

// Every value a person could have put there, counted once. Structure is ignored
// on purpose: it is the typing that matters, not the shape it is held in.
export function filledCount(value: any): number {
  let n = 0
  const walk = (v: any) => {
    if (v === null || v === undefined) return
    if (Array.isArray(v)) { v.forEach(walk); return }
    if (typeof v === 'object') { Object.values(v).forEach(walk); return }
    if (typeof v === 'boolean') { if (v) n++; return }
    if (typeof v === 'number') { if (v !== 0) n++; return }
    const s = String(v).trim()
    // '0' and 'Select' and the like are what an untouched field holds.
    if (s === '' || s === '0' || s === 'Select' || s === 'Annually') return
    n++
  }
  walk(value)
  return n
}

// COUNTING BOXES IS NOT ENOUGH. WILLIAM WELTON, 7 SEP 2026.
//
// A finished refinance BC - existing loan balance $424,000, valuation $540,000,
// the split at $448,700, the equity release - came back holding the scenario,
// the brand, the signature, a thirty year term and an empty set of money boxes.
// Maria had already generated the client email off it, so the figures were
// certainly there.
//
// The count went from about 32 filled to 23. That is 72% kept, so the test above
// waved it through, and correctly by its own lights: almost every BOX survived.
// What did not survive was every number on the deal.
//
// Fabio: "I cannot have the basic data be lost moving forward."
//
// So the money is counted separately. A record can lose a dropdown, a note, a
// checklist item and half its labels and still be somebody editing. A record
// that loses most of its FIGURES has lost the thing it exists to hold.

// A rate is 6.95, a term is 30, dependants are 2. None of those are the money.
const A_FIGURE = 1000

// Below this there is not enough money in the record to reason about. A BC with
// two figures in it is somebody halfway through typing.
const ENOUGH_FIGURES_TO_JUDGE = 3

// Half. Deliberately looser than the count test above, because losing figures
// legitimately does happen - a scenario change resets the splits, a property
// with a loan on it gets deleted.
const MUST_KEEP_FIGURES = 0.5

// And on top of the proportion, an absolute floor: deleting one property with
// one loan on it drops two figures and must stay allowed. Three or more going at
// once is the shape of a wipe, not the shape of an edit.
const A_WIPE_LOSES_AT_LEAST = 3

// Money as this codebase stores it: comma grouped, or long enough that it cannot
// be a year. Dates have dashes, rates have one decimal place and no thousands,
// and an HTML email is not a number however hard you squint at it.
function looksLikeMoney(v: any): boolean {
  if (typeof v !== 'string' && typeof v !== 'number') return false
  const s = String(v).trim()
  if (!/^\$?\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(s) && !/^\$?\d+(\.\d{1,2})?$/.test(s)) return false
  const digits = s.replace(/[^0-9]/g, '')
  // "2026" is a year. "5,000" and "448700" are money.
  if (!s.includes(',') && !s.includes('.') && digits.length < 5) return false
  const n = Number(s.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n >= A_FIGURE
}

// Every figure in the record, counted once, wherever it is nested.
export function figureCount(value: any): number {
  let n = 0
  const walk = (v: any) => {
    if (v === null || v === undefined) return
    if (Array.isArray(v)) { v.forEach(walk); return }
    if (typeof v === 'object') { Object.values(v).forEach(walk); return }
    if (looksLikeMoney(v)) n++
  }
  walk(value)
  return n
}

export type WipeVerdict =
  | { wipe: false }
  // Most of the record went.
  | { wipe: true; kind: 'everything'; had: number; keeping: number }
  // The boxes are still there and the money is gone. William Welton.
  | { wipe: true; kind: 'figures'; had: number; keeping: number }

function scenarioChanged(stored: any, next: any): boolean {
  const a = stored && typeof stored === 'object' ? stored.template : undefined
  const b = next && typeof next === 'object' ? next.template : undefined
  return typeof a === 'string' && typeof b === 'string' && a !== '' && b !== '' && a !== b
}

export function looksLikeAWipe(stored: any, next: any): WipeVerdict {
  const had = filledCount(stored)
  if (had >= ENOUGH_TO_JUDGE) {
    const keeping = filledCount(next)
    if (keeping < Math.ceil(had * MUST_KEEP)) return { wipe: true, kind: 'everything', had, keeping }
  }

  // EXCEPT WHEN THE SCENARIO CHANGED.
  //
  // Picking a different scenario on the BC or the LO deliberately rebuilds the
  // splits, and the new ones arrive with their amounts empty - that is what
  // picking a scenario is FOR. On a compare-options BC that clears four figures
  // in one go and would look exactly like a wipe. It is the one time somebody
  // means it, and it is the one time we can tell, because the scenario itself is
  // recorded right there in the record.
  if (scenarioChanged(stored, next)) return { wipe: false }

  // Checked even when the count test passed, and even on a small record - the
  // whole point is that this one fires when the count looks healthy.
  const hadFigures = figureCount(stored)
  if (hadFigures >= ENOUGH_FIGURES_TO_JUDGE) {
    const keepingFigures = figureCount(next)
    const lost = hadFigures - keepingFigures
    if (lost >= A_WIPE_LOSES_AT_LEAST && keepingFigures < hadFigures * MUST_KEEP_FIGURES) {
      return { wipe: true, kind: 'figures', had: hadFigures, keeping: keepingFigures }
    }
  }

  return { wipe: false }
}

// Said to the person, not to a log file. They need to know nothing was lost and
// what to do next, and somebody needs to hear about it.
export function wipeMessage(tab: string, v: { kind?: 'everything' | 'figures'; had: number; keeping: number }): string {
  if (v.kind === 'figures') {
    return `NOT SAVED - this would have wiped the figures on the ${tab} (${v.had} amounts were recorded, `
         + `${v.keeping} would be left) while leaving the rest of the form looking normal. Nothing has been `
         + `changed. Reload the page to get your work back on screen. If you really are clearing them, `
         + `do it a few at a time and it will save. Please tell Fabio this happened.`
  }
  return `NOT SAVED - this would have emptied most of the ${tab} (${v.had} things filled in, `
       + `${v.keeping} left). Nothing has been changed. Reload the page to get your work back on screen, `
       + `and tell Fabio this happened.`
}
