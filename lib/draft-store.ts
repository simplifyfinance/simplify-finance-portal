// A COPY OF UNSAVED WORK THAT SURVIVES THE TAB DYING.
//
// The last hole in the "letters disappearing" family. Four faults wore that
// shirt and three are closed: the save no longer fires on every keystroke, an
// arriving record can no longer write a box somebody is typing in, and leaving
// the page writes what is pending. The save line stopped lying about all of it
// on 16 Sep.
//
// What is left is the save FAILING. Wifi drops, the laptop sleeps, the database
// hiccups. The screen now shouts - "NOT SAVED, don't close this tab" - but while
// it is shouting, that typing exists in exactly one place: the memory of that
// browser tab. Close it, flatten the battery, let the OS reap it, and it is
// gone. The warning only works if a person reads it and obeys it, and at ten to
// five on a Friday somebody will close the tab.
//
// THIS HAS BEEN TRIED AND RIPPED OUT BEFORE, and the note explaining why is
// still in LOForm: "a per-browser cache keyed only by deal id showed one user
// another user's state, and let a blank form overwrite a real record."
//
// Both of those are designed out here, not hoped away:
//
//   1. THE KEY CARRIES WHO. No user id, no draft - nothing is ever written that
//      cannot be attributed, and one person's browser can never hand their work
//      to somebody else's screen.
//
//   2. A DRAFT IS NEVER WRITTEN TO THE DATABASE. Not on load, not in the
//      background, not ever. It is OFFERED to the person who typed it and they
//      decide. A draft that would empty a real record is not even offered - it
//      goes through the same wipe guard as a save.
//
// And a draft lives only while the work is unsaved: the moment a save lands, the
// copy is thrown away. What is in here is only ever work the database does not
// have.

import { looksLikeAWipe } from './wipe-guard'

export type Draft = { at: number; value: any }

// Long enough to survive a weekend and a flat battery, short enough that nobody
// is offered a fortnight-old ghost of a deal that has moved on since.
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// WHO, WHICH DEAL, WHICH TAB. All three, always. The version prefix means an old
// shape can never be read back as a new one.
export function draftKey(meId: any, dealId: any, column: string): string | null {
  const who = String(meId ?? '').trim()
  const deal = String(dealId ?? '').trim()
  const col = String(column ?? '').trim()
  if (!who || !deal || !col) return null
  return `sf.draft.v1.${who}.${deal}.${col}`
}

function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.every(isEmpty)
  if (typeof v === 'object') return Object.values(v).every(isEmpty)
  return false
}

const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)

export type OfferReason = 'offer' | 'none' | 'expired' | 'same-as-saved' | 'empty' | 'would-wipe'

// SHOULD THIS PERSON BE ASKED ABOUT THIS DRAFT?
//
// Everything that is not a plain yes is named, so a draft that is quietly not
// offered can be explained rather than guessed at.
export function offerVerdict(draft: Draft | null, stored: any, now = Date.now()): OfferReason {
  // Number.isFinite, not typeof: NaN is a number, and a draft carrying a
  // corrupt timestamp slipped straight past a typeof check into the age and
  // sameness tests, where every comparison against NaN quietly answers false.
  if (!draft || !Number.isFinite(draft.at)) return 'none'
  if (now - draft.at > DRAFT_MAX_AGE_MS) return 'expired'
  if (isEmpty(draft.value)) return 'empty'
  // The database caught up. Nothing to offer and nothing was lost.
  if (same(draft.value, stored)) return 'same-as-saved'
  // The blank form that overwrote a real record, refused at the door. Same
  // judgement a save goes through - see lib/wipe-guard.ts.
  if (looksLikeAWipe(stored, draft.value).wipe) return 'would-wipe'
  return 'offer'
}

export function shouldOffer(draft: Draft | null, stored: any, now = Date.now()): boolean {
  return offerVerdict(draft, stored, now) === 'offer'
}

// "at 4:52pm today", "on Fri at 4:52pm". The person needs to know whether this
// is the sentence they just lost or something from last week.
export function draftWhen(at: number, now = Date.now()): string {
  const d = new Date(at)
  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  const sameDay = new Date(now).toDateString() === d.toDateString()
  if (sameDay) return `at ${time} today`
  return `on ${d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`
}
