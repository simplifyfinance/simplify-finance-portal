// THE LAST HALF SECOND.
//
// 15 Sep 2026. Nothing disappears while somebody types any more - that was
// fixed today, in lib/field-ownership.ts. This is the OTHER way the same words
// go missing, and it feels identical to whoever it happens to.
//
// The autosave waits 600ms after the last keystroke. A refresh, a closed tab or
// a click through to another page inside that window takes the sentence with
// it: the box looked perfect the whole time, and the last line is not there
// when the deal is opened again.
//
// The portal already writes when a box is left, when the tab is changed and
// when the window is hidden. What is left is the page being torn down
// mid-thought - and a normal save cannot survive that, because the request dies
// with the page that made it. So the page sends one last fire-and-forget write
// on its way out, carrying ONLY the free typing boxes with something unsaved in
// them.
//
// AND IT CANNOT DESTROY ANYBODY'S WORK.
//
// Nobody is watching this write. Nobody sees whether it worked, and nothing
// asks them to choose if it collides with somebody. So it is not allowed to win
// an argument: every field carries `was` - what this screen last saw saved in
// that box - and the server writes `now` only if the stored value still matches
// it. If somebody else has been in that box since, the field is skipped and
// their words stand.
//
// That is a deliberately weaker rule than a normal save, which merges and keeps
// a copy of anything it replaces. This one is a safety net, not a save.

import { busyFields, readField, writePath, type Ownership } from './field-ownership'

// ONLY THE FREE TYPING BOXES, NAMED OUT LOUD.
//
// A figure, a tick box or a dropdown is typed and left; it is a sentence
// written over minutes that gets lost. Keeping this list short is what makes an
// unwatched write safe to have at all - it cannot reach a loan amount.
export const KEEPALIVE_FIELDS = [
  // BC
  'brokerNotes', 'templateNotes', 'internalNotes',
  // Fact Find
  'loanPurpose', 'goals2Years', 'goals10Years',
  // Lending options
  'brokerPersonalisation', 'recommendationNote', 'importantNotes', 'additionalNotes',
  // Compliance - the nine written up boxes, and the three typed ones
  'needsPrimary', 'needsImmediate', 'needsLongTerm', 'analysisComment', 'depositComment',
  'creditHistoryComment', 'securityComment', 'optionsComment', 'borrowingPowerComment',
  'applicationSubmissionComment', 'productReqs.otherRequirements',
] as const

const allowed = (field: string) => (KEEPALIVE_FIELDS as readonly string[]).includes(field)

export type PatchEntry = { was: any; now: any }
export type Patch = Record<string, PatchEntry>

// What this screen still owes the database.
export function buildPatch(o: Ownership, onScreen: any): Patch {
  const patch: Patch = {}
  for (const field of busyFields(o)) {
    if (!allowed(field)) continue
    const now = readField(onScreen, field)
    if (now === undefined) continue
    const was = o.lastSaved[field]
    // Focused but unchanged. Nothing owed.
    if (JSON.stringify(was) === JSON.stringify(now)) continue
    patch[field] = { was, now }
  }
  return patch
}

const isRecord = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v)

export type PatchResult = { record: any; changed: string[]; skipped: string[] }

// Applied on the server against the record as it is at that moment.
export function applyPatch(stored: any, patch: any): PatchResult {
  const changed: string[] = []
  const skipped: string[] = []
  let record = stored
  if (!isRecord(patch)) return { record, changed, skipped }

  for (const [field, entry] of Object.entries(patch)) {
    if (!allowed(field)) continue
    if (!isRecord(entry) || !('now' in (entry as any))) continue
    const { was, now } = entry as PatchEntry
    const current = readField(record, field)
    // A box this screen had never seen saved may only be written where there is
    // still nothing in it. Anything else is somebody else's.
    const free = was === undefined
      ? (current === undefined || current === null || current === '')
      : JSON.stringify(current) === JSON.stringify(was)
    if (!free) { skipped.push(field); continue }
    if (JSON.stringify(current) === JSON.stringify(now)) continue
    record = writePath(record, field, now)
    changed.push(field)
  }
  return { record, changed, skipped }
}
