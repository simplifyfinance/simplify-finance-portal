// TWO PEOPLE, ONE DEAL, ONE BLOB.
//
// All four forms on a deal - BC, Fact Find, Lending options, Compliance -
// autosave the WHOLE jsonb column a moment after any keystroke. With two people
// on the same deal that is last-write-wins on a shared document:
//
//   Katie fills in the rates            her browser writes lo_data
//   Fabio types anything at all         his browser writes lo_data, loaded
//                                       before those rates existed
//   the rates are gone                  no error, nothing on screen
//
// Fabio, 4 Sep 2026: "Katie put all the rates and repayments in but when it came
// to me some of the boxes were blank - so I had to do it again."
//
// WHAT THE FIRST VERSION OF THIS FILE GOT WRONG (5 Sep 2026)
//
// It asked one question - "has the stored record changed since I loaded it?" -
// and refused to save whenever the answer was yes. Three things were wrong with
// that, and together they locked the Fact Find for Katie and Kylie:
//
//   1. NO WAY BACK. The banner was only ever cleared by a successful save, and
//      saving was refused while the banner was up. Once it tripped it could
//      never untrip. Only a page reload cleared it.
//
//   2. OPENING A DEAL COUNTS AS CHANGING IT. The Fact Find tidies itself the
//      moment it opens - matching income lines to jobs, filling defaults - and
//      saves that tidy-up. So merely opening the deal moved the record forward
//      and made the other person stale before either had typed a word. They
//      then bounced it back and forth at each other by reloading. Kylie, 5 Sep
//      2026: "I gave up."
//
//   3. A FORM COULD CONFLICT WITH ITSELF. Two saves in flight at once landed
//      out of order, and the form then read its OWN last save as somebody
//      else's. That locked a deal nobody else had open. Kylie again: "But even
//      when she was out - I couldnt change the Fact Find."
//
// So the question is no longer "has the record changed" but "would writing this
// destroy work that is not mine?" - which is a different and much narrower
// thing. Everything below exists to answer that one question honestly.
//
// WHAT THIS IS NOT. There is still a window of milliseconds between the read and
// the write where a save could land underneath, and two people editing the same
// tab at the same time still get the banner - it does not merge their work yet.
// Closing both properly needs a version column and a field-level three way
// merge. This turns a certainty into a rarity. It is not a guarantee and should
// not be described as one.

import { merge3 } from './deal-merge'
import { describePaths } from './deal-field-names'

export type DealColumn = 'bc_data' | 'fact_find_data' | 'lo_data' | 'compliance_data'

// What this form believes the database holds. Compared like with like: the raw
// stored value, before any defaults the form applies on load.
export function snapshot(value: any): string {
  return JSON.stringify(value ?? null)
}

export type SaveOutcome =
  | { kind: 'saved' }
  // Somebody else saved different fields while this person was typing, and the
  // two fitted together. Both are now written. `fields` names what came from
  // them, in plain English, so the screen can say so.
  | { kind: 'merged'; fields: string }
  // Nothing needed doing, or we quietly caught up to somebody else. Not an
  // error, not a conflict - the form should look completely normal.
  | { kind: 'settled' }
  // A newer save was asked for while this one was queued. Dropped on purpose so
  // an older payload can never land on top of a newer one.
  | { kind: 'superseded' }
  // The SAME field, changed by both, to different things. Nothing is written.
  // `fields` names the field, which is the difference between a banner somebody
  // can act on and one they learn to ignore.
  | { kind: 'conflict'; fields: string }
  | { kind: 'error'; message: string }

// One per form instance. Held in a ref so it survives re-renders.
export type SaveGuard = {
  // What we believe the column holds right now.
  db: string | null
  // Snapshots this form has written. A record that matches one of these is our
  // own work arriving back at us, not somebody else's - see failure 3 above.
  mine: string[]
  // Saves run strictly one at a time, chained onto this.
  queue: Promise<any>
  // Bumped on every request so a queued save can tell it has been overtaken.
  seq: number
}

export function newGuard(loadedValue: any): SaveGuard {
  return { db: snapshot(loadedValue), mine: [], queue: Promise.resolve(), seq: 0 }
}

// A guard for a form that has not read the record yet. It will not judge
// anything until the first successful write or an explicit adopt().
export function emptyGuard(): SaveGuard {
  return { db: null, mine: [], queue: Promise.resolve(), seq: 0 }
}

// The form has just read the record itself (LO does this) - this is now what we
// believe the database holds.
export function adopt(guard: SaveGuard, storedValue: any): void {
  guard.db = snapshot(storedValue)
}

// Bounded on purpose. We only ever need to recognise the handful of writes that
// could still be in flight or have just landed; keeping every save this form has
// ever made would grow without limit on a deal somebody works in all afternoon.
const REMEMBER = 12
function remember(guard: SaveGuard, snap: string): void {
  guard.mine.push(snap)
  if (guard.mine.length > REMEMBER) guard.mine.shift()
}

export type SaveRequest = {
  supabase: any
  dealId: string
  column: DealColumn
  guard: SaveGuard
  // What this form wants the column to be.
  value: any
  // Other columns written in the same statement - the LO puts loan_amount and
  // lender_id on the deal, compliance puts lender_id.
  patch?: Record<string, any>
  // Called when somebody else's version is taken on board because this form had
  // nothing of its own to lose. The form should put this straight on screen.
  // A form that cannot re-hydrate itself leaves this out, and gets the banner
  // instead - refusing is always the safe answer.
  onAdopt?: (storedValue: any) => void
  // Called when their fields and this person's fields have been merged. The form
  // MUST put the merged record on screen - it now holds fields this screen has
  // never shown, and the next keystroke would otherwise write them back out.
  //
  // Unlike onAdopt this happens while somebody is mid-sentence, so it has to be
  // a state update, not a rebuild: no re-mounting, no losing the caret. A form
  // that cannot do that leaves this out and gets the banner - which is why BC,
  // whose fields are forty separate pieces of state with no single setter, still
  // refuses rather than merges.
  onMerge?: (mergedValue: any) => void
}

export async function saveGuarded(req: SaveRequest): Promise<SaveOutcome> {
  const { guard } = req
  const mySeq = ++guard.seq
  const run = () => attempt(req, mySeq)
  // Strictly one at a time. Two saves running at once is failure 3 above.
  const queued = guard.queue.then(run, run)
  guard.queue = queued.catch(() => {})
  return queued
}

async function attempt(req: SaveRequest, mySeq: number): Promise<SaveOutcome> {
  const { supabase, dealId, column, guard, value, patch, onAdopt, onMerge } = req

  // Somebody asked for a newer save while this one waited its turn. Writing this
  // one now would put an older payload on top of a newer one.
  if (guard.seq !== mySeq) return { kind: 'superseded' }

  const next = snapshot(value)
  // What actually gets written. The same thing this form asked to save, unless
  // somebody else's fields have been folded in on the way.
  let toWrite = value
  let broughtIn = ''

  const { data: current, error: readError } = await supabase
    .from('deals').select(column).eq('id', dealId).single()

  // A failed read is not evidence of anything. A form that silently stops saving
  // because the network hiccuped is worse than the problem this guard solves, so
  // let the write go and let the write's own checks deal with it.
  // Nothing has been loaded yet, so there is nothing to be stale about and
  // nobody to be in conflict with. The LO reads lo_data itself after mount and
  // is in this state until it has.
  if (!readError && guard.db !== null) {
    const stored = snapshot(current?.[column])

    // OPENING A DEAL IS NOT EDITING IT. Nothing has moved and we have changed
    // nothing, so there is nothing to write. Every one of these four forms used
    // to save itself a moment after it appeared on screen, which is what made
    // two people merely LOOKING at a deal collide with each other.
    if (stored === guard.db && next === guard.db) return { kind: 'settled' }

    if (stored !== guard.db) {
      // The record moved. Before calling that a conflict, rule out the three
      // ways it moves that cost nobody anything.

      // Our own earlier write, arriving back at us.
      if (guard.mine.includes(stored)) {
        guard.db = stored
      }
      // The record already says exactly what we were about to write. Somebody
      // typed the same thing, or this is a repeat of a save that did land.
      else if (stored === next) {
        guard.db = stored
        remember(guard, stored)
        return { kind: 'settled' }
      }
      // WE HAVE NOT TYPED ANYTHING. Our pending value is still the one we
      // loaded, so we have nothing to lose and nothing of theirs to overwrite.
      // Take their version quietly. This is the case that was locking the Fact
      // Find: two people with a deal merely OPEN were being told they were in
      // conflict before either had touched a key.
      else if (next === guard.db) {
        if (!onAdopt) return { kind: 'conflict', fields: '' }
        guard.db = stored
        onAdopt(current?.[column] ?? null)
        return { kind: 'settled' }
      }
      // BOTH OF US HAVE TYPED. Not necessarily into the same field, though -
      // Katie in the rates and Kylie in a date of birth are not in conflict at
      // all, and refusing both is the portal getting in the way of its own
      // users. So compare all three copies field by field, and only refuse if
      // something is actually contested. See lib/deal-merge.ts.
      else {
        // A form that cannot fold their fields onto a screen somebody is typing
        // into has to refuse. Refusing is always the safe answer.
        if (!onMerge) return { kind: 'conflict', fields: '' }

        const merge = merge3(JSON.parse(guard.db), current?.[column] ?? null, value)
        if (!merge.ok) return { kind: 'conflict', fields: describePaths(merge.clashes) }

        toWrite = merge.merged
        broughtIn = describePaths(merge.fromThem)

        // Their version already covers everything ours had. Nothing to write.
        if (snapshot(toWrite) === stored) {
          guard.db = stored
          remember(guard, stored)
          onMerge(toWrite)
          return { kind: 'merged', fields: broughtIn }
        }
      }
    }
  }

  const { data: rows, error } = await supabase
    .from('deals').update({ [column]: toWrite, ...(patch || {}) }).eq('id', dealId).select('id')

  if (error) return { kind: 'error', message: 'NOT SAVED - ' + error.message }
  // A write refused by row level security returns zero rows and NO error.
  if (!rows || rows.length === 0) {
    return { kind: 'error', message: 'NOT SAVED - your changes did not reach the database. Do not close this tab.' }
  }

  const written = toWrite === value ? next : snapshot(toWrite)
  guard.db = written
  remember(guard, written)

  // Only once the write has actually landed. Putting their fields on screen
  // before knowing they were saved would show somebody work that is not there.
  if (toWrite !== value && onMerge) {
    onMerge(toWrite)
    return { kind: 'merged', fields: broughtIn }
  }
  return { kind: 'saved' }
}

// What the banner says. One wording, so all four tabs say the same thing.
export function conflictMessage(tab: string, fields = ''): { title: string; body: string } {
  return {
    title: fields
      ? `You and somebody else have both changed ${fields}`
      : `Somebody else is editing this ${tab} at the same time as you`,
    body: (fields
        ? 'Everything else you both typed fits together — this one field does not, so nothing has been saved. '
        : 'They have saved changes since you opened it, so nothing you have typed in the last few minutes has been saved. ')
      + 'Saving it would wipe out what they entered. Copy anything you need to keep, then reload to pick up their '
      + 'version and type it back in.',
  }
}

// The quiet one. Somebody else was working on the same tab, their fields and
// this person's fields fitted together, and both are saved. Worth saying - a
// screen that changes under you with no explanation is its own kind of bug.
export function mergeMessage(fields: string): string {
  return fields
    ? `Somebody else saved while you were typing. Their changes to ${fields} are now on your screen. Nothing you typed was lost.`
    : 'Somebody else saved while you were typing. Their changes are now on your screen. Nothing you typed was lost.'
}
