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
  | 'lodged' | 'preapproved' | 'offer_accepted' | 'formal'
  | 'contracts_returned' | 'settlement_booked' | 'settled' | 'lost'

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
  // Between preapproval and formal approval on a purchase: the client's offer on
  // a property has been accepted, so the deal has a property, a price and a
  // settlement date, and the file goes back to the lender for a full approval.
  // Fabio, 2 Sep 2026: "there's a big process in my team that is what we call
  // offer accepted." It was invisible - those deals sat in Preapproved looking
  // identical to a client still house hunting, which is the opposite situation.
  { phase: 'offer_accepted',  done: d => !!d?.offer_accepted_at,
                              at:   d => d?.offer_accepted_at || null },
  { phase: 'formal',          done: d => !!d?.formal_approval_at,
                              at:   d => d?.formal_approval_at || null },
  // The last two used to be `settlement_step`, a single enum with no date on it,
  // visible only inside the Settlement panel. So a deal whose loan docs came back
  // three weeks ago and a deal formally approved this morning were the same
  // column on the board, and nothing recorded WHEN either step happened. They are
  // stages now, with dates, like everything else on the ladder.
  { phase: 'contracts_returned', done: d => !!d?.contracts_returned_at,
                                 at:   d => d?.contracts_returned_at || null },
  { phase: 'settlement_booked',  done: d => !!d?.settlement_booked_at,
                                 at:   d => d?.settlement_booked_at || null },
  { phase: 'settled',         done: d => !!d?.settled_at,
                              at:   d => d?.settled_at || null },
]

export const PHASE_ORDER: Phase[] = [
  'fact_find', 'bc', 'lo', 'compliance', 'compliance_sent',
  'lodged', 'preapproved', 'offer_accepted', 'formal',
  'contracts_returned', 'settlement_booked', 'settled', 'lost',
]

// The deal in two halves. Everything up to and including compliance is the deal
// being WRITTEN - our work, our pace. From lodgement on it is being TRACKED -
// somebody else's decision, and the job is chasing it.
//
// Fabio, 2 Sep 2026: "deal is broken into 2 stages once a deal is lodged we are
// now tracking". The progress bar folds on this line, because four green ticks
// on a lodged deal tell you nothing you did not already know and were taking
// half the width the seven live stages needed.
export const WRITTEN_PHASES: Phase[] = ['fact_find', 'bc', 'lo', 'compliance', 'compliance_sent']

export const PHASE_LABEL: Record<Phase, string> = {
  fact_find: 'Fact Find',
  bc: 'BC',
  lo: 'Lending options',
  compliance: 'Compliance',
  compliance_sent: 'Compliance sent',
  lodged: 'Lodged',
  preapproved: 'Preapproved',
  offer_accepted: 'Offer accepted',
  formal: 'Formal approval',
  contracts_returned: 'Contracts returned',
  settlement_booked: 'Settlement booked',
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
  if (p === 'fact_find' || p === 'bc' || p === 'lo' || p === 'compliance') return false
  return p !== 'settled' && p !== 'lost'
}

// The tab the deal page opens on. The board and the list use the phase; the deal
// page only has five tabs, so anything past compliance opens on Compliance.
export function tabForPhase(p: Phase): string {
  if (p === 'fact_find') return 'FactFind'
  if (p === 'bc') return 'BC'
  if (p === 'lo') return 'LO'
  return 'Compliance'
}

// The loan value to show on the card, and to total up per column.
//
// Fabio, 1 Sep 2026: nothing before Lending Options. A BC figure is a borrowing
// CAPACITY, not a loan — nobody has applied for it, and on the LVR comparison
// template it is literally two alternatives for the same deal. Showing it as
// money makes the board claim a pipeline that does not exist.
//
// From the LO onwards there is a real figure: a specific lender, specific splits,
// an amount the client was actually shown. That is what gets counted.
//
// `deals.loan_amount` is the column every other screen reads — the pipeline, the
// settlements board, the cheat sheet, the commission panel. It used to be read in
// five places and written in none, which is the whole reason every card said "no
// amount yet". The LO writes it now.
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(x) && x !== 0 ? x : null
}

// Every split added up. Exported because three screens were each adding up
// splits their own way, and two of them stopped at the first one.
export function splitsTotal(splits: any): number | null {
  if (!Array.isArray(splits) || splits.length === 0) return null
  const amounts = splits.map((s: any) => num(s?.amount)).filter((n): n is number => n !== null)
  if (amounts.length === 0) return null
  return Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100
}

export function amountOf(deal: any): number | null {
  return num(deal?.settled_total)
    ?? splitsTotal(deal?.settled_splits)
    ?? num(deal?.lodged_total)
    ?? splitsTotal(deal?.lodged_splits)
    ?? num(deal?.loan_amount)
    ?? num(deal?.lo_data?.loanAmount)
    ?? splitsTotal(deal?.lo_data?.refinanceSplits)
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

// May the Lending options form write the deal's loan_amount?
//
// Only until the loan is lodged. Before that the LO figure is the best number
// anyone has, and writing it is how the board gets an amount at all. After
// lodgement the lodged and settled snapshots are the record of what actually
// happened, and the LO is an out-of-date estimate.
//
// This exists because the LO autosave had no such guard and no dirty flag, so
// simply OPENING the Lending options tab on a settled deal replaced the settled
// figure with the estimate 700ms later - and every screen that reports settled
// volume fell through to it. Fabio, 1 Sep 2026: lodged and settled are the two
// amounts that are kept; everything before them is a working figure that moves.
export function loMayWriteAmount(deal: any): boolean {
  return !deal?.lodged_at && !deal?.settled_at
}

// Is the deal with the lender - lodged or beyond?
//
// The line is LODGEMENT, not compliance sent. Between those two the deal is
// still with support waiting for a SalesTrekker card, and compliance work can
// still be relevant. Once it is lodged it is out of our hands and the Compliance
// tab is a record rather than a workbench: the needs and objectives, the AI
// generation, the PDFs and the push all belong to work that is finished.
//
// Fabio, 1 Sep 2026: "needs an objectives, all those things, summary PDF,
// compliance PDF ... this all belongs to compliance. It should not be showing
// from lodgement forward."
export function isWithLender(deal: any): boolean {
  if (phaseOf(deal) === 'lost') return false
  return PHASE_ORDER.indexOf(phaseOf(deal)) >= PHASE_ORDER.indexOf('lodged')
}
