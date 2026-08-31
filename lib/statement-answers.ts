// The answers to the worklist.
//
// Every item on that list is a question somebody eventually asks the client, and
// before this the answer lived in a phone call and then nowhere. The same query
// got raised twice, or worse, got raised once, answered, and then quietly
// forgotten by the time the file went to a lender.
//
// Fabio, 31 Aug 2026: an answer is a file note for the credit team. **It is never
// passed to the AI and never appears in the LO or the compliance write-up.** If
// the explanation belongs in a regulated document, a person types it there. The
// only job an answer does here is close the chase and stop it being asked twice.

export type Reason = { id: string; label: string; note?: string }

// Per worklist item, in the order they actually come back from clients.
// "Other" is added to every set; it is not listed here.
const REASONS: Record<string, Reason[]> = {
  salary_gap: [
    { id: 'parental_leave',  label: 'Parental leave', note: 'Assess on the run rate, not the period average.' },
    { id: 'changed_employer', label: 'Changed employer' },
    { id: 'other_account',   label: 'Paid to another account', note: 'Get statements for that account before this goes to a lender.' },
    { id: 'between_jobs',    label: 'Between jobs' },
    { id: 'unpaid_leave',    label: 'Unpaid leave' },
  ],
  salary_variance: [
    { id: 'salary_sacrifice', label: 'Salary sacrifice' },
    { id: 'help_debt',        label: 'HELP repayments' },
    { id: 'novated_lease',    label: 'Novated lease' },
    { id: 'part_year',        label: 'Started part way through the period' },
    { id: 'payslips_held',    label: 'Payslips obtained — figures confirmed' },
  ],
  cash_deposits: [
    { id: 'gift',           label: 'Gift', note: 'A gift letter is needed on file.' },
    { id: 'sale_of_asset',  label: 'Sale of an asset' },
    { id: 'tax_refund',     label: 'Tax refund' },
    { id: 'own_savings',    label: 'Their own money moved in' },
  ],
  dishonours: [
    { id: 'bank_error',     label: 'Bank error' },
    { id: 'timing',         label: 'Timing — paid the same week' },
    { id: 'closed_account', label: 'Debit against a closed account' },
    { id: 'acknowledged',   label: 'Client has acknowledged it' },
  ],
  gambling: [
    { id: 'recreational',   label: 'Recreational, within means' },
    { id: 'ceased',         label: 'Ceased — none in recent months' },
    { id: 'discussed',      label: 'Discussed with the client' },
  ],
  income_stability: [
    { id: 'commission',     label: 'Commission or bonus based' },
    { id: 'casual',         label: 'Casual or shift work' },
    { id: 'new_role',       label: 'New role, still settling' },
    { id: 'payslips_held',  label: 'Payslips obtained — figures confirmed' },
  ],
  coverage: [
    { id: 'requested',      label: 'Full statements requested' },
    { id: 'account_new',    label: 'Account opened part way through' },
    { id: 'account_closed', label: 'Account closed part way through' },
    { id: 'accepted',       label: 'Accepted — not material to servicing' },
  ],
  undisclosed_commitments: [
    { id: 'paid_out',       label: 'Paid out since' },
    { id: 'not_theirs',     label: 'Not the client’s — third party' },
    { id: 'fact_find_updated', label: 'Fact find updated' },
    { id: 'to_be_closed',   label: 'To be closed at settlement' },
  ],
  income_not_declared: [
    { id: 'not_income',     label: 'Not income — a transfer' },
    { id: 'one_off',        label: 'One-off, not ongoing' },
    { id: 'evidence_held',  label: 'Evidence obtained — will be used' },
    { id: 'not_used',       label: 'Not being used for servicing' },
  ],
}

export const OTHER: Reason = { id: 'other', label: 'Other…' }

export function reasonsFor(itemKey: string): Reason[] {
  return [...(REASONS[itemKey] || []), OTHER]
}

export type Answer = {
  item_key: string
  reason_id: string
  reason_label: string
  note: string | null
  answered_by: string | null
  answered_at: string
}

// What the answered row says once it is recorded. "Other" has no canned label,
// so the note the person typed IS the answer and there is no falling back to the
// word "Other" on its own.
export function describeAnswer(a: Answer): string {
  if (a.reason_id === 'other') return (a.note || '').trim() || 'Answered'
  const extra = (a.note || '').trim()
  return extra ? `${a.reason_label} — ${extra}` : a.reason_label
}

// An answer only belongs to the item it was given for. A file re-analysed after
// the client sends more statements can lose an item entirely; its answer must not
// reattach itself to whatever appears next.
export function answerFor(answers: Answer[], itemKey: string): Answer | null {
  const hits = answers.filter(a => a.item_key === itemKey)
  if (!hits.length) return null
  return hits.slice().sort((a, b) => b.answered_at.localeCompare(a.answered_at))[0]
}

export function openCount(items: { key: string }[], answers: Answer[]): number {
  return items.filter(i => !answerFor(answers, i.key)).length
}
