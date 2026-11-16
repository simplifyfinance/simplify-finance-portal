import { phaseOf, type Phase } from './deal-phase'
import { whoHasIt } from './who-has-it'

// THE BOARD IS A VIEW, NOT A PLACE A DEAL IS KEPT.
//
// 18 Nov 2026. Fabio, describing the board he wants: "there will be a BC with
// credit, which is where we're actioning. And then next to it... BC with
// client, where the client is deciding. The same is with lending options...
// compliance with credit, or compliance with client."
//
// And, in the same breath, the fear worth taking seriously: "that little part
// in there is the brain. That's how deals are being structured in this portal.
// So I can't really mess that."
//
// SO NOTHING IS STORED AND NOTHING IS WRITTEN. A column is a pair - the stage
// the deal is at, and who we are waiting on - and both already exist. The stage
// is lib/deal-phase.ts, which the deal card's own tabs read. The holder is
// lib/who-has-it.ts, which already prints "With client" on the card today.
//
// Delete this file and every deal is exactly as it was. That is the whole point
// of it being worked out rather than kept.

export type Lane = {
  /** The column's own id. Only this file invents it. */
  key: string
  /** What the column head says. */
  label: string
}

export type Group = {
  /** The stage, in the words the business uses. */
  title: string
  /** One colour per stage, whatever the sub-column - Fabio, 18 Nov.
   *
   *  'lender' is NOT green. Green is the money landing - it belongs to the
   *  settlement run and to a client who has said yes, and nowhere else. Two
   *  greens side by side said a bank deciding and Julian's team working to a
   *  date were the same kind of thing. Fabio, 18 Nov: "with lender and
   *  settlement dont use the same colour both are green thats an issue". */
  tone: 'lead' | 'bc' | 'lo' | 'compliance' | 'lender' | 'settlement' | 'settled'
  lanes: Lane[]
}

// THE WHOLE BOARD, IN ORDER.
//
// The written half is split by who is holding it. The lodged half is not: once
// it is with a bank there is one wait and splitting it would say nothing.
export const GROUPS: Group[] = [
  { title: 'New lead', tone: 'lead', lanes: [
    { key: 'lead', label: 'Awaiting fact find' },
  ] },
  { title: 'Borrowing capacity', tone: 'bc', lanes: [
    { key: 'bc_us', label: 'With credit' },
    { key: 'bc_client', label: 'With client' },
  ] },
  { title: 'Lending options', tone: 'lo', lanes: [
    { key: 'lo_us', label: 'With credit' },
    { key: 'lo_client', label: 'With client' },
  ] },
  { title: 'Compliance', tone: 'compliance', lanes: [
    { key: 'comp_us', label: 'With credit' },
    { key: 'comp_client', label: 'Sent · signing' },
  ] },
  // THE TRACKED HALF IS NOT SPLIT, AND IT IS NOT COLLAPSED EITHER.
  //
  // 18 Nov 2026. The first version of this file folded everything past
  // lodgement into one lane, which would have taken six working columns off the
  // board - and the three of them that carry the seven settlement steps with
  // them. Fabio, twice, and the second time with feeling: "you dont collapse
  // anything after lodged remeber we just built a whole settlment process the
  // changes are until lodged evrything is the same after that".
  //
  // So every column past lodgement is exactly as it is today, sub-tabs and all.
  // What is new is only the bar above them, which gathers them into the three
  // things they actually are: a bank deciding, a team working to a date, and
  // done.
  { title: 'With the lender', tone: 'lender', lanes: [
    { key: 'lodged', label: 'Lodged' },
    { key: 'preapproved', label: 'Preapproved' },
    { key: 'offer_accepted', label: 'Offer accepted' },
  ] },
  { title: 'To settlement', tone: 'settlement', lanes: [
    { key: 'formal', label: 'Formal approval' },
    { key: 'contracts_returned', label: 'Contracts returned' },
    { key: 'settlement_booked', label: 'Settlement booked' },
  ] },
  // ITS OWN BAR. Fabio chose this over folding it in with the settlement run:
  // the deal is done, and closing one out - the review, the compliance file,
  // the commission - is a different job from getting one to the table.
  { title: 'Settled', tone: 'settled', lanes: [
    { key: 'settled', label: 'Settled' },
  ] },
]

export const LANE_KEYS: string[] = GROUPS.flatMap(g => g.lanes.map(l => l.key))

/**
 * WHICH COLUMN A DEAL IS IN, OR NOWHERE.
 *
 * Null is a real answer, and only for a dead deal. Everything else has a
 * column, including Settled - which keeps its "To close out" sub-tab, because
 * a settled deal still has a review, a compliance file and a commission
 * behind it.
 */
export function laneOf(deal: any): string | null {
  const p: Phase = phaseOf(deal)
  if (p === 'fact_find') return 'lead'

  // PAST LODGEMENT, THE PHASE IS THE COLUMN. One each, as they are today.
  // 'outstanding' has never been a column of its own on this board - it rides
  // with Lodged, which is where the work actually sits.
  if (p === 'outstanding') return 'lodged'
  if (p === 'lodged' || p === 'preapproved' || p === 'offer_accepted'
    || p === 'formal' || p === 'contracts_returned' || p === 'settlement_booked') return p

  // Settled keeps its column, and its "To close out" sub-tab with it. Only a
  // dead deal is on no board at all.
  if (p === 'settled') return 'settled'
  if (p === 'lost') return null

  const w = whoHasIt(deal)
  const theirs = w?.holder === 'client'
  if (p === 'bc') return theirs ? 'bc_client' : 'bc_us'
  if (p === 'lo') return theirs ? 'lo_client' : 'lo_us'
  if (p === 'compliance') return theirs ? 'comp_client' : 'comp_us'
  if (p === 'compliance_sent') return 'comp_client'
  return null
}

/**
 * THE CLIENT SAID YES AND IT IS WAITING ON US.
 *
 * 18 Nov 2026: "when a client wants to proceed, we wanted to mark that deal
 * card green. So we know visually, yep, that's the deal card we want to push to
 * compliance." Green is louder than whoever owns it in credit, because the file
 * has left credit - that is the whole message.
 */
export function readyToPush(deal: any): boolean {
  if (!deal) return false
  // THE CLIENT AGREEING IS WHAT MOVES IT. lo_client_proceeded is the milestone
  // that puts a deal in Compliance - see lib/deal-phase.ts - so a green card is
  // one sitting at the top of Compliance with nothing written on it yet. That
  // is exactly the pile to push, which is what the colour is for.
  if (phaseOf(deal) !== 'compliance') return false
  return !!deal.lo_client_proceeded && !deal.compliance_completed_at
}

/** Newest first, in every column, for everybody. No sort to choose. */
export function newestFirst(deals: any[]): any[] {
  return [...(deals || [])].sort((a, b) => {
    const x = Date.parse(String(a?.created_at || '')) || 0
    const y = Date.parse(String(b?.created_at || '')) || 0
    return y - x
  })
}

/** Every lane, filled, in board order. Empty lanes are still lanes. */
export function sortIntoLanes(deals: any[]): Record<string, any[]> {
  const out: Record<string, any[]> = {}
  for (const k of LANE_KEYS) out[k] = []
  for (const d of deals || []) {
    const k = laneOf(d)
    if (k && out[k]) out[k].push(d)
  }
  for (const k of LANE_KEYS) out[k] = newestFirst(out[k])
  return out
}

// ONE COLOUR PER STAGE, AND THE BAR IS ALWAYS BLACK.
//
// 18 Nov 2026. The colour is a small square on the bar and a small square on
// each column head under it, so a stage reads as one thing however many
// columns it has. Fabio picked the dark bar over a coloured tab and a spine:
// "Number one, dark bar." It matches the black band on Today.
//
// 'lender' is steel on purpose - see the note on `tone` above. Green belongs
// to settlement and to a client who has said yes.
export const TONE_INK: Record<Group['tone'], string> = {
  lead:       '#8E96A3',
  bc:         '#17A398',
  lo:         '#2E7BC4',
  compliance: '#7257C8',
  lender:     '#5B6B84',
  settlement: '#2FA36B',
  settled:    '#938D83',
}
