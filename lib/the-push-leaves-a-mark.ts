// THE PUSH LEAVES A MARK, WHETHER IT WORKS OR NOT.
//
// 13 Nov 2026, Jayver Varghese. Fabio: "we press the button push to sales
// tracker. The email never went out to the team."
//
// It took until midnight, three SQL queries and the Supabase request logs to
// establish what had happened - and the answer was that nothing had. No email
// was ever requested. The portal wrote nothing when that button was pressed,
// so a deal somebody had pushed and a deal nobody had touched looked exactly
// the same on screen, and in the database.
//
// The only record of a failure was a message box on somebody's screen that
// vanished when it was clicked.
//
// Fabio: "I need 100% certainty... otherwise i need to flag with a team
// memeber." Nobody should have to interview their staff to find out whether a
// button worked.
//
// SO THE ATTEMPT IS WRITTEN FIRST, BEFORE ANYTHING IS TRIED. Then the outcome
// is written on top of it. A failure that happens in between leaves the
// attempt behind, which is the whole point: an attempt with no outcome is a
// push that died halfway, and that is exactly the case we could not see.
//
// WHAT THIS CANNOT DO. If somebody has been signed out, nothing can be written
// to the database at all - not even this. That case is covered by the tab
// finding out and saying so; see lib/the-door-closed.ts. This file is for
// every other way a push can fail.

export type Push = {
  /** When it was pressed. ISO, and shown in Sydney time wherever it is drawn. */
  at: string
  /** The person who pressed it. */
  by: string
  byId?: string
  /** 'trying' until we know, then one of the two below. */
  state: 'trying' | 'sent' | 'failed'
  /** Where it went, on a success. */
  to?: string
  /** How many documents went with it. */
  packs?: number
  /** Why, on a failure, in words a person can act on. */
  why?: string
}

/** The most that is kept. A card does not need a year of attempts. */
export const KEEP = 10

const txt = (v: any) => String(v ?? '').trim()

export function listOf(raw: any): Push[] {
  return Array.isArray(raw) ? raw.filter(p => p && typeof p === 'object') as Push[] : []
}

/** A new attempt, written BEFORE the email is tried. */
export function startPush(by: string, now: Date, byId?: string): Push {
  return { at: now.toISOString(), by: txt(by) || 'Somebody', byId, state: 'trying' }
}

export function appended(raw: any, push: Push): Push[] {
  return [...listOf(raw), push].slice(-KEEP)
}

/**
 * THE OUTCOME GOES ON TOP OF THE ATTEMPT, never beside it. Two rows for one
 * press is how a log starts lying about how many times something happened.
 */
export function settled(raw: any, at: string, outcome: Partial<Push>): Push[] {
  const all = listOf(raw)
  const i = all.findIndex(p => p.at === at)
  if (i < 0) return all
  const copy = all.slice()
  copy[i] = { ...copy[i], ...outcome }
  return copy
}

export function latest(raw: any): Push | null {
  const all = listOf(raw)
  return all.length ? all[all.length - 1] : null
}

/**
 * IS THIS DEAL WAITING ON SOMEBODY WHO DOES NOT KNOW IT IS WAITING?
 *
 * A deal nobody has pushed is not a problem - it simply is not ready. A deal
 * where the last attempt did not go is the Jayver case: somebody believes they
 * have handed it over and nobody has it.
 *
 * 'trying' counts. A push that never came back is a push that never arrived.
 */
export function pushedButNotSent(raw: any): boolean {
  const last = latest(raw)
  return !!last && last.state !== 'sent'
}

/** What the red line says. Plain, and it says what to do. */
export function theProblem(raw: any): string {
  if (!pushedButNotSent(raw)) return ''
  return 'This deal has not been pushed. The last attempt failed and no email was sent, '
    + 'so nobody has been told it is ready. Press Done to try again.'
}

/** "Email sent to info@... and Cris · 3 PDFs attached", or why it did not. */
export function whatHappened(p: Push): string {
  if (p.state === 'sent') {
    const where = txt(p.to)
    const n = Number(p.packs)
    return [where ? `Email sent to ${where}` : 'Email sent',
            Number.isFinite(n) && n > 0 ? `${n} PDFs attached` : '']
      .filter(Boolean).join(' · ')
  }
  if (p.state === 'failed') return txt(p.why) || 'Failed. No email sent.'
  return 'Started, and never finished. No email sent.'
}

// ---------------------------------------------------------------------------
// AND IT COMES TO YOU ON ITS OWN
// ---------------------------------------------------------------------------
//
// 14 Nov 2026, Fabio: "run through on his own after 1 hours."
//
// A push that has not landed is not a thing to notice on Monday. Credit are
// waiting, the broker believes it is handed over, and the client is waiting on
// both of them. An hour is long enough that a slow email is not a false alarm,
// and short enough that somebody can still fix it the same day.
export const STUCK_AFTER_MS = 60 * 60 * 1000

/**
 * SHOULD THIS DEAL BE PUT IN FRONT OF MANAGEMENT?
 *
 * Pushed, not sent, and an hour has gone by. A deal nobody has pushed is not
 * here - that is a deal that is not ready, not a deal that is stuck.
 */
export function needsChasing(raw: any, now: Date = new Date()): boolean {
  const last = latest(raw)
  if (!last || last.state === 'sent') return false
  const at = new Date(String(last.at || '')).getTime()
  if (!Number.isFinite(at)) return false
  return now.getTime() - at >= STUCK_AFTER_MS
}

/** The line it reads as on the run-through. */
export function chaseLine(raw: any): string {
  const last = latest(raw)
  if (!last) return ''
  return `Pushed by ${last.by} and never arrived — nobody has this deal.`
}
