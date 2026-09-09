// SEEING WHAT SOMEBODY ELSE IS TYPING.
//
// The deal page has never had live updates. Each browser loaded the deal once
// and then only knew what it loaded, so two people in one deal each worked on
// their own private copy and found out at save time - or, before the save guard
// existed, never found out at all, because the later save wrote the whole thing
// over the top. That is Alexis Janes. That is William Welton.
//
// Fabio, 8 Sep 2026: "I want live editing like google sheets."
//
// THE RULE THAT MAKES IT SAFE. Somebody else's save may only fill in fields
// this person has not touched. Anything they have typed - and above all the box
// their cursor is in - is left exactly alone. merge3 already answers precisely
// that question, field by field, and has done since the Fact Find learned to
// merge; this is the same machinery, applied a second earlier.
//
// So the sequence is:
//
//    they save  ->  Postgres tells this browser  ->  fold their fields onto the
//    screen  ->  the number in the box becomes the right number
//
// No banner, nothing to dismiss, nothing to reload. See DealPageClient for the
// subscription and the four forms for what each does with the result.

import { merge3 } from './deal-merge'

// LIVE EDITING IS OFF.
//
// Off since 9 Sep 2026. The fold itself was switched off first; this switch is
// wider, because the SUBSCRIPTION was still running with the fold disabled -
// and the subscription was the more expensive half. Every save arriving from
// the database set a piece of state on the deal page, which re-rendered the
// whole page, including the box somebody was typing into. See
// DealPageClient. It goes back on when it has been watched working with two
// windows open. One line, here.
export const LIVE_EDITING = false

export type DealColumn = 'fact_find_data' | 'bc_data' | 'lo_data' | 'compliance_data'

export type LiveUpdate = {
  // What the record now holds for this column, as saved by somebody else.
  incoming: any
  // Who saved it. Their own write coming back is not news.
  byId: string
  byName: string
  version: number | null
}

// WHAT TO PUT ON SCREEN WHEN SOMEBODY ELSE SAVES.
//
//   base    what the database held when this screen last agreed with it
//   theirs  what it holds now
//   mine    what is on this screen, including anything half typed
//
// Returns the value to show, or null to leave the screen completely alone.
export type Fold =
  | { kind: 'take'; value: any; fields: string[] }
  // Nothing of theirs that this screen does not already have.
  | { kind: 'nothing' }
  // The same field, both of them, different values. Theirs is in the database
  // and this person's is on screen and about to be saved over it - which is the
  // behaviour that was there before and is not made worse by looking. Nothing
  // is shown; the save path still keeps the version it replaces.
  | { kind: 'clash'; fields: string[] }

export function foldIn(base: any, theirs: any, mine: any): Fold {
  // Their save contained nothing this screen has not got.
  if (JSON.stringify(theirs) === JSON.stringify(mine)) return { kind: 'nothing' }

  // Nothing typed here since we last agreed with the database, so there is
  // nothing of ours to protect. Take theirs whole - this is the ordinary case,
  // and it is what makes a second screen feel live.
  if (JSON.stringify(base) === JSON.stringify(mine)) {
    return { kind: 'take', value: theirs, fields: [] }
  }

  const merged = merge3(base, theirs, mine)
  if (merged.ok) {
    if (merged.fromThem.length === 0) return { kind: 'nothing' }
    return { kind: 'take', value: merged.merged, fields: merged.fromThem.map(p => p.join('.')) }
  }
  return { kind: 'clash', fields: merged.clashes.map(p => p.join('.')) }
}

// IS THIS MY OWN WRITE COMING BACK?
//
// Every save stamps the deal with who made it. Without this the screen would
// fold its own save back onto itself a moment after making it, which is
// harmless but wasteful - and on a slow connection can arrive after the next
// keystroke, which is not.
export function isMine(update: LiveUpdate, meId: string | null | undefined): boolean {
  const a = String(update?.byId ?? '').trim()
  const b = String(meId ?? '').trim()
  return a !== '' && a === b
}
