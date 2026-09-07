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

export type WipeVerdict = { wipe: false } | { wipe: true; had: number; keeping: number }

export function looksLikeAWipe(stored: any, next: any): WipeVerdict {
  const had = filledCount(stored)
  if (had < ENOUGH_TO_JUDGE) return { wipe: false }
  const keeping = filledCount(next)
  if (keeping >= Math.ceil(had * MUST_KEEP)) return { wipe: false }
  return { wipe: true, had, keeping }
}

// Said to the person, not to a log file. They need to know nothing was lost and
// what to do next, and somebody needs to hear about it.
export function wipeMessage(tab: string, v: { had: number; keeping: number }): string {
  return `NOT SAVED - this would have emptied most of the ${tab} (${v.had} things filled in, `
       + `${v.keeping} left). Nothing has been changed. Reload the page to get your work back on screen, `
       + `and tell Fabio this happened.`
}
