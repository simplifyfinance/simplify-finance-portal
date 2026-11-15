// WHAT HAS TO HAPPEN AT EACH STEP, AND WHAT YOU ARE LEAVING BEHIND.
//
// 17 Nov 2026, from Fabio's spec and confirmed twice over:
//
//   JULIAN KOK: "Checklist items are for every deal."
//   BELLE:      "Yes those checklist are applicable for every deal."
//
// So nothing here is lender-specific or deal-type specific, with one exception
// that was in the spec from the start: the reminder to scan copies back only
// appears where the documents are not esign, because on an esign deal there is
// nothing to post.
//
// ---------------------------------------------------------------------------
// NOTHING BLOCKS
// ---------------------------------------------------------------------------
//
// Fabio, asked straight whether a missing tick should stop somebody: "No, I
// don't want to block it because it makes it hard, but just put a warning on
// top." So moving on with items unticked tells you what you are leaving behind
// and carries them to the next step. The one refusal in this whole process is
// Settlement Booked with no settlement date - see cannotMoveBecause().
//
// ---------------------------------------------------------------------------
// FOUR OF THESE ARE ALREADY COLUMNS, AND STAY COLUMNS
// ---------------------------------------------------------------------------
//
// review_sent, compliance_finalised, commission_paid and
// funds_to_complete_checked exist on the deal and the settlements board already
// reads them. Putting a second copy in the checklist would be the same fact in
// two places, free to disagree - the mistake this codebase keeps having to undo.
// An item with a `column` reads and writes that column instead.
import { type Step } from './the-seven-steps'

const txt = (v: any) => String(v ?? '').trim()

export type Item = {
  key: string
  what: string
  /** Reads and writes this column on the deal rather than the checklist. */
  column?: string
  /** Ticked by the portal from what it already knows. Nobody presses it. */
  derived?: (deal: any) => boolean
  /** Shown only when this is true of the deal. */
  only?: (deal: any) => boolean
  /** Said on screen, so nobody wonders why a colleague has a box they do not. */
  onlyWhy?: string
  /** Whose job it is, where it is not the settlements team's. */
  whose?: string
}

/** Are the loan documents being signed electronically? */
export function isEsign(deal: any): boolean {
  return /esign|e-sign|electronic|docusign/i.test(txt(deal?.loan_docs_signing))
}

/** Is there a settlement date on this deal at all? */
export function hasSettlementDate(deal: any): boolean {
  return !!(txt(deal?.confirmed_settlement_date) || txt(deal?.expected_settlement_date))
}

export const CHECKLISTS: Record<Step, Item[]> = {
  formal: [
    { key: 'solicitor', what: 'Lender solicitor details recorded',
      derived: d => !!txt(d?.lender_solicitor) || !!txt(d?.lender_solicitor_ref) },
    { key: 'welcome_sent', what: 'Formal welcome sent' },
    { key: 'approval_matches', what: 'Formal approval amount and rate match the handover' },
  ],
  contracts_issued: [
    { key: 'contract_matches', what: 'Contract rate, repayment and amount match the handover' },
    { key: 'contract_dropped', what: 'Loan contracts dropped in' },
    { key: 'called_client', what: 'Called the client about the documents' },
    { key: 'scan_first', what: 'Reminded them to scan copies back to us first',
      only: d => !isEsign(d),
      onlyWhy: 'Only shown because the documents are not esign' },
  ],
  contracts_reviewing: [
    { key: 'insurance_returned', what: 'Building insurance or strata certificate returned' },
    { key: 'docs_checked', what: 'Loan documents checked — valid direct debit nomination and frequency' },
    { key: 'signed_dropped', what: 'Signed documents dropped in' },
    { key: 'offset_confirmed', what: 'Offset, surplus or shortfall account confirmed' },
  ],
  // THE FIELD IS THE WHOLE OF THIS STEP. Fabio's spec: "No checklist. Clear the
  // field and move on."
  outstandings: [],
  pending_booking: [
    { key: 'date_updated', what: 'Estimated settlement date updated' },
    { key: 'numbers_sent', what: 'Settlement numbers sent' },
    { key: 'date_entered', what: 'A settlement date entered', derived: hasSettlementDate },
  ],
  settlement_booked: [
    { key: 'shortfall_ahead', what: 'Contribution shortfall checked ahead of the day' },
    { key: 'shortfall_day', what: 'Shortfall checked again on settlement day' },
    { key: 'funds_checked', what: 'Funds to complete checked', column: 'funds_to_complete_checked' },
  ],
  settled: [
    { key: 'broker_called', what: 'Congratulatory call by the broker', whose: 'the broker' },
    { key: 'review_sent', what: 'Review request sent', column: 'review_sent' },
    { key: 'compliance_finalised', what: 'Compliance finalised', column: 'compliance_finalised' },
    { key: 'commission_paid', what: 'Commission paid', column: 'commission_paid' },
  ],
}

/** The items that apply to this deal at this step. */
export function itemsFor(step: Step, deal: any): Item[] {
  return (CHECKLISTS[step] || []).filter(i => !i.only || i.only(deal))
}

function box(deal: any): Record<string, Record<string, boolean>> {
  const raw = deal?.settlement_checklist
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

/** Is it ticked? Through the column, the portal's own answer, or the box. */
export function ticked(deal: any, step: Step, item: Item): boolean {
  if (item.derived) return !!item.derived(deal)
  if (item.column) return !!deal?.[item.column]
  return !!box(deal)[step]?.[item.key]
}

/**
 * WHAT TICKING ONE SAVES.
 *
 * A derived item cannot be ticked by hand - it is the portal reporting what it
 * already knows, and a box that argues with the deal beside it is worse than no
 * box. Returns null rather than a patch that would do nothing.
 */
export function tickPatch(deal: any, step: Step, item: Item, on: boolean): Record<string, any> | null {
  if (item.derived) return null
  if (item.column) return { [item.column]: on }
  const all = box(deal)
  const mine = { ...(all[step] || {}) }
  if (on) mine[item.key] = true
  else delete mine[item.key]
  return { settlement_checklist: { ...all, [step]: mine } }
}

/** How many of them are done. */
export function doneCount(deal: any, step: Step): { done: number; all: number } {
  const items = itemsFor(step, deal)
  return { done: items.filter(i => ticked(deal, step, i)).length, all: items.length }
}

/**
 * WHAT IS BEING LEFT BEHIND.
 *
 * Shown when somebody moves on with items unticked. It never stops them, and
 * the items stay on the deal, so they are findable from any later step rather
 * than quietly forgotten the moment the card moves.
 */
export function leftBehind(deal: any, step: Step): Item[] {
  return itemsFor(step, deal).filter(i => !ticked(deal, step, i))
}

/** "You are leaving one thing unticked" / "three things". */
export function leavingWords(n: number): string {
  if (n <= 0) return ''
  return n === 1 ? 'You are leaving one thing unticked'
    : `You are leaving ${n} things unticked`
}

/**
 * EVERYTHING STILL UNTICKED, ANYWHERE ON THE FILE.
 *
 * The items follow the deal. A reminder nobody sent at Contracts Issued is
 * still unsent at Settlement Booked, and this is how it stays visible.
 */
export function stillOpen(deal: any, upTo: Step, steps: readonly Step[]): Array<{ step: Step; item: Item }> {
  const out: Array<{ step: Step; item: Item }> = []
  for (const s of steps) {
    if (s === upTo) break
    for (const i of leftBehind(deal, s)) out.push({ step: s, item: i })
  }
  return out
}
