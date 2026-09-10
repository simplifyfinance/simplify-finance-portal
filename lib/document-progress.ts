// WHAT A PERSON DECIDED ABOUT THE DOCUMENT LIST.
//
// The list itself is worked out fresh from the fact find every time - see
// document-rules.ts, which stores nothing. This is the other half: the small
// number of things a human decided that the fact find cannot know.
//
// Three kinds of decision, and nothing else:
//   - a row the fact find ticked that somebody untucked, or the reverse
//   - a document somebody added that no rule would ever produce
//   - which of the added ones they later removed
//
// Saved as one jsonb column on the deal, keyed by the item's stable key, the
// same shape handover_progress uses. A key that no longer appears in the list is
// simply ignored, so deleting a liability can never break the page - it just
// takes its row with it.

import type { DocItem, DocFor } from './document-rules'

export type Decision = { ticked: boolean; at: string; by: string }

export type AddedDoc = {
  key: string
  label: string
  detail?: string
  forWhat: DocFor
  at: string
  by: string
}

// One press of the request button. Append-only: a deal that had two rounds of
// requests keeps both, because "what did we ask this client for, and when" is a
// question somebody will ask in three months.
export type RequestRound = { at: string; by: string; keys: string[] }

export type DocProgress = {
  decisions?: Record<string, Decision>
  added?: AddedDoc[]
  requests?: RequestRound[]
  // Rows somebody chose not to ask for YET, which come back on their own later.
  // Only the discharge uses this today. Keyed the same way as everything else.
  deferred?: Record<string, { at: string; by: string }>
}

// A row as the screen renders it: the rule's version, plus whether it is
// actually ticked and whether a person is the reason.
export type DocRow = DocItem & {
  ticked: boolean
  decidedBy?: string
  addedByHand?: boolean
  // When it was asked for, if it has been. A requested row is no longer a
  // decision to make; it is a thing being waited on.
  requestedAt?: string
}

const now = () => new Date().toISOString()

// Added rows carry a key of their own so a decision about one files the same way
// as a decision about a derived row. Time-based, because two people adding
// "accountant's letter" at once should get two rows, not one that overwrites.
export function addedKey(): string {
  return `added:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function progressOf(deal: any): DocProgress {
  const p = deal?.document_progress
  return (p && typeof p === 'object') ? p as DocProgress : {}
}

// THE ONE RULE THAT MATTERS HERE: a person's decision always beats the rule.
// If somebody unticked the bonus payslip, it stays unticked even though the fact
// find still says a bonus was recorded - they know something the fact find does
// not. And it stays unticked through every later change to the fact find,
// because the decision was about the document, not about the data.
export function rowsFor(items: DocItem[], progress: DocProgress, opts: RowOpts = {}): DocRow[] {
  const decisions = progress?.decisions || {}
  const asked = requestedAtByKey(progress)

  const derived: DocRow[] = items
    // A deferred row is out of sight until the moment it was deferred TO. The
    // discharge somebody said "not yet" to comes back the day the loan is
    // formally approved, without anybody remembering to look for it.
    .filter(item => !progress?.deferred?.[item.key] || !!opts.formallyApproved)
    .map(item => {
      const d = decisions[item.key]
      const wasDeferred = !!progress?.deferred?.[item.key]
      const base = d
        ? { ...item, ticked: d.ticked, decidedBy: d.by }
        : { ...item, ticked: wasDeferred ? true : item.auto }
      if (wasDeferred) {
        return { ...base, askFirst: false, ticked: d ? d.ticked : true,
          why: 'Put off earlier — the loan is now formally approved', requestedAt: asked[item.key] }
      }
      return { ...base, requestedAt: asked[item.key] }
    })

  const added: DocRow[] = (progress?.added || []).map(a => {
    const d = decisions[a.key]
    return {
      key: a.key,
      label: a.label,
      detail: a.detail,
      group: 'deal' as const,
      groupKey: 'deal',
      groupLabel: 'This deal',
      forWhat: a.forWhat,
      round: 'proceed' as const,
      auto: true,
      why: `Added by ${a.by}`,
      ticked: d ? d.ticked : true,
      decidedBy: d?.by,
      addedByHand: true,
      requestedAt: asked[a.key],
    }
  })

  return [...derived, ...added]
}

export type RowOpts = { formallyApproved?: boolean }

export function tickedCount(rows: DocRow[]): number {
  return rows.filter(r => r.ticked).length
}

// WHAT THE BUTTON WOULD ACTUALLY SEND.
//
// Ticked, and not already asked for. Without the second half, pressing request
// twice asks the client a second time for the payslips they have already sent -
// which is the thing this whole feature exists to stop.
export function toRequest(rows: DocRow[]): DocRow[] {
  return rows.filter(r => r.ticked && !r.requestedAt && !r.askFirst)
}

function requestedAtByKey(progress: DocProgress): Record<string, string> {
  const out: Record<string, string> = {}
  for (const round of progress?.requests || []) {
    for (const k of round.keys || []) if (!out[k]) out[k] = round.at
  }
  return out
}

export function requestRounds(progress: DocProgress): RequestRound[] {
  return progress?.requests || []
}

// --- writing ---------------------------------------------------------------
//
// Every one of these returns a NEW progress object rather than changing the one
// it was given, so a failed save can be rolled back by throwing away the result.

export function withTick(progress: DocProgress, key: string, ticked: boolean, by: string): DocProgress {
  return {
    ...progress,
    decisions: { ...(progress.decisions || {}), [key]: { ticked, at: now(), by } },
  }
}

export function withAdded(progress: DocProgress, label: string, forWhat: DocFor, by: string, detail?: string): DocProgress {
  const clean = String(label ?? '').trim()
  if (!clean) return progress
  const doc: AddedDoc = { key: addedKey(), label: clean, forWhat, at: now(), by }
  if (detail && detail.trim()) doc.detail = detail.trim()
  return { ...progress, added: [...(progress.added || []), doc] }
}

// A round of requests, recorded. Append-only - see RequestRound.
export function withRequest(progress: DocProgress, keys: string[], by: string, at?: string): DocProgress {
  const clean = [...new Set(keys.filter(Boolean))]
  if (clean.length === 0) return progress
  return {
    ...progress,
    requests: [...(progress.requests || []), { at: at || now(), by, keys: clean }],
  }
}

// "Not yet." The row disappears and comes back at formal approval, ticked.
// Fabio, 3 Sep 2026: "if it's no, please make sure that is part of the formal
// approval process when a loan is formally approved."
export function withDeferred(progress: DocProgress, key: string, by: string): DocProgress {
  const decisions = { ...(progress.decisions || {}) }
  delete decisions[key]
  return {
    ...progress,
    decisions,
    deferred: { ...(progress.deferred || {}), [key]: { at: now(), by } },
  }
}

// Only a row somebody added can be removed - a derived row is a fact about the
// deal, and the way to say no to one is to untick it.
export function withoutAdded(progress: DocProgress, key: string): DocProgress {
  const decisions = { ...(progress.decisions || {}) }
  delete decisions[key]
  return {
    ...progress,
    added: (progress.added || []).filter(a => a.key !== key),
    decisions,
  }
}

// --- the extras somebody can pick from -------------------------------------
//
// Free text alone gives you nine spellings of "accountant's letter", which is
// unreadable in an email and uncountable afterwards. This is the list of
// suggestions; typing something not on it is always allowed.
//
// THE LIST IS NOT CONDITIONAL, AND THAT IS THE POINT.
//
// It used to hold only documents the automatic rules never produce. So anything
// the rules produce CONDITIONALLY could not be added by hand on a deal where the
// condition did not hold: no discharge of mortgage on a purchase, no company
// financials on a PAYG-only file, no SMSF deed on an ordinary one. Twenty-four
// documents the system knows about, none of them offerable.
//
// Fabio, 10 Sep 2026: "The manual Add Document dropdown should NOT be
// conditional. This screenshot is a purchase so Discharge Form shouldn't be
// automatically requested, but I should still be able to manually select it."
//
// So it now carries everything the portal knows about. What the RULES put on the
// list automatically has not changed at all - only what a person can reach for.
// document-progress.test.ts asserts every label document-rules.ts can produce
// appears here, so a new rule cannot quietly go missing from this list again.
const EXTRAS: { label: string; forWhat: DocFor; detail?: string }[] = [
  // Not produced by any rule - one-offs an assessor asks for.
  { label: "Accountant's letter", forWhat: 'lodge' },
  { label: 'Bank statements — older period', forWhat: 'compliance', detail: 'say which months' },
  { label: 'Letter of employment', forWhat: 'lodge' },
  { label: 'Contract of employment', forWhat: 'lodge' },
  { label: 'Statement of position', forWhat: 'lodge' },
  { label: 'Trust deed', forWhat: 'lodge', detail: 'signed and certified' },
  { label: 'Separation or divorce papers', forWhat: 'compliance' },
  { label: 'Child support assessment', forWhat: 'compliance' },
  { label: 'Visa grant notice', forWhat: 'lodge' },
  { label: 'Sale contract — property being sold', forWhat: 'lodge' },

  // Per applicant.
  { label: 'ID — licence, Medicare, passport', forWhat: 'lodge' },
  { label: 'Salary credit account', forWhat: 'lodge', detail: 'the account the salary is paid into' },
  { label: 'Superannuation statement', forWhat: 'lodge', detail: 'most recent' },
  { label: 'Payslips × 2', forWhat: 'lodge' },
  { label: 'Income statement', forWhat: 'lodge', detail: 'full financial year' },
  { label: 'Bonus payslip', forWhat: 'lodge' },
  { label: 'Personal tax returns × 2', forWhat: 'lodge', detail: 'most recent two' },
  { label: 'Notices of assessment × 2', forWhat: 'lodge' },
  { label: 'Company tax returns × 2', forWhat: 'lodge' },
  { label: 'Company financials × 2', forWhat: 'lodge', detail: 'accountant prepared' },
  { label: 'BAS × 3', forWhat: 'lodge' },
  { label: 'HECS balance', forWhat: 'lodge' },
  { label: 'Living at home rent free letter', forWhat: 'compliance' },
  { label: 'Tenancy agreement', forWhat: 'compliance' },

  // Per property.
  { label: 'Council rates notice', forWhat: 'compliance' },
  { label: 'Rental statement', forWhat: 'lodge' },

  // The deal.
  { label: 'Discharge of mortgage', forWhat: 'compliance' },
  { label: 'Gift letter', forWhat: 'lodge', detail: 'our template' },
  { label: 'Updated contract of sale', forWhat: 'lodge' },
  { label: 'Insurance — certificate of currency', forWhat: 'lodge' },
  { label: 'SMSF trust deed', forWhat: 'lodge', detail: 'signed and certified' },
  { label: 'SMSF tax returns × 2', forWhat: 'lodge' },
  { label: 'Bare trust deed', forWhat: 'lodge', detail: 'signed and certified' },
  { label: 'Expenses account', forWhat: 'compliance' },

  // Statements. The rules append the bank to each of these when there is one -
  // "Credit card statement — ANZ" - and they only appear when that liability or
  // loan is on the fact find. The plain label is offered here so one can be
  // asked for on a deal where nothing matching is recorded.
  { label: 'Credit card statement', forWhat: 'compliance', detail: 'last 3 months' },
  { label: 'Car loan statement', forWhat: 'compliance', detail: 'last 6 months' },
  { label: 'Personal loan statement', forWhat: 'compliance', detail: 'last 6 months' },
  { label: 'Home loan statement', forWhat: 'lodge', detail: 'last 6 months' },
]

// ALPHABETICAL, because a list of thirty-four is scanned, not read.
//
// Sorted here rather than by hand, so adding one is a single line in whatever
// group it belongs to and the order looks after itself. The input it feeds is a
// datalist, so typing filters it as you go. Fabio, 10 Sep 2026: "alphabetical
// and ability to type and search."
export const COMMON_EXTRAS: { label: string; forWhat: DocFor; detail?: string }[] =
  [...EXTRAS].sort((a, b) => a.label.localeCompare(b.label, 'en'))

// WHAT IS LEFT TO OFFER, given what is already on the list.
//
// COMMON_EXTRAS carries everything the portal knows about so that anything can be
// added by hand on a deal where the rules did not ask for it. On a deal where
// they DID ask for it, offering it again is an invitation to a double-up.
// Fabio, 10 Sep 2026: "why would payslips be there if I am already requesting -
// eliminate double ups."
//
// Statements carry the bank on the end - "Credit card statement — ANZ" - so the
// plain label is matched as a prefix as well, or a deal with a credit card would
// still be offered a second credit card statement.
export function extrasNotAlreadyListed(existingLabels: string[]) {
  const here = (existingLabels || []).map(l => String(l ?? '').trim().toLowerCase())
  return COMMON_EXTRAS.filter(e => {
    const label = e.label.trim().toLowerCase()
    return !here.some(h => h === label || h.startsWith(`${label} — `))
  })
}
