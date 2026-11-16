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
  /** One colour per stage, whatever the sub-column - Fabio, 18 Nov. */
  tone: 'lead' | 'bc' | 'lo' | 'compliance' | 'lodged'
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
  // them. Fabio asked for the split on the WRITTEN half: "BC with credit... BC
  // with client... the same is with lending options... compliance with credit,
  // or compliance with client. And then the lodged and everything."
  //
  // Once a deal is with a bank there is one wait and splitting it says nothing.
  // So these stay exactly as they are, one column each, sub-tabs and all.
  { title: 'Lodged', tone: 'lodged', lanes: [{ key: 'lodged', label: 'Lodged' }] },
  { title: 'Preapproved', tone: 'lodged', lanes: [{ key: 'preapproved', label: 'Preapproved' }] },
  { title: 'Offer accepted', tone: 'lodged', lanes: [{ key: 'offer_accepted', label: 'Offer accepted' }] },
  { title: 'Formal', tone: 'lodged', lanes: [{ key: 'formal', label: 'Formal' }] },
  { title: 'Contracts returned', tone: 'lodged', lanes: [{ key: 'contracts_returned', label: 'Contracts returned' }] },
  { title: 'Settlement booked', tone: 'lodged', lanes: [{ key: 'settlement_booked', label: 'Settlement booked' }] },
]

export const LANE_KEYS: string[] = GROUPS.flatMap(g => g.lanes.map(l => l.key))

/**
 * WHICH COLUMN A DEAL IS IN, OR NOWHERE.
 *
 * Null is a real answer: settled, lost, and everything past lodgement belongs
 * to the settlements screen, which is its own board with its own seven steps.
 * A deal in two places is a deal somebody works twice.
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

  if (p === 'settled' || p === 'lost') return null

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
