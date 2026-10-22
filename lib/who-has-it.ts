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
}

const CHIP: Record<Holder, { label: string; style: string }> = {
  us:     { label: 'With us',     style: 'bg-info-bg text-info border border-info-edge' },
  client: { label: 'With client', style: 'bg-waiting-bg text-waiting border border-waiting-edge' },
  lender: { label: 'With lender', style: 'bg-line-soft text-muted border border-line' },
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
  return { holder, ...CHIP[holder] }
}
