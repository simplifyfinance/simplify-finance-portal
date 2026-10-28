import { documentsFor, documentsDue, formallyApproved } from '@/lib/document-rules'
import { rowsFor, toRequest, progressOf, type DocProgress, type DocRow } from '@/lib/document-progress'

// WHAT THIS DEAL STILL HAS TO ASK THE CLIENT FOR.
//
// 6 Oct 2026. This was four lines inside components/DocumentsBox.tsx, which was
// fine while the box was the only thing that wanted to know. The prompt band at
// the top of the deal wants the same number, and a second copy of four lines is
// how two parts of one screen end up disagreeing about how many documents are
// outstanding.
//
// It reads the deal and nothing else - no database, no network - so anything
// holding a deal can ask.

/** Everything on the list, in whatever state it is in. */
export function allRowsOf(deal: any, progress: DocProgress): DocRow[] {
  const { items } = documentsFor(deal)
  return rowsFor(items, progress, { formallyApproved: formallyApproved(deal) })
}

/** The keys that are wanted at this point of the deal rather than later. */
export function dueNowKeys(deal: any): string[] {
  return documentsDue(deal, 'proceed').items.map(i => i.key)
}

/** The list as it is drawn today: what is due now, plus anything added by hand. */
export function nowRowsOf(deal: any, progress: DocProgress): DocRow[] {
  const due = dueNowKeys(deal)
  return allRowsOf(deal, progress).filter(r => due.includes(r.key) || r.addedByHand)
}

/** And the rest, which the box keeps behind "later". */
export function laterRowsOf(deal: any, progress: DocProgress): DocRow[] {
  const due = dueNowKeys(deal)
  return allRowsOf(deal, progress).filter(r => !due.includes(r.key) && !r.addedByHand)
}

/**
 * HOW LONG BEFORE A WAIT IS WORTH SHOUTING ABOUT.
 *
 * Fabio, 28 Oct 2026: "still waiting after 14 days. Yeah, should be shouting
 * after that."
 *
 * It shouts INSIDE THE BUILDING ONLY - red on the row, and a harder line in the
 * compliance email. The client's wording never sharpens on a timer: an email
 * that gets firmer on its own, with nobody reading it first, will eventually
 * get firm at somebody who has a very good reason.
 */
export const SHOUT_AFTER_DAYS = 14

/** Whole days since it was asked for. Null where it never was. */
export function daysWaiting(row: DocRow, today = new Date()): number | null {
  const asked = String(row?.requestedAt || '').trim()
  if (!asked) return null
  const then = new Date(asked)
  if (Number.isNaN(then.getTime())) return null
  const ms = today.getTime() - then.getTime()
  return ms < 0 ? 0 : Math.floor(ms / 86_400_000)
}

export function isLate(row: DocRow, today = new Date()): boolean {
  const d = daysWaiting(row, today)
  return d !== null && d >= SHOUT_AFTER_DAYS
}

/**
 * ASKED FOR, AND STILL NOT HERE.
 *
 * THE QUESTION THE WHOLE FEATURE EXISTS TO ANSWER, and the one this file could
 * not answer until 28 Oct 2026. Note what it is NOT: outstandingOf below is
 * "ticked but nobody has asked yet", which is a question about US. This is a
 * question about the CLIENT, and it is the list that goes in their email.
 *
 * A row that was never requested is not in here. Nobody can be chased for a
 * document they were never asked for, and putting one in a client's email is
 * how a client learns the list is not to be trusted.
 */
export function stillOut(rows: DocRow[]): DocRow[] {
  return (rows || []).filter(r => r.ticked && r.requestedAt && !r.receivedAt)
}

/** The same, from a deal. The list that reaches every email. */
export function stillOutFromDeal(deal: any): DocRow[] {
  return stillOut(allRowsOf(deal, progressOf(deal)))
}

/** What has come back. The other half, for the count on the box. */
export function cameIn(rows: DocRow[]): DocRow[] {
  return (rows || []).filter(r => r.ticked && r.receivedAt)
}

/** The ones nobody has asked for yet. */
export function outstandingOf(deal: any, progress: DocProgress): DocRow[] {
  return toRequest(nowRowsOf(deal, progress))
}

/** The same question from a deal alone, for anything that holds no progress of
 *  its own. The statements cover is NOT applied here - it is fetched only when
 *  somebody opens the box, so this is the same number the closed box shows. */
export function outstandingFromDeal(deal: any): DocRow[] {
  return outstandingOf(deal, progressOf(deal))
}
