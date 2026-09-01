// Which column a deal is in. One answer, asked by every screen.
//
// Before this there were two lifecycles bolted together and they disagreed.
// Pre-compliance screens read `deals.stage`, a column only ever advanced when a
// client clicks proceed, so it was stale on any deal where the client rang
// instead. Post-compliance screens read timestamps. And pushing to SalesTrekker
// set status='completed', which the deals list hides — so on 1 Sep 2026 nine of
// twenty-one deals were sitting in a state the portal called finished and
// refused to show, none of them lodged, the oldest eight business days old, with
// no way to tell a loan progressing nicely from one that had fallen over.
//
// docs/settlements.md named this as the thing that had to exist before a board
// could: "Needs ONE canonical 'which column is this deal in' function first."
// This is it. Nothing here reads `deals.stage`.

export type Phase =
  | 'fact_find' | 'bc' | 'lo' | 'compliance' | 'compliance_sent'
  | 'lodged' | 'preapproved' | 'formal' | 'settled' | 'lost'

// In order, and named for what HAS happened — not for what is being waited on.
// A column called "Compliance sent" must contain deals that were sent, which
// sounds obvious and was wrong in the first draft of this file: the ladder was
// written as "waiting for X" and the later columns are named "reached X". A test
// caught it. Naming a column for a thing that has not happened is exactly how
// `deals.stage` came to mean nothing.
//
// A deal sits in the phase of the FURTHEST milestone it has reached, so a step
// skipped in real life — a BC done outside the portal, a loan that never had a
// preapproval — is history, not something holding the deal back.
const MILESTONES: { phase: Phase; done: (d: any) => boolean; at: (d: any) => string | null }[] = [
  { phase: 'bc',              done: d => !!d?.fact_find_data && Object.keys(d.fact_find_data).length > 0,
                              at:   d => d?.created_at || null },
  { phase: 'lo',              done: d => !!d?.client_proceeded,
                              at:   d => d?.proceeded_at || d?.bc_completed_at || null },
  { phase: 'compliance',      done: d => !!d?.lo_client_proceeded,
                              at:   d => d?.lo_proceeded_at || d?.lo_completed_at || null },
  // Sent to SalesTrekker. NOT an ending: the loan still has to be lodged,
  // approved and settled, and somebody has to be chased about each one. Finishing
  // compliance is not enough to get here - it has to have actually gone out.
  { phase: 'compliance_sent', done: d => !!d?.compliance_sent_at,
                              at:   d => d?.compliance_sent_at || null },
  { phase: 'lodged',          done: d => !!d?.lodged_at,
                              at:   d => d?.lodged_at || null },
  // A column, not a tick. Fabio, 1 Sep 2026: "we need to see those deals at all
  // times so we can either chase all clients, do marketing campaign etc" - a
  // preapproved client still house hunting is a live opportunity, not a milestone
  // already passed. Plenty of deals skip it; the ones that do not are the point.
  { phase: 'preapproved',     done: d => !!d?.preapproval_at,
                              at:   d => d?.preapproval_at || null },
  { phase: 'formal',          done: d => !!d?.formal_approval_at,
                              at:   d => d?.formal_approval_at || null },
  { phase: 'settled',         done: d => !!d?.settled_at,
                              at:   d => d?.settled_at || null },
]

export const PHASE_ORDER: Phase[] = [
  'fact_find', 'bc', 'lo', 'compliance', 'compliance_sent',
  'lodged', 'preapproved', 'formal', 'settled', 'lost',
]

export const PHASE_LABEL: Record<Phase, string> = {
  fact_find: 'Fact Find',
  bc: 'BC',
  lo: 'Lending options',
  compliance: 'Compliance',
  compliance_sent: 'Compliance sent',
  lodged: 'Lodged',
  preapproved: 'Preapproved',
  formal: 'Formal approval',
  settled: 'Settled',
  lost: 'Lost',
}

export function phaseOf(deal: any): Phase {
  if (!deal) return 'fact_find'
  // A dead deal is dead wherever it got to. Nothing else about it matters.
  if (deal.status === 'lost') return 'lost'

  let last = -1
  MILESTONES.forEach((m, i) => { if (m.done(deal)) last = i })
  return last === -1 ? 'fact_find' : MILESTONES[last].phase
}

// A deal that is finished with the portal. Deliberately only two things - the
// money landed, or it died. `status = 'completed'` used to be set the moment
// compliance was emailed out, which is what made half the book invisible.
export function isFinished(deal: any): boolean {
  const p = phaseOf(deal)
  return p === 'settled' || p === 'lost'
}

// Everything after compliance has gone out and before the money lands. These are
// live loans with real work left on them; they were the ones being hidden.
export function isInApplication(deal: any): boolean {
  const p = phaseOf(deal)
  return p === 'compliance_sent' || p === 'lodged' || p === 'preapproved' || p === 'formal'
}

// The tab the deal page opens on. The board and the list use the phase; the deal
// page only has five tabs, so anything past compliance opens on Compliance.
export function tabForPhase(p: Phase): string {
  if (p === 'fact_find') return 'FactFind'
  if (p === 'bc') return 'BC'
  if (p === 'lo') return 'LO'
  return 'Compliance'
}

// The loan value to show on the card, and to total up per column. Whatever is
// most true right now: what settled beats what was lodged beats what was asked
// for. A column adding these up is the honest "how much is sitting here".
export function amountOf(deal: any): number | null {
  const n = (v: any) => {
    if (v === null || v === undefined || v === '') return null
    const x = Number(String(v).replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(x) ? x : null
  }
  return n(deal?.settled_total) ?? n(deal?.lodged_total) ?? n(deal?.loan_amount) ?? null
}

// When the deal entered the phase it is in — the milestone that put it there.
// Ageing runs from this, not from when the deal was created.
export function phaseSince(deal: any): string | null {
  if (!deal) return null
  if (deal.status === 'lost') return deal.closed_at || null
  let last = -1
  MILESTONES.forEach((m, i) => { if (m.done(deal)) last = i })
  return last === -1 ? (deal.created_at || null) : MILESTONES[last].at(deal)
}
