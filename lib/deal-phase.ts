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
// A NEW DEAL STARTS AT FACT FIND.
//
// The first milestone used to be "fact_find_data exists and is not empty", and
// the new-deal form seeds fact_find_data with the applicants from the modal -
// blank addresses, blank employment, blank income, all of it. So every deal was
// born in the BC column and opened on the BC tab, before anybody had typed a
// thing. Fabio, 2 Sep 2026: "when deal is created it sits on BC workflow on
// board view and it should strat at fact find and open at fact find".
//
// Past the fact find means somebody has done fact-find WORK. Only values a
// person has to type count - never the presence of a row, because the form seeds
// an empty address, an empty job and an empty income the moment the tab is
// opened. Starting the BC counts too: if there are BC figures, the fact find is
// behind us however thin it looks.
export function pastFactFind(deal: any): boolean {
  if (deal?.bc_data && Object.keys(deal.bc_data).length > 0) return true
  const ff = deal?.fact_find_data
  if (!ff) return false
  const has = (v: any) => String(v ?? '').trim() !== ''
  if ((ff.assets || []).length > 0) return true
  if ((ff.properties || []).length > 0) return true
  if ((ff.liabilities || []).length > 0) return true
  return (ff.applicants || []).some((a: any) =>
    has(a?.dob)
    || (a?.addresses || []).some((x: any) => has(x?.address))
    || (a?.employment || []).some((e: any) => has(e?.employerName) || has(e?.occupation))
    || (a?.income || []).some((i: any) => has(i?.grossSalary) || has(i?.seBusinessName)))
}

const MILESTONES: { phase: Phase; done: (d: any) => boolean; at: (d: any) => string | null }[] = [
  { phase: 'bc',              done: d => pastFactFind(d),
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

// What the deal's own record says has happened to it.
export function derivedPhaseOf(deal: any): Phase {
  if (!deal) return 'fact_find'
  // A dead deal is dead wherever it got to. Nothing else about it matters.
  if (deal.status === 'lost') return 'lost'

  let last = -1
  MILESTONES.forEach((m, i) => { if (m.done(deal)) last = i })
  return last === -1 ? 'fact_find' : MILESTONES[last].phase
}

// PUTTING A DEAL BACK IN FACT FIND BY HAND.
//
// Every other backwards move on the board clears a timestamp - the pre-approval
// date, the lodgement date - because that timestamp is the only reason the deal
// had moved on. Fact Find is the exception: a deal leaves it because somebody
// typed into the fact find, and no card dropped on a board should delete a
// client's answers.
//
// So this one is an override. Fabio, 3 Sep 2026: "if I wanna drag a deal card
// from BC back to fact find, I need it to happen. Just make it happen."
//
// The danger with an override is a column that stops meaning anything, which is
// exactly what `deals.stage` used to be - a stale string written from six places
// that the board eventually had to stop reading. Three rules keep this one
// honest:
//
//   1. It can only ever move a deal BACKWARDS. It cannot claim progress.
//   2. It is recorded against the phase the deal was in when it was set. The
//      moment the deal genuinely moves on, the override no longer matches and is
//      ignored - so it expires by itself rather than hiding a deal forever.
//   3. The card says it was placed by hand, so nobody reads the column as fact.
export function overrideApplies(deal: any): boolean {
  const to = deal?.phase_override
  if (!to || !PHASE_ORDER.includes(to)) return false
  const derived = derivedPhaseOf(deal)
  // Stale: the deal has moved since somebody placed it.
  if (deal?.phase_override_from !== derived) return false
  // Backwards only.
  return PHASE_ORDER.indexOf(to) < PHASE_ORDER.indexOf(derived)
}

export function phaseOf(deal: any): Phase {
  return overrideApplies(deal) ? (deal.phase_override as Phase) : derivedPhaseOf(deal)
}

// For the card: this is where a person put it, not where the record says it is.
export function placedByHand(deal: any): boolean {
  return overrideApplies(deal)
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


// MOVING A DEAL BACKWARDS ON THE BOARD.
//
// The board refused it outright - "a deal does not go backwards" - which is a
// fine principle and a bad rule, because deals do get recorded wrongly and the
// only way out was to hunt for the panel that set the date. Fabio, 2 Sep 2026:
// "on board view we cant move the deal backwards we should be able to".
//
// A phase is not a column somebody dragged a card into; it is derived from these
// timestamps. So moving back is not a move at all - it is clearing what was
// recorded. That has to be said out loud before it happens, which is why this
// returns the field names rather than just doing it.
export const PHASE_FIELDS: Partial<Record<Phase, string[]>> = {
  lo:                 ['client_proceeded', 'proceeded_at'],
  compliance:         ['lo_client_proceeded', 'lo_proceeded_at'],
  compliance_sent:    ['compliance_sent_at'],
  lodged:             ['lodged_at'],
  preapproved:        ['preapproval_at'],
  offer_accepted:     ['offer_accepted_at'],
  formal:             ['formal_approval_at'],
  contracts_returned: ['contracts_returned_at'],
  settlement_booked:  ['settlement_booked_at'],
  settled:            ['settled_at'],
}

// What the deal will stop saying, in the words somebody would use out loud.
export const PHASE_UNDO_LABEL: Partial<Record<Phase, string>> = {
  lo:                 'The client agreed to proceed after the BC',
  compliance:         'The client agreed to proceed after the lending options',
  compliance_sent:    'Compliance was sent to the credit team',
  lodged:             'The loan was lodged',
  preapproved:        'The loan was pre-approved',
  offer_accepted:     'The offer was accepted',
  formal:             'The loan was formally approved',
  contracts_returned: 'The loan documents came back',
  settlement_booked:  'Settlement was booked',
  settled:            'The loan settled',
}

// The two that do more than move a card. Said before it happens, not after.
export const PHASE_UNDO_WARNING: Partial<Record<Phase, string>> = {
  compliance_sent: 'The deal can then be pushed to SalesTrekker again, which emails the credit team a second time with both PDFs attached.',
  settled: 'This loan stops counting as settled, so it drops out of the commission and trail figures until settlement is recorded again.',
}

export type MoveBack =
  // `place: true` means nothing is cleared - the deal is put in that column by
  // hand and the override does the rest.
  | { ok: true; clearing: Phase[]; fields: string[]; place?: boolean }
  | { ok: false; because: string }

export function moveBack(from: Phase, to: Phase): MoveBack {
  const fi = PHASE_ORDER.indexOf(from), ti = PHASE_ORDER.indexOf(to)
  if (ti < 0 || fi < 0 || ti >= fi) return { ok: false, because: 'That is not a move backwards.' }
  // Fact Find clears nothing - there is no date that put the deal past it, only
  // the client's answers. It is placed by hand instead. See overrideApplies.
  if (to === 'fact_find') {
    return { ok: true, clearing: [], fields: [], place: true }
  }
  const clearing = PHASE_ORDER.slice(ti + 1, fi + 1).filter(p => PHASE_FIELDS[p])
  const fields = clearing.flatMap(p => PHASE_FIELDS[p] || [])
  if (fields.length === 0) {
    return { ok: false, because: 'There is nothing recorded between those two stages to undo.' }
  }
  return { ok: true, clearing, fields }
}
