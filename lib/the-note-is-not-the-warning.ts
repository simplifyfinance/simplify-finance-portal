// A DOCUMENT THAT GOES TO A LENDER DOES NOT SHOUT AT ITS OWN AUTHOR.
//
// 17 Nov 2026. The compliance notes carried this inside the prose:
//
//   "... Split 2, $57,600 at 7.00%, interest only for 5 years. ** NOT RECORDED
//    — nothing has been recorded to explain the following splits: Refinanced
//    loan and Split 2. Record the purpose of the funds on the borrowing
//    capacity. ** The clients recorded a redraw facility ..."
//
// The warning is right. Its place is wrong. A broker deleted four of them by
// hand before sending that file, which is a system that works until the one
// morning somebody is in a hurry - and then it is in a lender's inbox.
//
// Fabio, asked where they should go: in a red list above the note, each one a
// link to the box that fills it. And asked whether the list should stop anybody
// working: "No, I don't want to block it because it makes it hard, but just put
// a warning on top." So it warns. It never blocks.
//
// NOTHING IS LOST BY MOVING IT. The warning sentences come out of the text and
// go to the top WORD FOR WORD - they are fuller than the gap list, which only
// names the field - and the gap list keeps pointing at where each one is fixed.

const MARK = /\*\*\s*([\s\S]*?)\s*\*\*/g

const tidy = (s: string) => s
  // Two spaces where a warning used to sit between two sentences.
  .replace(/[ \t]{2,}/g, ' ')
  // " ." and " ," left behind when a warning ended a sentence.
  .replace(/\s+([.,;])/g, '$1')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

/** Every warning in the text, in order, without its asterisks. */
export function warningsIn(text: any): string[] {
  const out: string[] = []
  const raw = String(text ?? '')
  for (const m of raw.matchAll(MARK)) {
    const said = String(m[1] || '').trim()
    if (said) out.push(said)
  }
  return out
}

/** The note as it should read. */
export function withoutWarnings(text: any): string {
  return tidy(String(text ?? '').replace(MARK, ' '))
}

/**
 * THE WORDS THE BOX ACTUALLY CARRIES.
 *
 * The warnings come out - unless they were the only thing in it.
 *
 * 17 Nov 2026, found by the browser check on the first ship after this was
 * written. On a deal with nothing recorded, three boxes said nothing BUT a
 * warning: "** NOT RECORDED - this deal records neither a purchase price, an
 * equity release nor any debt being paid out... **" Lifting that out left an
 * empty textarea, so a person pressed Write from the deal and watched nothing
 * happen, which reads as a broken button rather than as an empty answer.
 *
 * A box with nothing else to say keeps what it had. The complaint this was
 * built for is a warning sitting in the MIDDLE of a finished paragraph that
 * goes to a lender - and a box that is only a warning never goes anywhere,
 * because nobody sends a note that says nothing.
 */
export function noteText(text: any): string {
  return withoutWarnings(text) || String(text ?? '').trim()
}

export type Gap = { what: string; where: string }
export type ToFix = { what: string; where: string }

/**
 * THE LIST THAT SITS ABOVE THE NOTE.
 *
 * The warning sentences first, because they say what is missing and often why
 * it matters. Then any gap the warnings did not already name, because a gap
 * carries the one thing a warning does not - the box it is fixed in.
 *
 * A gap counts as named when its own words appear in one of the warnings; the
 * two are written side by side in the boxes, so that is usually true and the
 * list stays short.
 */
export function toFix(text: any, gaps: Gap[] | null | undefined): ToFix[] {
  const warnings = warningsIn(text)
  const said = warnings.join(' ').toLowerCase()
  const out: ToFix[] = warnings.map(w => ({ what: w, where: '' }))

  for (const g of gaps || []) {
    const what = String(g?.what ?? '').trim()
    if (!what) continue
    // The gap's own words are already on the list - give the warning the box
    // to go and fix it in rather than printing the same thing twice.
    const already = out.find(o => o.what.toLowerCase().includes(what.toLowerCase()))
    if (already) { if (!already.where) already.where = String(g.where || ''); continue }
    if (said.includes(what.toLowerCase())) continue
    out.push({ what, where: String(g.where || '') })
  }
  return out
}
