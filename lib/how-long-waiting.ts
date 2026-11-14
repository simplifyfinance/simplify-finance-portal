// HOW LONG HAS THIS BEEN SITTING THERE.
//
// 15 Nov 2026. The broker's "waiting on someone else" card said what each deal
// was waiting on - Client, Valuer, Lender - and nothing else.
//
// Fabio, on what a broker actually does with that card: these are the deals
// nobody inside the business can move. Only he can. So the card is a chase
// list, and a chase list without ages is unusable - "Client" is a category,
// "Client, 6 days" is a phone call. A broker chases on age, not on kind.
//
// WHERE THE AGE COMES FROM. phaseSince() in lib/deal-phase.ts - the moment the
// deal entered the state it is in now. Not created_at, which would say 94 days
// for a deal that has moved four times this month and tell him nothing.
//
// NOTHING HERE IS RED. Fabio's rule for the broker's screen, 12 Nov: "nothing
// here pushes him... no target, no league table, nothing red at them." A deal
// waiting eleven days on a valuer is not his fault and a red chip reads like
// it is. The oldest simply goes to the top, which is the same information
// without the accusation.
import { phaseSince } from './deal-phase'

const DAY = 86_400_000

/** Whole days since the deal last moved, or null if nothing says when. */
export function daysWaiting(deal: any, now: Date = new Date()): number | null {
  const since = phaseSince(deal)
  if (!since) return null
  const at = new Date(String(since))
  if (!Number.isFinite(at.getTime())) return null
  const days = Math.floor((now.getTime() - at.getTime()) / DAY)
  return days < 0 ? 0 : days
}

/**
 * THE WORDS ON THE ROW.
 *
 * Deliberately plain. "11 days" is a fact; "11 days overdue" is a judgement,
 * and the portal does not know whose fault a valuer is.
 */
export function waitedWords(days: number | null): string {
  if (days === null) return ''
  if (days <= 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

/**
 * OLDEST FIRST, because the top of a list is the part anybody reads properly.
 *
 * A deal with no date sorts last rather than first: not knowing how long
 * something has waited is not the same as it having waited a long time.
 */
export function oldestFirst<T>(rows: T[], dealOf: (row: T) => any,
                               now: Date = new Date()): T[] {
  return [...(rows || [])].sort((a, b) => {
    const da = daysWaiting(dealOf(a), now)
    const db = daysWaiting(dealOf(b), now)
    if (da === null && db === null) return 0
    if (da === null) return 1
    if (db === null) return -1
    return db - da
  })
}
