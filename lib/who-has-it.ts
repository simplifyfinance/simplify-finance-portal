// WHO IS HOLDING THIS DEAL UP RIGHT NOW.
//
// 22 Oct 2026. Fabio: "sometimes things sit on waiting on Melissa to do a
// compliance, but it's actually we're waiting on clients to send documents."
//
// The chip beside it answers a different question. getWaitingOnLabel() walks a
// ladder of eight steps, finds the last thing that happened and names the next
// thing that has not - which tells you WHAT IS NEXT. On compliance there is
// exactly one thing it can say, "Waiting on Melissa to complete Compliance",
// and it says it whether Melissa is typing or sitting waiting on payslips.
//
// So a deal that sat with a client for a fortnight is indistinguishable from an
// assessor who was slow, and every workload number built on top of that
// inherits the lie.
//
// THREE ANSWERS, AND NOT ONE MORE. Us, the client, the lender. Fabio picked
// these and then cut the wording down: "just say with us, with client kind of
// thing. So not the ball anymore."
//
// NOTHING NEW IS RECORDED YET, DELIBERATELY. This reads the same timestamps the
// ladder already reads, so it can go out with no migration and no change to
// what anybody presses - the team can tell us whether the words are right
// before we spend a schema change on measuring it. The per-change timestamps
// that make the reports possible are the next ship, not this one.

import { waitingIndex } from './deal-status'
import { requestRounds, progressOf } from './document-progress'

export type Holder = 'us' | 'client' | 'lender'

export type WhoHasIt = {
  holder: Holder
  /** Two words. What goes on the chip. */
  label: string
  /** The portal's own tokens. Blue is work in hand, purple is the client -
   *  both already mean that elsewhere, so nobody learns a new colour. The
   *  lender is plain grey: a wait that is neither ours nor theirs, and not
   *  worth inventing a hue the palette does not have. */
  style: string
  /** Set only where the wait has a name - "documents". For the chip to say so. */
  why?: string
}

const CHIP: Record<Holder, { label: string; style: string }> = {
  us:     { label: 'With us',     style: 'bg-info-bg text-info border border-info-edge' },
  client: { label: 'With client', style: 'bg-waiting-bg text-waiting border border-waiting-edge' },
  lender: { label: 'With lender', style: 'bg-line-soft text-muted border border-line' },
}

// WAITING ON DOCUMENTS IS WAITING ON THE CLIENT.
//
// 27 Oct 2026. Catherine, Operations Manager, item 1 of nine: "Show where a
// deal is actually sitting. For example, a deal can be with doc collection
// while the pipeline says it's with Credit."
//
// She is exactly right, and the ladder cannot see it. Once a client has agreed
// to the BC, the next unticked step is the lending options, so the ladder says
// credit. In the office the deal is sitting still because nobody has sent
// their payslips.
//
// The portal already knows. Documents were asked for - progressOf() carries
// the rounds - and "Docs received" has not been pressed. Those two facts
// together are the whole answer, and neither of them is new.
//
// IT IS NOT A FOURTH ANSWER. Fabio cut this to three words in October: "just
// say with us, with client kind of thing." So it stays With client, and says
// what for.
export function waitingOnDocuments(deal: any): boolean {
  if (!deal) return false
  if (deal.docs_received_at) return false
  return requestRounds(progressOf(deal)).length > 0
}

// THE LADDER, READ ONCE, MAPPED ONTO THREE ANSWERS.
//
// Steps 3 and 6 are the client answering the BC and the LO. Everything before
// the end is somebody here. Past the last step the deal is written and lodged,
// and what it is waiting on is the bank.
export function whoHasIt(deal: any): WhoHasIt | null {
  if (!deal) return null
  if (deal.status === 'completed' || deal.status === 'lost') return null

  const i = waitingIndex(deal)
  const holder: Holder = i === -1 ? 'lender' : (i === 3 || i === 6) ? 'client' : 'us'

  // A deal already waiting on the client stays as it is - it is one wait, and
  // naming it twice says nothing. This only overrides a deal the ladder thinks
  // is ours while the office is plainly waiting on somebody else.
  if (holder === 'us' && waitingOnDocuments(deal)) {
    return { holder: 'client', ...CHIP.client, why: 'documents' }
  }
  return { holder, ...CHIP[holder] }
}

/** "With client — documents", or just the two words. */
export function holderLabel(w: WhoHasIt | null): string {
  if (!w) return ''
  return w.why ? `${w.label} \u2014 ${w.why}` : w.label
}
