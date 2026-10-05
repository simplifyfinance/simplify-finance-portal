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
